import { useState, useCallback } from 'react';
import axios from 'axios';
import { Box, Container, Typography, Paper, Button, CircularProgress, Alert, Grid, IconButton, Stack } from '@mui/material';
import { UploadFile as UploadFileIcon, Delete as DeleteIcon, Compress as CompressIcon, WaterDamage as WatermarkIcon, Photo as PhotoIcon, ContentPaste as MergeIcon, Download as DownloadIcon, DragIndicator } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { PDFFile, Page } from './types';
import { uploadPDF, getPages, deletePages, compressPDF, addTextWatermark, convertToImage, mergePDFs, downloadFile, downloadPDF, reorderPages, deletePDF as deletePDFApi } from './services/api';
import SaveFileDialog from './components/SaveFileDialog';
import {
  canUseNativeSaveFilePicker,
  chooseNativeSaveFile,
  getDestinationFilename,
  normalizeDownloadFilename,
  saveBlobToDestination,
} from './utils/fileSave';
import type {
  FileDestination,
  NativeSaveFileOptions,
} from './utils/fileSave';
import './App.css';

interface ApiErrorData {
  detail?: string | Array<{ msg?: string }>;
}

type ConvertFormat = 'jpg' | 'png';
type ConvertDpi = 72 | 150 | 300;

type SaveRequest =
  | {
      kind: 'pdf';
      pdfId: string;
      suggestedName: string;
    }
  | {
      kind: 'images';
      pdfId: string;
      suggestedName: string;
      format: ConvertFormat;
      dpi: ConvertDpi;
      selectedPageNumbers?: number[];
    };

interface PreparedSave {
  request: SaveRequest;
  blob: Blob;
  imageCount?: number;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorData>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => item.msg)
        .filter((message): message is string => Boolean(message));
      if (messages.length > 0) {
        return messages.join('；');
      }
    }
  }
  return fallback;
}

function getDownloadFilename(downloadUrl: string): string {
  const pathname = new URL(downloadUrl, window.location.origin).pathname;
  const filename = pathname.split('/').pop();
  if (!filename) {
    throw new Error('下載網址缺少檔案名稱');
  }
  return decodeURIComponent(filename);
}

function getSaveFileOptions(request: SaveRequest): NativeSaveFileOptions {
  if (request.kind === 'pdf') {
    return {
      suggestedName: request.suggestedName,
      description: 'PDF 文件',
      mimeType: 'application/pdf',
      extension: '.pdf',
    };
  }

  return {
    suggestedName: request.suggestedName,
    description: '圖片 ZIP 壓縮檔',
    mimeType: 'application/zip',
    extension: '.zip',
  };
}

function getSaveExtension(request: SaveRequest): string {
  return request.kind === 'pdf' ? '.pdf' : '.zip';
}

function updateSuggestedName(
  request: SaveRequest,
  suggestedName: string,
): SaveRequest {
  if (request.kind === 'pdf') {
    return { ...request, suggestedName };
  }
  return { ...request, suggestedName };
}

function App() {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([]);
  const [currentPdfId, setCurrentPdfId] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [draggedPage, setDraggedPage] = useState<number | null>(null);
  const [pagesOrder, setPagesOrder] = useState<number[]>([]);
  const [pendingSave, setPendingSave] = useState<PreparedSave | null>(null);

  const loadPages = useCallback(async (pdfId: string) => {
    const response = await getPages(pdfId);
    setPages(response.pages);
    setPagesOrder(response.pages.map((page) => page.pageNumber));
    return response;
  }, []);

  const loadEditedPreview = useCallback(async (
    pdfId: string,
    failureMessage: string,
  ): Promise<boolean> => {
    try {
      await loadPages(pdfId);
      return true;
    } catch (err) {
      setPages([]);
      setPagesOrder([]);
      setError(getErrorMessage(err, failureMessage));
      return false;
    }
  }, [loadPages]);

  const replacePdfVersion = (
    previousPdfId: string,
    newPdfId: string,
    updates: Partial<Pick<PDFFile, 'size' | 'pageCount'>>,
  ) => {
    setPdfFiles((previousFiles) => {
      const existingFile = previousFiles.find((file) => file.id === previousPdfId);
      if (!existingFile) {
        return [
          ...previousFiles,
          {
            id: newPdfId,
            name: `edited_${newPdfId.slice(0, 8)}.pdf`,
            size: updates.size ?? 0,
            pageCount: updates.pageCount ?? 0,
            uploadedAt: new Date().toISOString(),
          },
        ];
      }

      return previousFiles.map((file) => (
        file.id === previousPdfId
          ? { ...file, ...updates, id: newPdfId }
          : file
      ));
    });

    setSelectedForMerge((previousSelection) => {
      if (!previousSelection.has(previousPdfId)) {
        return previousSelection;
      }
      return new Set(
        Array.from(
          previousSelection,
          (pdfId) => pdfId === previousPdfId ? newPdfId : pdfId,
        ),
      );
    });
  };

  // 檔案上傳
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await uploadPDF(acceptedFiles);
      setPdfFiles((prev) => [...prev, ...response.files]);
      if (response.files.length > 0) {
        const firstFile = response.files[0];
        setCurrentPdfId(firstFile.id);
        setSelectedPages(new Set());
        setActiveTab(null);
        setPages([]);
        setPagesOrder([]);
        const previewLoaded = await loadEditedPreview(
          firstFile.id,
          '檔案已上傳，但頁面預覽載入失敗。',
        );
        if (!previewLoaded) return;
      }
      setSuccess('檔案上傳成功！');
    } catch (err) {
      setError(getErrorMessage(err, '檔案上傳失敗，請稍後再試。'));
    } finally {
      setLoading(false);
    }
  }, [loadEditedPreview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    disabled: loading,
  });

  // 刪除頁面
  const handleDeletePages = async () => {
    if (!currentPdfId || selectedPages.size === 0) return;

    const previousPdfId = currentPdfId;
    const deletedPageCount = selectedPages.size;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await deletePages(previousPdfId, Array.from(selectedPages));
      replacePdfVersion(previousPdfId, response.newPdfId, {
        pageCount: response.remainingPages,
      });
      setCurrentPdfId(response.newPdfId);
      setSelectedPages(new Set());
      setActiveTab(null);
      setPages([]);
      setPagesOrder([]);
      const previewLoaded = await loadEditedPreview(
        response.newPdfId,
        `頁面已刪除，但新版本預覽載入失敗。`,
      );
      if (!previewLoaded) return;
      setSuccess(`已刪除 ${deletedPageCount} 個頁面，剩餘 ${response.remainingPages} 頁。`);
    } catch (err) {
      setError(getErrorMessage(err, '刪除頁面失敗。'));
    } finally {
      setLoading(false);
    }
  };

  // 壓縮 PDF
  const [compressQuality, setCompressQuality] = useState(75);
  const handleCompress = async () => {
    if (!currentPdfId) return;

    const previousPdfId = currentPdfId;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await compressPDF(previousPdfId, compressQuality);
      replacePdfVersion(previousPdfId, response.newPdfId, {
        pageCount: pages.length,
        size: response.compressedSize,
      });
      setCurrentPdfId(response.newPdfId);
      setPages([]);
      setPagesOrder([]);
      const previewLoaded = await loadEditedPreview(
        response.newPdfId,
        'PDF 已壓縮，但新版本預覽載入失敗。',
      );
      if (!previewLoaded) return;
      const originalMB = (response.originalSize / 1024 / 1024).toFixed(2);
      const compressedMB = (response.compressedSize / 1024 / 1024).toFixed(2);
      setSuccess(`壓縮成功！從 ${originalMB}MB 壓縮到 ${compressedMB}MB (${response.compressionRatio}% 壓縮比)`);
      setActiveTab(null);
    } catch (err) {
      setError(getErrorMessage(err, '壓縮失敗。'));
    } finally {
      setLoading(false);
    }
  };

  // 添加文字浮水印
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkPosition, setWatermarkPosition] = useState<'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('center');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [watermarkRotation, setWatermarkRotation] = useState(45);
  const handleAddWatermark = async () => {
    if (!currentPdfId) return;

    const previousPdfId = currentPdfId;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await addTextWatermark(
        previousPdfId,
        {
          text: watermarkText,
          position: watermarkPosition,
          fontSize: 48,
          fontFamily: 'Helvetica',
          color: '#FF0000',
          opacity: watermarkOpacity,
          rotation: watermarkRotation,
        },
        selectedPages.size > 0 ? 'selected' : 'all',
        selectedPages.size > 0 ? Array.from(selectedPages) : undefined
      );
      replacePdfVersion(previousPdfId, response.newPdfId, {
        pageCount: pages.length,
      });
      setCurrentPdfId(response.newPdfId);
      setPages([]);
      setPagesOrder([]);
      const previewLoaded = await loadEditedPreview(
        response.newPdfId,
        '浮水印已添加，但新版本預覽載入失敗。',
      );
      if (!previewLoaded) return;
      setSuccess('浮水印添加成功！');
      setActiveTab(null);
    } catch (err) {
      setError(getErrorMessage(err, '添加浮水印失敗。'));
    } finally {
      setLoading(false);
    }
  };

  // 轉換為圖片
  const [convertFormat, setConvertFormat] = useState<ConvertFormat>('jpg');
  const [convertDpi, setConvertDpi] = useState<ConvertDpi>(150);

  const getSuggestedPdfName = (pdfId: string): string => {
    const sourceName = pdfFiles.find((file) => file.id === pdfId)?.name
      ?? 'document.pdf';
    return normalizeDownloadFilename(sourceName, '.pdf', 'document');
  };

  const prepareSave = async (request: SaveRequest): Promise<PreparedSave> => {
    if (request.kind === 'pdf') {
      return {
        request,
        blob: await downloadPDF(request.pdfId),
      };
    }

    const response = await convertToImage(
      request.pdfId,
      request.format,
      request.dpi,
      request.selectedPageNumbers ? 'selected' : 'all',
      request.selectedPageNumbers,
    );
    return {
      request,
      blob: await downloadFile(getDownloadFilename(response.zipUrl)),
      imageCount: response.imageCount,
    };
  };

  const setSaveSuccess = (
    preparedSave: PreparedSave,
    destination: FileDestination,
  ) => {
    const filename = getDestinationFilename(destination);
    if (preparedSave.request.kind === 'pdf') {
      setSuccess(
        destination.kind === 'native'
          ? `PDF 已儲存為「${filename}」。`
          : `已開始下載 PDF「${filename}」。`,
      );
      return;
    }

    setSuccess(
      destination.kind === 'native'
        ? `轉換成功！已將 ${preparedSave.imageCount} 張圖片儲存為「${filename}」。`
        : `轉換成功！已開始下載包含 ${preparedSave.imageCount} 張圖片的「${filename}」。`,
    );
    setActiveTab(null);
  };

  const getSaveFailureMessage = (request: SaveRequest): string => (
    request.kind === 'pdf'
      ? '下載 PDF 失敗。'
      : '轉換或下載圖片失敗。'
  );

  const savePreparedFile = async (
    preparedSave: PreparedSave,
    destination: FileDestination,
  ) => {
    await saveBlobToDestination(preparedSave.blob, destination);
    setSaveSuccess(preparedSave, destination);
  };

  const beginSave = async (request: SaveRequest) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      setPendingSave(await prepareSave(request));
    } catch (err) {
      setError(getErrorMessage(err, getSaveFailureMessage(request)));
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!currentPdfId) return;

    const pdfName = getSuggestedPdfName(currentPdfId);
    const baseName = pdfName.slice(0, -'.pdf'.length);
    await beginSave({
      kind: 'images',
      pdfId: currentPdfId,
      suggestedName: normalizeDownloadFilename(
        `${baseName}_images_${convertFormat}`,
        '.zip',
        `pdf_images_${convertFormat}`,
      ),
      format: convertFormat,
      dpi: convertDpi,
      selectedPageNumbers: selectedPages.size > 0
        ? Array.from(selectedPages).sort((first, second) => first - second)
        : undefined,
    });
  };

  // 切換 PDF 檔案
  const handleSelectPdf = async (pdfId: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await loadPages(pdfId);
      setCurrentPdfId(pdfId);
      setSelectedPages(new Set());
      setActiveTab(null);
    } catch (err) {
      setError(getErrorMessage(err, '載入頁面資訊失敗。'));
    } finally {
      setLoading(false);
    }
  };

  // 切換頁面選取狀態
  const handleTogglePage = (pageNumber: number) => {
    setSelectedPages((prev: Set<number>) => {
      const newSet = new Set(prev);
      if (newSet.has(pageNumber)) {
        newSet.delete(pageNumber);
      } else {
        newSet.add(pageNumber);
      }
      return newSet;
    });
  };

  // 切換合併選取狀態
  const handleToggleMergeSelect = (pdfId: string) => {
    setSelectedForMerge((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pdfId)) {
        newSet.delete(pdfId);
      } else {
        newSet.add(pdfId);
      }
      return newSet;
    });
  };

  // 合併 PDF
  const handleMergePDFs = async () => {
    if (selectedForMerge.size < 2) {
      setError('請至少選擇兩個 PDF 進行合併');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await mergePDFs(Array.from(selectedForMerge));
      const newFile: PDFFile = {
        id: response.newPdfId,
        name: response.name,
        size: 0,
        pageCount: response.pageCount,
        uploadedAt: new Date().toISOString(),
      };
      setPdfFiles((previousFiles: PDFFile[]) => [
        ...previousFiles.filter((file) => file.id !== newFile.id),
        newFile,
      ]);
      setCurrentPdfId(response.newPdfId);
      setSelectedForMerge(new Set());
      setSelectedPages(new Set());
      setActiveTab(null);
      setPages([]);
      setPagesOrder([]);
      const previewLoaded = await loadEditedPreview(
        response.newPdfId,
        'PDF 已合併，但新檔案預覽載入失敗。',
      );
      if (!previewLoaded) return;
      setSuccess('PDF 合併成功！');
    } catch (err) {
      setError(getErrorMessage(err, '合併 PDF 失敗。'));
    } finally {
      setLoading(false);
    }
  };

  // 下載 PDF
  const handleDownloadPDF = async () => {
    if (!currentPdfId) return;

    await beginSave({
      kind: 'pdf',
      pdfId: currentPdfId,
      suggestedName: getSuggestedPdfName(currentPdfId),
    });
  };

  const handlePreparedSave = async (filename: string) => {
    if (!pendingSave) return;

    const preparedSave: PreparedSave = {
      ...pendingSave,
      request: updateSuggestedName(pendingSave.request, filename),
    };
    setError(null);

    if (!canUseNativeSaveFilePicker()) {
      try {
        await savePreparedFile(preparedSave, {
          kind: 'browser',
          filename,
        });
        setPendingSave(null);
      } catch (err) {
        setError(getErrorMessage(
          err,
          getSaveFailureMessage(preparedSave.request),
        ));
      }
      return;
    }

    setLoading(true);
    try {
      const selection = await chooseNativeSaveFile(
        getSaveFileOptions(preparedSave.request),
      );
      if (selection.status === 'cancelled') {
        return;
      }

      const destination: FileDestination = selection.status === 'selected'
        ? { kind: 'native', handle: selection.handle }
        : { kind: 'browser', filename };
      await savePreparedFile(preparedSave, destination);
      setPendingSave(null);
    } catch (err) {
      setError(getErrorMessage(
        err,
        getSaveFailureMessage(preparedSave.request),
      ));
    } finally {
      setLoading(false);
    }
  };

  // 刪除 PDF 檔案
  const handleDeletePDF = async (pdfId: string, e: any) => {
    e.stopPropagation();
    
    if (!window.confirm('確定要刪除此 PDF 檔案嗎？')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await deletePDFApi(pdfId);
      setPdfFiles((prev: PDFFile[]) => prev.filter(f => f.id !== pdfId));
      setSelectedForMerge((previousSelection) => {
        const nextSelection = new Set(previousSelection);
        nextSelection.delete(pdfId);
        return nextSelection;
      });
      
      // 如果刪除的是當前選取的 PDF，重置狀態
      if (currentPdfId === pdfId) {
        setCurrentPdfId(null);
        setPages([]);
        setPagesOrder([]);
        setSelectedPages(new Set());
        setActiveTab(null);
      }
      
      setSuccess('PDF 檔案刪除成功！');
    } catch (err) {
      setError(getErrorMessage(err, '刪除 PDF 失敗。'));
    } finally {
      setLoading(false);
    }
  };

  // 拖曳開始
  const handleDragStart = (pageNumber: number) => {
    setDraggedPage(pageNumber);
  };

  // 拖曳結束
  const handleDragOver = (e: any, targetPageNumber: number) => {
    e.preventDefault();
    if (draggedPage === null || draggedPage === targetPageNumber) return;

    setPagesOrder((prev) => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedPage);
      const targetIndex = newOrder.indexOf(targetPageNumber);

      // 移除拖曳的頁面
      newOrder.splice(draggedIndex, 1);
      // 插入到新位置
      newOrder.splice(targetIndex, 0, draggedPage);

      return newOrder;
    });
  };

  // 拖曳結束處理
  const handleDragEnd = () => {
    setDraggedPage(null);
  };

  // 應用頁面排序
  const handleApplyPageOrder = async () => {
    if (!currentPdfId || pagesOrder.length !== pages.length) return;

    const previousPdfId = currentPdfId;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await reorderPages(previousPdfId, pagesOrder);
      replacePdfVersion(previousPdfId, response.newPdfId, {
        pageCount: response.pageCount,
      });
      setCurrentPdfId(response.newPdfId);
      setSelectedPages(new Set());
      setPages([]);
      setPagesOrder([]);
      const previewLoaded = await loadEditedPreview(
        response.newPdfId,
        '頁面排序已更新，但新版本預覽載入失敗。',
      );
      if (!previewLoaded) return;
      setSuccess('頁面排序已更新！');
    } catch (err) {
      setError(getErrorMessage(err, '更新頁面排序失敗。'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <SaveFileDialog
        open={pendingSave !== null}
        suggestedName={pendingSave?.request.suggestedName ?? ''}
        extension={pendingSave ? getSaveExtension(pendingSave.request) : '.pdf'}
        nativeSaveAvailable={canUseNativeSaveFilePicker()}
        error={error}
        loading={loading}
        onCancel={() => setPendingSave(null)}
        onSave={handlePreparedSave}
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4, color: '#000000' }}>
          PDF 編輯器
        </Typography>

        {/* 錯誤和成功訊息 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* 檔案上傳區域 */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            上傳 PDF 檔案
          </Typography>
          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed #ccc',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: isDragActive ? '#e3f2fd' : '#fafafa',
              transition: 'background-color 0.3s',
            }}
          >
            <input {...getInputProps()} />
            <UploadFileIcon sx={{ fontSize: 48, color: '#1976d2', mb: 1 }} />
            <Typography>
              {isDragActive ? '釋放以上傳檔案' : '拖曳 PDF 檔案到這裡，或點擊選擇檔案'}
            </Typography>
          </Box>
        </Paper>

        {/* PDF 檔案列表 */}
        {pdfFiles.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">PDF 檔案</Typography>
              {selectedForMerge.size >= 2 && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleMergePDFs}
                  disabled={loading}
                  startIcon={<MergeIcon />}
                >
                  合併選中的 PDF ({selectedForMerge.size})
                </Button>
              )}
            </Stack>
            <Grid container spacing={2}>
              {pdfFiles.map((file) => (
                <Grid item key={file.id} xs={12} sm={6} md={4}>
                  <Paper
                    sx={{
                      p: 2,
                      border: selectedForMerge.has(file.id) ? '2px solid #1976d2' : '1px solid #e0e0e0',
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      bgcolor: selectedForMerge.has(file.id) ? '#e3f2fd' : '#fff',
                      '&:hover': {
                        boxShadow: 3,
                      },
                    }}
                    onClick={() => {
                      if (!loading) handleToggleMergeSelect(file.id);
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        variant={currentPdfId === file.id ? 'contained' : 'outlined'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPdf(file.id);
                        }}
                        disabled={loading}
                        startIcon={<UploadFileIcon />}
                        sx={{ flexGrow: 1, minWidth: 0 }}
                      >
                        <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </Box>
                      </Button>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePDF(file.id, e);
                        }}
                        disabled={loading}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {file.pageCount} 頁
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        {/* 功能按鈕 */}
        {currentPdfId && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              功能
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant={activeTab === 'delete' ? 'contained' : 'outlined'}
                  onClick={() => setActiveTab(activeTab === 'delete' ? null : 'delete')}
                  startIcon={<DeleteIcon />}
                  disabled={selectedPages.size === 0 || loading}
                >
                  刪除頁面 ({selectedPages.size})
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant={activeTab === 'compress' ? 'contained' : 'outlined'}
                  onClick={() => setActiveTab(activeTab === 'compress' ? null : 'compress')}
                  startIcon={<CompressIcon />}
                  disabled={loading}
                >
                  壓縮 PDF
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant={activeTab === 'watermark' ? 'contained' : 'outlined'}
                  onClick={() => setActiveTab(activeTab === 'watermark' ? null : 'watermark')}
                  startIcon={<WatermarkIcon />}
                  disabled={loading}
                >
                  添加浮水印
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant={activeTab === 'convert' ? 'contained' : 'outlined'}
                  onClick={() => setActiveTab(activeTab === 'convert' ? null : 'convert')}
                  startIcon={<PhotoIcon />}
                  disabled={loading}
                >
                  轉換為圖片
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleDownloadPDF}
                  startIcon={<DownloadIcon />}
                  disabled={loading}
                >
                  另存 PDF
                </Button>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* 功能面板 */}
        {currentPdfId && activeTab === 'delete' && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              刪除頁面
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              已選取 {selectedPages.size} 個頁面
            </Typography>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeletePages}
              disabled={selectedPages.size === 0 || loading}
            >
              {loading ? <CircularProgress size={24} /> : '刪除選取的頁面'}
            </Button>
          </Paper>
        )}

        {currentPdfId && activeTab === 'compress' && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              壓縮 PDF
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>壓縮品質：{compressQuality}%</Typography>
              <input
                type="range"
                min="1"
                max="100"
                value={compressQuality}
                onChange={(e) => setCompressQuality(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </Box>
            <Button
              variant="contained"
              onClick={handleCompress}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : '壓縮 PDF'}
            </Button>
          </Paper>
        )}

        {currentPdfId && activeTab === 'watermark' && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              添加文字浮水印
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>浮水印文字：</Typography>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
              />
              <Typography variant="body2" gutterBottom>位置：</Typography>
              <Grid container spacing={1}>
                {['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                  <Grid item xs={6} sm={4} key={pos}>
                    <Button
                      variant={watermarkPosition === pos ? 'contained' : 'outlined'}
                      size="small"
                      fullWidth
                      onClick={() => setWatermarkPosition(pos as any)}
                    >
                      {pos}
                    </Button>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>透明度：{Math.round(watermarkOpacity * 100)}%</Typography>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={watermarkOpacity}
                onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                style={{ width: '100%', marginBottom: '10px' }}
              />
              <Typography variant="body2" gutterBottom>旋轉角度：{watermarkRotation}°</Typography>
              <input
                type="range"
                min="0"
                max="360"
                value={watermarkRotation}
                onChange={(e) => setWatermarkRotation(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {selectedPages.size > 0 ? `將添加到 ${selectedPages.size} 個選取的頁面` : '將添加到所有頁面'}
            </Typography>
            <Button
              variant="contained"
              onClick={handleAddWatermark}
              disabled={loading || !watermarkText}
            >
              {loading ? <CircularProgress size={24} /> : '添加浮水印'}
            </Button>
          </Paper>
        )}

        {currentPdfId && activeTab === 'convert' && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              轉換為圖片
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>輸出格式：</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Button
                    variant={convertFormat === 'jpg' ? 'contained' : 'outlined'}
                    fullWidth
                    onClick={() => setConvertFormat('jpg')}
                  >
                    JPG
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    variant={convertFormat === 'png' ? 'contained' : 'outlined'}
                    fullWidth
                    onClick={() => setConvertFormat('png')}
                  >
                    PNG
                  </Button>
                </Grid>
              </Grid>
              <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>解析度 (DPI)：</Typography>
              <Grid container spacing={1}>
                {[72, 150, 300].map((dpi) => (
                  <Grid item xs={4} key={dpi}>
                    <Button
                      variant={convertDpi === dpi ? 'contained' : 'outlined'}
                      fullWidth
                      onClick={() => setConvertDpi(dpi as 72 | 150 | 300)}
                    >
                      {dpi}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {selectedPages.size > 0 ? `將轉換 ${selectedPages.size} 個選取的頁面` : '將轉換所有頁面'}
            </Typography>
            <Button
              variant="contained"
              onClick={handleConvert}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : `轉換並另存為 ${convertFormat.toUpperCase()}`}
            </Button>
          </Paper>
        )}

        {/* 頁面預覽 */}
        {currentPdfId && pages.length > 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              頁面預覽 ({pages.length} 頁)
            </Typography>
            <Grid container spacing={2}>
              {pagesOrder.map((pageNumber) => {
                const page = pages.find(p => p.pageNumber === pageNumber);
                if (!page) return null;
                return (
                  <Grid item xs={6} sm={4} md={3} lg={2} key={page.pageNumber}>
                    <Box
                      draggable
                      onDragStart={() => handleDragStart(pageNumber)}
                      onDragOver={(e) => handleDragOver(e, pageNumber)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleTogglePage(pageNumber)}
                      sx={{
                        border: selectedPages.has(pageNumber) ? '3px solid #1976d2' : '2px solid #ddd',
                        borderRadius: 2,
                        p: 1,
                        cursor: 'grab',
                        textAlign: 'center',
                        bgcolor: selectedPages.has(pageNumber) ? '#e3f2fd' : '#fff',
                        transition: 'all 0.2s',
                        '&:hover': {
                          boxShadow: 2,
                        },
                        '&[draggable="true"]:drag': {
                          opacity: 0.5,
                        },
                      }}
                    >
                      {/* 顯示縮圖 */}
                      {page.thumbnailUrl && (
                        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 100 }}>
                          <img
                            src={page.thumbnailUrl}
                            alt={`頁面 ${pageNumber}`}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '150px',
                              objectFit: 'contain',
                              border: '1px solid #eee',
                              borderRadius: 4,
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </Box>
                      )}
                      <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
                        <DragIndicator fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight="bold">
                          頁面 {pageNumber}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {page.width} x {page.height} pt
                      </Typography>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
            {pagesOrder.length > 0 && pagesOrder.join(',') !== pages.map((p: Page) => p.pageNumber).join(',') && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  variant="contained"
                  onClick={handleApplyPageOrder}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : '應用排序'}
                </Button>
              </Box>
            )}
          </Paper>
        )}
      </Container>
    </Box>
  );
}

export default App;
