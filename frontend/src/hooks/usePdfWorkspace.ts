import { parseMergePages } from '../utils/mergePages';
import { normalizeDownloadFilename } from '../utils/fileSave';
import { useEffect, useReducer, useRef, useState } from 'react';
import { readSnapshot, writeSnapshot } from '../state/recovery';
import type { DocumentDraft } from '../state/recovery';
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
import type { PageEditsAction, Rotation, StagedPage } from '../state/pageEdits';
import {
  getCurrentFile,
  getMergeFiles,
  initialWorkspace,
  workspaceReducer,
} from '../state/workspace';
import type { PdfVersion, WorkspaceAction, WorkspaceFile } from '../state/workspace';
import type {
  CompressOptions,
  ImagePageSize,
  ImageWatermarkConfig,
  PDFFile,
  Page,
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

const EMPTY_PAGES: Page[] = [];

const APPLY_LABEL = '頁面變更';

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
  const [state, dispatchWorkspace] = useReducer(workspaceReducer, recovered?.workspace ?? initialWorkspace);
  const [drafts, setDrafts] = useState<Record<string, DocumentDraft>>(() => {
    const current = recovered && getCurrentFile(recovered.workspace);
    return recovered?.drafts ?? (current ? {
      [current.id]: { pages: recovered!.pages, edits: recovered!.edits },
    } : {});
  });
  const dispatch = (action: WorkspaceAction) => {
    // 新版本有自己的頁碼基準，舊版本的草稿不可再次套用。
    if (action.type === 'versionReplaced' || action.type === 'versionRestored'
      || action.type === 'versionRedone') {
      const file = state.files.find((item) => item.key === action.key);
      if (file) setDrafts((previous) => Object.fromEntries(
        Object.entries(previous).filter(([id]) => id !== file.id),
      ));
      // 產生新版本後，先前復原的版本不能再重做
      if (file && action.type === 'versionReplaced') {
        void discardVersions((file.future ?? []).map((version) => version.id));
      }
    }
    dispatchWorkspace(action);
  };
  const [mergeResult, setMergeResult] = useState<WorkspaceFile | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  // Shift 點選範圍選取的起點
  const selectionAnchor = useRef<number | null>(null);
  const [compression, setCompression] = useState<CompressionResult | null>(null);

  const currentFile = getCurrentFile(state);
  const mergeFiles = getMergeFiles(state);
  const pages = (currentFile && drafts[currentFile.id]?.pages) || EMPTY_PAGES;
  const edits = (currentFile && drafts[currentFile.id]?.edits) || initialPageEdits;
  const dispatchEdits = (action: PageEditsAction) => {
    if (!currentFile) return;
    const id = currentFile.id;
    setDrafts((previous) => {
      const draft = previous[id];
      return draft ? { ...previous, [id]: { ...draft,
        edits: pageEditsReducer(draft.edits, action) } } : previous;
    });
  };
  const pendingFileKeys = state.files.filter((file) =>
    drafts[file.id] && hasPendingEdits(drafts[file.id].edits)).map((file) => file.key);
  const hasAnyEdits = pendingFileKeys.length > 0;
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
      return '已恢復上次的工作區。';
    }, '工作區已恢復，但無法連線確認檔案。請稍後重新開啟文件。');
  }, [recovered, runTask]);

  useEffect(() => {
    // Do not save intermediate state while a server operation changes versions.
    if (loading) return;
    const activeDrafts = Object.fromEntries(state.files
      .filter((file) => drafts[file.id])
      .map((file) => [file.id, drafts[file.id]]));
    const saved = writeSnapshot({ version: 1, workspace: state, pages, edits, drafts: activeDrafts });
    if (!saved && !storageWarningShown.current) {
      storageWarningShown.current = true;
      setError('瀏覽器無法暫存工作區，重新整理後將無法恢復。請先另存 PDF。');
    }
  }, [state, pages, edits, drafts, loading, setError]);

  useEffect(() => {
    if (!hasAnyEdits && !loading) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasAnyEdits, loading]);

  const loadPages = async (pdfId: string, preserveDraft = true) => {
    const response = await getPages(pdfId);
    setDrafts((previous) => ({ ...previous, [pdfId]: (preserveDraft ? previous[pdfId] : undefined) ?? {
      pages: response.pages,
      edits: pageEditsReducer(initialPageEdits, {
        type: 'reset', pageNumbers: response.pages.map((page) => page.pageNumber),
      }),
    } }));
    selectionAnchor.current = null;
  };

  /**
   * 選取頁面在目前顯示順序中的位置（從 1 開始）。套用變更後的新版本就是
   * 依這個順序編號，因此可直接作為伺服器操作的頁碼。
   */
  const selectedPositions = (staged: StagedPage[] = edits.pages) => staged
    .flatMap((page, index) => (selectedPages.has(page.pageNumber) ? [index + 1] : []));

  const toStagedPayload = (staged: StagedPage[]) => (
    staged.map(({ pageNumber, rotation }) => ({ pageNumber, rotation }))
  );

  /** 顯示新版本的頁面；失敗時設定錯誤訊息並回傳 false。 */
  const showVersion = async (
    pdfId: string,
    failureMessage: string,
  ): Promise<boolean> => {
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
    { clearSelection, label }: { clearSelection: boolean; label: string },
  ): Promise<boolean> => {
    const file = currentFile;
    if (!file) {
      return Promise.resolve(false);
    }

    return runTask(async (): Promise<TaskResult> => {
      // 尚未套用的頁面變更先成為一個版本，操作再以它為準
      const [prepared] = await applyFileDrafts([file]);
      const result = await request(prepared.id);
      const version = toVersion(result);
      dispatch({ type: 'versionReplaced', key: file.key, version, label });
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
  const upload = (files: File[], imagePageSize: ImagePageSize = 'a4', preserveCurrent = false) => runTask(async () => {
    const pdfs = files.filter(isPdfFile);
    const images = sortByNameNatural(files.filter((file) => !isPdfFile(file)));
    const added: PDFFile[] = [];

    // 每一步完成就加入清單，後一步失敗時已上傳的檔案不會遺失。
    if (pdfs.length > 0) {
      const response = await uploadPDF(pdfs);
      added.push(...response.files);
      dispatch({ type: 'filesAdded', files: response.files, selectForMerge: true });
    }
    if (images.length > 0) {
      const response = await imagesToPdf(images, imagePageSize);
      const converted = toPdfFile(response, response.name);
      added.push(converted);
      dispatch({ type: 'filesAdded', files: [converted], selectForMerge: true });
    }

    const firstFile = added[0];
    if (firstFile && !preserveCurrent) {
      dispatch({ type: 'currentChanged', key: firstFile.id });
      setSelectedPages(new Set());
      if (!(await showVersion(firstFile.id, '檔案已上傳，但頁面預覽載入失敗。'))) {
        return false;
      }
    }

    if (images.length === 0) {
      return `已加入 ${pdfs.length} 份 PDF。`;
    }
    const imageMessage = `已將 ${images.length} 張圖片合成一份 PDF。`;
    return pdfs.length > 0 ? `已加入 ${pdfs.length} 份 PDF，並${imageMessage}` : imageMessage;
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
    const file = currentFile;
    if (!file) return null;
    if (!hasEdits) return file.id;
    let appliedId: string | null = null;
    const summary = describeEdits(summarizeEdits(edits));
    await runTask(async () => {
      const [applied] = await applyFileDrafts([file]);
      appliedId = applied.id;
      return `已套用變更：${summary}。`;
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
      return `已將 ${staged.length} 頁抽出為「${name}」。`;
    }, '抽出頁面失敗。');
  };

  const split = (options: SplitOptions) => {
    const file = currentFile;
    if (!file) {
      return Promise.resolve(false);
    }
    return runTask(async () => {
      const [prepared] = await applyFileDrafts([file]);
      const response = await splitPDF(prepared.id, options);
      dispatch({
        type: 'filesAdded',
        files: response.files.map((info) => (
          toPdfFile(info, `${baseName(file.name)}_p${info.label}.pdf`)
        )),
      });
      return `已拆分為 ${response.files.length} 個檔案。`;
    }, '拆分 PDF 失敗。');
  };

  const compress = (options: CompressOptions) => (
    editCurrentFile(
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
      { clearSelection: false, label: '壓縮' },
    )
  );

  const selectedPageNumbers = () => (
    selectedPages.size > 0 ? selectedPositions() : undefined
  );

  const watermarkMessages = {
    success: () => '已加上浮水印。',
    failure: '加上浮水印失敗。',
    previewFailure: '浮水印已加上，但新版本預覽載入失敗。',
  };

  const addTextWatermarkToCurrent = (config: TextWatermarkConfig) => {
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
      { clearSelection: false, label: '加上浮水印' },
    );
  };

  const addImageWatermarkToCurrent = (
    image: File,
    config: ImageWatermarkConfig,
  ) => {
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
      { clearSelection: false, label: '加上浮水印' },
    );
  };

  const previousVersion = currentFile?.history[currentFile.history.length - 1];
  const nextVersion = currentFile?.future?.[currentFile.future.length - 1];
  const undoLabel = edits.history.length > 0
    ? edits.labels[edits.labels.length - 1] || '頁面編輯'
    : previousVersion ? previousVersion.label || '上一步' : null;
  // 有未套用的頁面變更時，重做伺服器版本會丟失這些變更，因此只重做頁面編輯
  const redoLabel = edits.future.length > 0
    ? edits.futureLabels[edits.futureLabels.length - 1] || '頁面編輯'
    : !hasEdits && nextVersion ? nextVersion.label || '下一步' : null;

  /** 先復原尚未套用的頁面變更，沒有時才復原到上一個版本。 */
  const undo = () => {
    if (edits.history.length > 0) {
      dispatchEdits({ type: 'undo' });
      return Promise.resolve(true);
    }
    const file = currentFile;
    if (!file || !previousVersion) {
      return Promise.resolve(false);
    }
    const label = undoLabel;
    return runTask(async () => {
      // 先確認上一個版本仍在伺服器上（可能已過期），再切換狀態。
      await loadPages(previousVersion.id, false);
      dispatch({ type: 'versionRestored', key: file.key });
      setSelectedPages(new Set());
      return `已復原${label}。`;
    }, '復原失敗，上一個版本可能已過期。');
  };

  const redo = () => {
    if (edits.future.length > 0) {
      dispatchEdits({ type: 'redo' });
      return Promise.resolve(true);
    }
    const file = currentFile;
    if (!file || !nextVersion || hasEdits) {
      return Promise.resolve(false);
    }
    const label = redoLabel;
    return runTask(async () => {
      await loadPages(nextVersion.id, false);
      dispatch({ type: 'versionRedone', key: file.key });
      setSelectedPages(new Set());
      return `已重做${label}。`;
    }, '重做失敗，該版本可能已過期。');
  };

  /** 批次輸出套用每份文件的草稿；失敗時保留尚未套用的編輯。 */
  const applyFileDrafts = async (files: WorkspaceFile[]) => {
    const results = [];
    for (const file of files) {
      const draft = drafts[file.id];
      let id = file.id;
      if (draft && hasPendingEdits(draft.edits)) {
        const result = await applyEdits(id, toStagedPayload(draft.edits.pages));
        id = result.newPdfId;
        dispatch({ type: 'versionReplaced', key: file.key,
          version: { id, pageCount: result.pageCount }, label: APPLY_LABEL });
        if (file.key === currentFile?.key) {
          // 選取跟著頁面移到新版本的編號
          setSelectedPages(new Set(selectedPositions(draft.edits.pages)));
          selectionAnchor.current = null;
          await showVersion(id, '變更已套用，但預覽載入失敗。');
        }
      }
      results.push({ ...file, id });
    }
    return results;
  };

  const prepareBundle = async () => {
    let files: WorkspaceFile[] | null = null;
    await runTask(async () => {
      files = await applyFileDrafts(mergeFiles);
      return null;
    }, '套用頁面變更失敗。');
    return files as WorkspaceFile[] | null;
  };

  const mergeSelectedFiles = (name = '合併文件.pdf', ranges: Record<string, string> = {}) => {
    if (mergeFiles.length < 2) {
      setError('請至少勾選兩份 PDF。');
      return Promise.resolve(false);
    }
    setMergeResult(null);
    return runTask(async () => {
      // Validate every range before applying drafts or creating temporary files.
      const selections = mergeFiles.map((file) => parseMergePages(ranges[file.key] ?? '',
        drafts[file.id]?.edits.pages.length ?? file.pageCount));
      const temporaryIds: string[] = [];
      try {
        const files = await applyFileDrafts(mergeFiles);
        const ids: string[] = [];
        for (const [index, file] of files.entries()) {
          if (ranges[file.key]?.trim()) {
            const extracted = await extractPages(file.id, selections[index].map((pageNumber) => ({ pageNumber, rotation: 0 })));
            const id = extracted.files[0].id;
            temporaryIds.push(id);
            ids.push(id);
          } else {
            ids.push(file.id);
          }
        }
        const response = await mergePDFs(ids);
        const file = toPdfFile({ id: response.newPdfId, size: 0, pageCount: response.pageCount },
          normalizeDownloadFilename(name, '.pdf', '合併文件'));
        dispatch({ type: 'filesAdded', files: [file] });
        setMergeResult({ ...file, key: file.id, history: [] });
        return null;
      } finally {
        await discardVersions(temporaryIds);
      }
    }, '合併 PDF 失敗。');
  };

  const removeFile = (key: string) => {
    const file = state.files.find((item) => item.key === key);
    if (!file) {
      return Promise.resolve(false);
    }
    return runTask(async () => {
      await deletePDF(file.id);
      // 供復原、重做用的版本也一併刪除。
      await discardVersions([...file.history, ...(file.future ?? [])].map((version) => version.id));
      dispatch({ type: 'fileRemoved', key });
      setDrafts((previous) => Object.fromEntries(Object.entries(previous)
        .filter(([id]) => id !== file.id && !file.history.some((version) => version.id === id))));
      if (state.currentKey === key) {
        setSelectedPages(new Set());
      }
      return `已移除「${file.name}」。`;
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
    mergeResult,
    mergePageCounts: Object.fromEntries(state.files.map((file) => [file.key, drafts[file.id]?.edits.pages.length ?? file.pageCount])),
    reorderMerge: (keys: string[]) => dispatch({ type: 'mergeReordered', keys }),
    pendingFileKeys,
    prepareBundle,
    currentFile,
    mergeSelection: state.mergeSelection,
    mergeFiles,
    pages,
    pageOrder,
    rotations,
    compression: compression?.pdfId === currentFile?.id ? compression : null,
    hasEdits,
    editSummary: describeEdits(summarizeEdits(edits)),
    canUndo: undoLabel !== null,
    undoLabel,
    canRedo: redoLabel !== null,
    redoLabel,
    selectedPositions: () => selectedPositions(),
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
    redo,
  };
}

export type PdfWorkspace = ReturnType<typeof usePdfWorkspace>;
