import { useEffect, useReducer, useRef, useState } from 'react';
import { readSnapshot, writeSnapshot } from '../state/recovery';
import {
  addImageWatermark,
  addTextWatermark,
  applyEdits,
  compressPDF,
  deletePDF,
  extractPages,
  getPages,
  imagesToPdf,
  mergePDFs,
  splitPDF,
  uploadPDF,
} from '../services/api';
import {
  describeEdits,
  hasPendingEdits,
  initialPageEdits,
  invertSelection,
  pageEditsReducer,
  pagesBetween,
  pagesByParity,
  summarizeEdits,
} from '../state/pageEdits';
import type { Rotation, StagedPage } from '../state/pageEdits';
import {
  getCurrentFile,
  getMergeFiles,
  initialWorkspace,
  workspaceReducer,
} from '../state/workspace';
import type { PdfVersion } from '../state/workspace';
import type {
  CompressOptions,
  ImagePageSize,
  ImageWatermarkConfig,
  Page,
  PDFFile,
  SplitFileInfo,
  SplitOptions,
  TextWatermarkConfig,
} from '../types';
import type { Status, TaskResult } from './useStatus';
import { getErrorMessage } from '../utils/errors';
import { isPdfFile, sortByNameNatural } from '../utils/files';

type NewVersion = Pick<PdfVersion, 'id'> & Partial<PdfVersion>;

/** 舊版本已不再需要時從伺服器刪除；失敗（例如已過期）不影響操作。 */
function discardVersions(ids: string[]): Promise<unknown> {
  return Promise.allSettled(ids.map((id) => deletePDF(id)));
}

/** 最近一次壓縮的結果；pdfId 是壓縮後的版本，換了版本就不再顯示。 */
export interface CompressionResult {
  pdfId: string;
  originalSize: number;
  compressedSize: number;
  /** 縮小的百分比；檔案變大時為負數 */
  ratio: number;
}

const PENDING_EDITS_MESSAGE = '請先套用或還原頁面變更。';

function baseName(filename: string): string {
  return filename.replace(/\.pdf$/i, '') || 'document';
}

function toPdfFile(
  info: Pick<SplitFileInfo, 'id' | 'pageCount' | 'size'>,
  name: string,
): PDFFile {
  return {
    id: info.id,
    name,
    size: info.size,
    pageCount: info.pageCount,
    uploadedAt: new Date().toISOString(),
  };
}

export function usePdfWorkspace({ runTask, setError, loading }: Status) {
  const [recovered] = useState(readSnapshot);
  const [state, dispatch] = useReducer(workspaceReducer, recovered?.workspace ?? initialWorkspace);
  const [pages, setPages] = useState<Page[]>(recovered?.pages ?? []);
  // 尚未套用的頁面編輯（刪除、排序、旋轉），頁面以原始頁碼識別
  const [edits, dispatchEdits] = useReducer(pageEditsReducer, recovered?.edits ?? initialPageEdits);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  // Shift 點選範圍選取的起點
  const selectionAnchor = useRef<number | null>(null);
  const [compression, setCompression] = useState<CompressionResult | null>(null);

  const currentFile = getCurrentFile(state);
  const mergeFiles = getMergeFiles(state);
  const pageOrder = edits.pages.map((page) => page.pageNumber);
  const rotations = new Map<number, Rotation>(
    edits.pages.map((page) => [page.pageNumber, page.rotation]),
  );
  const hasEdits = hasPendingEdits(edits);
  const recoveryStarted = useRef(false);
  const storageWarningShown = useRef(false);

  useEffect(() => {
    if (recoveryStarted.current || !recovered?.workspace.files.length) return;
    recoveryStarted.current = true;
    const file = getCurrentFile(recovered.workspace);
    void runTask(async () => {
      if (file) await getPages(file.id);
      return '已恢復此分頁的工作區與頁面編輯。檔案仍有保留期限，完成後請另存。';
    }, '工作區已恢復，但無法連線確認檔案。請稍後重新開啟文件。');
  }, [recovered, runTask]);

  useEffect(() => {
    // Do not save intermediate state while a server operation changes versions.
    if (loading) return;
    const saved = writeSnapshot({ version: 1, workspace: state, pages, edits });
    if (!saved && !storageWarningShown.current) {
      storageWarningShown.current = true;
      setError('瀏覽器無法暫存工作區，重新整理後將無法恢復。請先另存 PDF。');
    }
  }, [state, pages, edits, loading, setError]);

  useEffect(() => {
    if (!hasEdits && !loading) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasEdits, loading]);

  const clearPages = () => {
    setPages([]);
    dispatchEdits({ type: 'reset', pageNumbers: [] });
    selectionAnchor.current = null;
  };

  const loadPages = async (pdfId: string) => {
    const response = await getPages(pdfId);
    setPages(response.pages);
    dispatchEdits({
      type: 'reset',
      pageNumbers: response.pages.map((page) => page.pageNumber),
    });
    selectionAnchor.current = null;
  };

  /** 需要以伺服器上的版本為準的操作，必須先處理未套用的頁面變更。 */
  const blockedByPendingEdits = () => {
    if (!hasEdits) {
      return false;
    }
    setError(PENDING_EDITS_MESSAGE);
    return true;
  };

  const toStagedPayload = (staged: StagedPage[]) => (
    staged.map(({ pageNumber, rotation }) => ({ pageNumber, rotation }))
  );

  /** 顯示新版本的頁面；失敗時設定錯誤訊息並回傳 false。 */
  const showVersion = async (
    pdfId: string,
    failureMessage: string,
  ): Promise<boolean> => {
    clearPages();
    try {
      await loadPages(pdfId);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, failureMessage));
      return false;
    }
  };

  /** 對目前的文件執行會產生新版本的操作，並保留舊版本供復原。 */
  const editCurrentFile = <T,>(
    request: (pdfId: string) => Promise<T>,
    toVersion: (result: T) => NewVersion,
    messages: {
      success: (result: T) => string;
      failure: string;
      previewFailure: string;
    },
    { clearSelection }: { clearSelection: boolean },
  ): Promise<boolean> => {
    const file = currentFile;
    if (!file) {
      return Promise.resolve(false);
    }

    return runTask(async (): Promise<TaskResult> => {
      const result = await request(file.id);
      const version = toVersion(result);
      dispatch({ type: 'versionReplaced', key: file.key, version });
      if (clearSelection) {
        setSelectedPages(new Set());
      }
      if (!(await showVersion(version.id, messages.previewFailure))) {
        return false;
      }
      return messages.success(result);
    }, messages.failure);
  };

  /** 上傳 PDF；圖片會依檔名順序合成一份新的 PDF，每張圖片一頁。 */
  const upload = (files: File[], imagePageSize: ImagePageSize = 'a4') => runTask(async () => {
    const pdfs = files.filter(isPdfFile);
    const images = sortByNameNatural(files.filter((file) => !isPdfFile(file)));
    const added: PDFFile[] = [];

    // 每一步完成就加入清單，後一步失敗時已上傳的檔案不會遺失。
    if (pdfs.length > 0) {
      const response = await uploadPDF(pdfs);
      added.push(...response.files);
      dispatch({ type: 'filesAdded', files: response.files });
    }
    if (images.length > 0) {
      const response = await imagesToPdf(images, imagePageSize);
      const converted = toPdfFile(response, response.name);
      added.push(converted);
      dispatch({ type: 'filesAdded', files: [converted] });
    }

    const firstFile = added[0];
    if (firstFile) {
      dispatch({ type: 'currentChanged', key: firstFile.id });
      setSelectedPages(new Set());
      if (!(await showVersion(firstFile.id, '檔案已上傳，但頁面預覽載入失敗。'))) {
        return false;
      }
    }

    if (images.length === 0) {
      return '檔案上傳成功！';
    }
    const imageMessage = `已將 ${images.length} 張圖片轉成 PDF，可拖曳頁面調整順序。`;
    return pdfs.length > 0 ? `已上傳 ${pdfs.length} 份 PDF，${imageMessage}` : imageMessage;
  }, '檔案上傳失敗，請稍後再試。');

  const openFile = (key: string) => {
    const file = state.files.find((item) => item.key === key);
    if (!file) {
      return Promise.resolve(false);
    }
    return runTask(async () => {
      await loadPages(file.id);
      dispatch({ type: 'currentChanged', key });
      setSelectedPages(new Set());
      return null;
    }, '載入頁面資訊失敗。');
  };

  const applyPageEdits = async (): Promise<string | null> => {
    if (!currentFile) return null;
    if (!hasEdits) return currentFile.id;
    let appliedId: string | null = null;
    const summary = describeEdits(summarizeEdits(edits));
    await runTask(async () => {
      const result = await applyEdits(currentFile.id, toStagedPayload(edits.pages));
      appliedId = result.newPdfId;
      dispatch({ type: 'versionReplaced', key: currentFile.key,
        version: { id: result.newPdfId, pageCount: result.pageCount } });
      setSelectedPages(new Set());
      if (!(await showVersion(result.newPdfId, '頁面變更已套用，但新版本預覽載入失敗。'))) {
        return false;
      }
      return `已套用變更（${summary}），目前共 ${result.pageCount} 頁。`;
    }, '套用頁面變更失敗。');
    return appliedId;
  };

  const discardPageEdits = () => dispatchEdits({ type: 'discard' });

  const removePages = (pageNumbers: number[]) => {
    const removable = pageNumbers.filter((pageNumber) => pageOrder.includes(pageNumber));
    if (removable.length === 0) {
      return;
    }
    if (removable.length >= pageOrder.length) {
      setError('至少要保留一頁，無法刪除全部頁面。');
      return;
    }
    dispatchEdits({ type: 'remove', pageNumbers: removable });
    setSelectedPages((previous) => {
      const next = new Set(previous);
      removable.forEach((pageNumber) => next.delete(pageNumber));
      return next;
    });
  };

  const removeSelectedPages = () => removePages(Array.from(selectedPages));

  const rotatePages = (pageNumbers: number[], delta: number) => {
    if (pageNumbers.length > 0) {
      dispatchEdits({ type: 'rotate', pageNumbers, delta });
    }
  };

  const rotateSelectedPages = (delta: number) => rotatePages(
    Array.from(selectedPages),
    delta,
  );

  const setPageOrder = (order: number[]) => dispatchEdits({ type: 'reorder', order });

  /** 把選取的頁面（依目前順序與旋轉）抽出成新檔案，原文件不變。 */
  const extractSelectedPages = () => {
    const file = currentFile;
    const staged = edits.pages.filter((page) => selectedPages.has(page.pageNumber));
    if (!file || staged.length === 0) {
      setError('請先選取要抽出的頁面。');
      return Promise.resolve(false);
    }
    return runTask(async () => {
      const response = await extractPages(file.id, toStagedPayload(staged));
      const [extracted] = response.files;
      const name = `${baseName(file.name)}_extract.pdf`;
      dispatch({ type: 'filesAdded', files: [toPdfFile(extracted, name)] });
      return `已將 ${staged.length} 頁抽出成新檔案「${name}」，可在檔案列表開啟。`;
    }, '抽出頁面失敗。');
  };

  const split = (options: SplitOptions) => {
    const file = currentFile;
    if (!file || blockedByPendingEdits()) {
      return Promise.resolve(false);
    }
    return runTask(async () => {
      const response = await splitPDF(file.id, options);
      dispatch({
        type: 'filesAdded',
        files: response.files.map((info) => (
          toPdfFile(info, `${baseName(file.name)}_p${info.label}.pdf`)
        )),
      });
      return `已拆分成 ${response.files.length} 個檔案，可在檔案列表開啟。`;
    }, '拆分 PDF 失敗。');
  };

  const compress = (options: CompressOptions) => {
    if (blockedByPendingEdits()) {
      return Promise.resolve(false);
    }
    return editCurrentFile(
      async (pdfId) => {
        const result = await compressPDF(pdfId, options);
        setCompression({
          pdfId: result.newPdfId,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          ratio: result.compressionRatio,
        });
        return result;
      },
      (result) => ({ id: result.newPdfId, size: result.compressedSize }),
      {
        // 詳細的大小變化顯示在壓縮面板
        success: () => '壓縮完成。',
        failure: '壓縮失敗。',
        previewFailure: 'PDF 已壓縮，但新版本預覽載入失敗。',
      },
      { clearSelection: false },
    );
  };

  const selectedPageNumbers = () => (
    selectedPages.size > 0
      ? Array.from(selectedPages).sort((first, second) => first - second)
      : undefined
  );

  const watermarkMessages = {
    success: () => '浮水印添加成功！',
    failure: '添加浮水印失敗。',
    previewFailure: '浮水印已添加，但新版本預覽載入失敗。',
  };

  const addTextWatermarkToCurrent = (config: TextWatermarkConfig) => {
    if (blockedByPendingEdits()) {
      return Promise.resolve(false);
    }
    const pageNumbers = selectedPageNumbers();
    return editCurrentFile(
      (pdfId) => addTextWatermark(
        pdfId,
        config,
        pageNumbers ? 'selected' : 'all',
        pageNumbers,
      ),
      (result) => ({ id: result.newPdfId }),
      watermarkMessages,
      { clearSelection: false },
    );
  };

  const addImageWatermarkToCurrent = (
    image: File,
    config: ImageWatermarkConfig,
  ) => {
    if (blockedByPendingEdits()) {
      return Promise.resolve(false);
    }
    const pageNumbers = selectedPageNumbers();
    return editCurrentFile(
      (pdfId) => addImageWatermark(
        pdfId,
        image,
        config,
        pageNumbers ? 'selected' : 'all',
        pageNumbers,
      ),
      (result) => ({ id: result.newPdfId }),
      watermarkMessages,
      { clearSelection: false },
    );
  };

  /** 先復原尚未套用的頁面變更，沒有時才復原到上一個版本。 */
  const undo = () => {
    if (edits.history.length > 0) {
      dispatchEdits({ type: 'undo' });
      return Promise.resolve(true);
    }
    const file = currentFile;
    const previous = file?.history[file.history.length - 1];
    if (!file || !previous) {
      return Promise.resolve(false);
    }
    return runTask(async () => {
      // 先確認上一個版本仍在伺服器上（可能已過期），再切換狀態。
      await loadPages(previous.id);
      dispatch({ type: 'versionRestored', key: file.key });
      setSelectedPages(new Set());
      // 復原後被取代的版本不會再用到。
      void discardVersions([file.id]);
      return '已復原上一個步驟。';
    }, '復原失敗，上一個版本可能已過期。');
  };

  const mergeSelectedFiles = () => {
    if (mergeFiles.length < 2) {
      setError('請至少選擇兩個 PDF 進行合併');
      return Promise.resolve(false);
    }
    return runTask(async () => {
      const response = await mergePDFs(mergeFiles.map((file) => file.id));
      dispatch({
        type: 'filesAdded',
        files: [{
          id: response.newPdfId,
          name: response.name,
          size: 0,
          pageCount: response.pageCount,
          uploadedAt: new Date().toISOString(),
        }],
      });
      dispatch({ type: 'mergeCleared' });
      dispatch({ type: 'currentChanged', key: response.newPdfId });
      setSelectedPages(new Set());
      if (!(await showVersion(response.newPdfId, 'PDF 已合併，但新檔案預覽載入失敗。'))) {
        return false;
      }
      return 'PDF 合併成功！';
    }, '合併 PDF 失敗。');
  };

  const removeFile = (key: string) => {
    const file = state.files.find((item) => item.key === key);
    if (!file) {
      return Promise.resolve(false);
    }
    return runTask(async () => {
      await deletePDF(file.id);
      // 供復原用的舊版本也一併刪除。
      await discardVersions(file.history.map((version) => version.id));
      dispatch({ type: 'fileRemoved', key });
      if (state.currentKey === key) {
        clearPages();
        setSelectedPages(new Set());
      }
      return 'PDF 檔案刪除成功！';
    }, '刪除 PDF 失敗。');
  };

  /** 切換頁面的選取；extend 為 true（Shift+點擊）時選取與上次點選之間的所有頁面。 */
  const togglePage = (pageNumber: number, extend = false) => {
    const anchor = selectionAnchor.current;
    if (extend && anchor !== null && pageOrder.includes(anchor)) {
      const range = pagesBetween(pageOrder, anchor, pageNumber);
      setSelectedPages((previous) => new Set([...previous, ...range]));
      return;
    }
    selectionAnchor.current = pageNumber;
    setSelectedPages((previous) => {
      const next = new Set(previous);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  };

  const selectAllPages = () => setSelectedPages(new Set(pageOrder));

  const clearSelection = () => {
    selectionAnchor.current = null;
    setSelectedPages(new Set());
  };

  const invertPageSelection = () => setSelectedPages(
    new Set(invertSelection(pageOrder, selectedPages)),
  );

  const selectPagesByParity = (parity: 'odd' | 'even') => setSelectedPages(
    new Set(pagesByParity(pageOrder, parity)),
  );

  return {
    files: state.files,
    currentFile,
    mergeSelection: state.mergeSelection,
    mergeFiles,
    pages,
    pageOrder,
    rotations,
    compression: compression?.pdfId === currentFile?.id ? compression : null,
    hasEdits,
    editSummary: describeEdits(summarizeEdits(edits)),
    canUndo: edits.history.length > 0 || (currentFile?.history.length ?? 0) > 0,
    selectedPages,
    upload,
    openFile,
    removeFile,
    toggleMerge: (key: string) => dispatch({ type: 'mergeToggled', key }),
    mergeSelectedFiles,
    togglePage,
    selectAllPages,
    clearSelection,
    invertPageSelection,
    selectPagesByParity,
    setPageOrder,
    rotatePages,
    rotateSelectedPages,
    removePages,
    removeSelectedPages,
    applyPageEdits,
    discardPageEdits,
    extractSelectedPages,
    split,
    compress,
    addTextWatermark: addTextWatermarkToCurrent,
    addImageWatermark: addImageWatermarkToCurrent,
    undo,
  };
}

export type PdfWorkspace = ReturnType<typeof usePdfWorkspace>;
