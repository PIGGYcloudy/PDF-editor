import { useState, useCallback } from 'react';
import { Box, Container, Typography, Paper, Button, CircularProgress, Alert, Grid, IconButton, Stack } from '@mui/material';
import { UploadFile as UploadFileIcon, Delete as DeleteIcon, OpenInFull as ResizeIcon, Compress as CompressIcon, WaterDamage as WatermarkIcon, Photo as PhotoIcon, ContentPaste as MergeIcon, Download as DownloadIcon, DragIndicator } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { PDFFile, Page, PaperSizePreset } from './types';
import { uploadPDF, getPages, deletePages, resizePages, compressPDF, addTextWatermark, convertToImage, mergePDFs, downloadPDF, reorderPages, deletePDF as deletePDFApi } from './services/api';
import './App.css';

// 紙張尺寸預設值
const PAPER_SIZES: Record<PaperSizePreset, { width: number; height: number; label: string }> = {
  A3: { width: 842, height: 1191, label: 'A3 (297 x 420 mm)' },
  A4: { width: 595, height: 842, label: 'A4 (210 x 297 mm)' },
  A5: { width: 420, height: 595, label: 'A5 (148 x 210 mm)' },
  B2: { width: 1417, height: 2004, label: 'B2 (500 x 707 mm)' },
  B3: { width: 1000, height: 1417, label: 'B3 (353 x 500 mm)' },
  B4: { width: 709, height: 1000, label: 'B4 (250 x 353 mm)' },
  B5: { width: 500, height: 709, label: 'B5 (176 x 250 mm)' },
  Letter: { width: 612, height: 792, label: 'Letter (216 x 279 mm)' },
  Legal: { width: 612, height: 1008, label: 'Legal (216 x 356 mm)' },
};

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

  // 檔案上傳
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await uploadPDF(acceptedFiles);
      setPdfFiles((prev) => [...prev, ...response.files]);
      if (response.files.length > 0) {
        const firstFile = response.files[0];
        setCurrentPdfId(firstFile.id);
        await loadPages(firstFile.id);
      }
      setSuccess('檔案上傳成功！');
    } catch (err) {
      setError('檔案上傳失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
  });

  // 刪除頁面
  const handleDeletePages = async () => {
    if (!currentPdfId || selectedPages.size === 0) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await deletePages(currentPdfId, Array.from(selectedPages));
      setCurrentPdfId(response.newPdfId);
      await loadPages(response.newPdfId);
      setSelectedPages(new Set());
      setSuccess(`已刪除 ${selectedPages.size} 個頁面，剩餘 ${response.remainingPages} 頁。`);
    } catch (err) {
      setError('刪除頁面失敗。');
    } finally {
      setLoading(false);
    }
  };

  // 調整尺寸
  const [targetSize, setTargetSize] = useState<PaperSizePreset>('A4');
  const handleResize = async () => {
    if (!currentPdfId) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await resizePages(
        currentPdfId,
        { preset: targetSize, customWidth: null, customHeight: null },
        selectedPages.size > 0 ? 'selected' : 'all',
        selectedPages.size > 0 ? Array.from(selectedPages) : undefined
      );
      setCurrentPdfId(response.newPdfId);
      await loadPages(response.newPdfId);
      setSuccess('尺寸調整成功！');
      setActiveTab(null);
    } catch (err) {
      setError('尺寸調整失敗。');
    } finally {
      setLoading(false);
    }
  };

  // 壓縮 PDF
  const [compressQuality, setCompressQuality] = useState(75);
  const handleCompress = async () => {
    if (!currentPdfId) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await compressPDF(currentPdfId, compressQuality);
      setCurrentPdfId(response.newPdfId);
      await loadPages(response.newPdfId);
      const originalMB = (response.originalSize / 1024 / 1024).toFixed(2);
      const compressedMB = (response.compressedSize / 1024 / 1024).toFixed(2);
      setSuccess(`壓縮成功！從 ${originalMB}MB 壓縮到 ${compressedMB}MB (${response.compressionRatio}% 壓縮比)`);
      setActiveTab(null);
    } catch (err) {
      setError('壓縮失敗。');
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
    
    setLoading(true);
    setError(null);
    try {
      const response = await addTextWatermark(
        currentPdfId,
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
      setCurrentPdfId(response.newPdfId);
      await loadPages(response.newPdfId);
      setSuccess('浮水印添加成功！');
      setActiveTab(null);
    } catch (err) {
      setError('添加浮水印失敗。');
    } finally {
      setLoading(false);
    }
  };

  // 轉換為圖片
  const [convertFormat, setConvertFormat] = useState<'jpg' | 'png'>('jpg');
  const [convertDpi, setConvertDpi] = useState<72 | 150 | 300>(150);
  const handleConvert = async () => {
    if (!currentPdfId) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await convertToImage(
        currentPdfId,
        convertFormat,
        convertDpi,
        selectedPages.size > 0 ? 'selected' : 'all',
        selectedPages.size > 0 ? Array.from(selectedPages) : undefined
      );
      // 觸發下載
      const link = document.createElement('a');
      link.href = `${window.location.origin}${response.zipUrl}`;
      link.download = `pdf_images_${response.format}.zip`;
      link.click();
      setSuccess(`轉換成功！已下載 ${response.imageCount} 張圖片。`);
      setActiveTab(null);
    } catch (err) {
      setError('轉換失敗。');
    } finally {
      setLoading(false);
    }
  };

  // 載入頁面時初始化頁面順序
  const loadPages = async (pdfId: string) => {
    try {
      const response = await getPages(pdfId);
      setPages(response.pages);
      setPagesOrder(response.pages.map(p => p.pageNumber));
    } catch (err) {
      setError('載入頁面資訊失敗。');
    }
  };

  // 切換 PDF 檔案
  const handleSelectPdf = async (pdfId: string) => {
    setCurrentPdfId(pdfId);
    await loadPages(pdfId);
    setSelectedPages(new Set());
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
    try {
      const response = await mergePDFs(Array.from(selectedForMerge));
      const newFile: PDFFile = {
        id: response.newPdfId,
        name: response.name,
        size: 0,
        pageCount: response.pageCount,
        uploadedAt: new Date().toISOString(),
      };
      setPdfFiles((prev: PDFFile[]) => [...prev, newFile]);
      setCurrentPdfId(response.newPdfId);
      await loadPages(response.newPdfId);
      setSelectedForMerge(new Set());
      setSuccess('PDF 合併成功！');
    } catch (err) {
      setError('合併 PDF 失敗。');
    } finally {
      setLoading(false);
    }
  };

  // 下載 PDF
  const handleDownloadPDF = async () => {
    if (!currentPdfId) return;

    setLoading(true);
    setError(null);
    try {
      await downloadPDF(currentPdfId);
      setSuccess('PDF 下載成功！');
    } catch (err) {
      setError('下載 PDF 失敗。');
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
    try {
      await deletePDFApi(pdfId);
      setPdfFiles((prev: PDFFile[]) => prev.filter(f => f.id !== pdfId));
      
      // 如果刪除的是當前選取的 PDF，重置狀態
      if (currentPdfId === pdfId) {
        setCurrentPdfId(null);
        setPages([]);
        setSelectedPages(new Set());
      }
      
      setSuccess('PDF 檔案刪除成功！');
    } catch (err) {
      setError('刪除 PDF 失敗。');
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

    setLoading(true);
    setError(null);
    try {
      const response = await reorderPages(currentPdfId, pagesOrder);
      setCurrentPdfId(response.newPdfId);
      await loadPages(response.newPdfId);
      setSuccess('頁面排序已更新！');
    } catch (err) {
      setError('更新頁面排序失敗。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4 }}>
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
                    onClick={() => handleToggleMergeSelect(file.id)}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        variant={currentPdfId === file.id ? 'contained' : 'outlined'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPdf(file.id);
                        }}
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
                  disabled={selectedPages.size === 0}
                >
                  刪除頁面 ({selectedPages.size})
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant={activeTab === 'resize' ? 'contained' : 'outlined'}
                  onClick={() => setActiveTab(activeTab === 'resize' ? null : 'resize')}
                  startIcon={<ResizeIcon />}
                >
                  調整尺寸
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant={activeTab === 'compress' ? 'contained' : 'outlined'}
                  onClick={() => setActiveTab(activeTab === 'compress' ? null : 'compress')}
                  startIcon={<CompressIcon />}
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
                >
                  下載 PDF
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

        {currentPdfId && activeTab === 'resize' && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              調整尺寸
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>選擇預設尺寸：</Typography>
              <Grid container spacing={1}>
                {Object.entries(PAPER_SIZES).map(([key, size]) => (
                  <Grid item xs={6} sm={4} md={3} key={key}>
                    <Button
                      variant={targetSize === key ? 'contained' : 'outlined'}
                      size="small"
                      fullWidth
                      onClick={() => setTargetSize(key as PaperSizePreset)}
                    >
                      {size.label}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {selectedPages.size > 0 ? `將調整 ${selectedPages.size} 個選取的頁面` : '將調整所有頁面'}
            </Typography>
            <Button
              variant="contained"
              onClick={handleResize}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : '調整尺寸'}
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
              {loading ? <CircularProgress size={24} /> : `轉換為 ${convertFormat.toUpperCase()}`}
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
