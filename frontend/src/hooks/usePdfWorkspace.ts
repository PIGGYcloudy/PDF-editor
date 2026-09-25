import { useReducer, useState } from 'react';
import {
  addImageWatermark,
  addTextWatermark,
  compressPDF,
  deletePages,
  deletePDF,
  getPages,
  mergePDFs,
  reorderPages,
  uploadPDF,
} from '../services/api';
import {
  getCurrentFile,
  getMergeFiles,
  initialWorkspace,
  workspaceReducer,
} from '../state/workspace';
import type { PdfVersion } from '../state/workspace';
import type {
  CompressOptions,
  ImageWatermarkConfig,
  Page,
  TextWatermarkConfig,
} from '../types';
import type { Status, TaskResult } from './useStatus';
import { getErrorMessage } from '../utils/errors';

type NewVersion = Pick<PdfVersion, 'id'> & Partial<PdfVersion>;

/** 舊版本已不再需要時從伺服器刪除；失敗（例如已過期）不影響操作。 */
function discardVersions(ids: string[]): Promise<unknown> {
  return Promise.allSettled(ids.map((id) => deletePDF(id)));
}

export function usePdfWorkspace({ runTask, setError }: Status) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspace);
  const [pages, setPages] = useState<Page[]>([]);
  // 使用者拖曳後尚未套用的頁面順序（原始頁碼）
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

  const currentFile = getCurrentFile(state);
  const mergeFiles = getMergeFiles(state);

  const clearPages = () => {
    setPages([]);
    setPageOrder([]);
  };

  const loadPages = async (pdfId: string) => {
    const response = await getPages(pdfId);
    setPages(response.pages);
    setPageOrder(response.pages.map((page) => page.pageNumber));
  };

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

  const upload = (files: File[]) => runTask(async () => {
    const response = await uploadPDF(files);
    dispatch({ type: 'filesAdded', files: response.files });
    const firstFile = response.files[0];
    if (firstFile) {
      dispatch({ type: 'currentChanged', key: firstFile.id });
      setSelectedPages(new Set());
      if (!(await showVersion(firstFile.id, '檔案已上傳，但頁面預覽載入失敗。'))) {
        return false;
      }
    }
    return '檔案上傳成功！';
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

  const deleteSelectedPages = () => {
    const pageNumbers = Array.from(selectedPages);
    return editCurrentFile(
      (pdfId) => deletePages(pdfId, pageNumbers),
      (result) => ({ id: result.newPdfId, pageCount: result.remainingPages }),
      {
        success: (result) => `已刪除 ${pageNumbers.length} 個頁面，剩餘 ${result.remainingPages} 頁。`,
        failure: '刪除頁面失敗。',
        previewFailure: '頁面已刪除，但新版本預覽載入失敗。',
      },
      { clearSelection: true },
    );
  };

  const applyPageOrder = () => editCurrentFile(
    (pdfId) => reorderPages(pdfId, pageOrder),
    (result) => ({ id: result.newPdfId, pageCount: result.pageCount }),
    {
      success: () => '頁面排序已更新！',
      failure: '更新頁面排序失敗。',
      previewFailure: '頁面排序已更新，但新版本預覽載入失敗。',
    },
    { clearSelection: true },
  );

  const compress = (options: CompressOptions) => editCurrentFile(
    (pdfId) => compressPDF(pdfId, options),
    (result) => ({ id: result.newPdfId, size: result.compressedSize }),
    {
      success: (result) => {
        const originalMB = (result.originalSize / 1024 / 1024).toFixed(2);
        const compressedMB = (result.compressedSize / 1024 / 1024).toFixed(2);
        return `壓縮成功！從 ${originalMB}MB 壓縮到 ${compressedMB}MB (${result.compressionRatio}% 壓縮比)`;
      },
      failure: '壓縮失敗。',
      previewFailure: 'PDF 已壓縮，但新版本預覽載入失敗。',
    },
    { clearSelection: false },
  );

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

  const undo = () => {
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

  const togglePage = (pageNumber: number) => {
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

  const resetPageOrder = () => {
    setPageOrder(pages.map((page) => page.pageNumber));
  };

  return {
    files: state.files,
    currentFile,
    mergeSelection: state.mergeSelection,
    mergeFiles,
    pages,
    pageOrder,
    selectedPages,
    upload,
    openFile,
    removeFile,
    toggleMerge: (key: string) => dispatch({ type: 'mergeToggled', key }),
    mergeSelectedFiles,
    togglePage,
    setPageOrder,
    resetPageOrder,
    applyPageOrder,
    deleteSelectedPages,
    compress,
    addTextWatermark: addTextWatermarkToCurrent,
    addImageWatermark: addImageWatermarkToCurrent,
    undo,
  };
}

export type PdfWorkspace = ReturnType<typeof usePdfWorkspace>;
