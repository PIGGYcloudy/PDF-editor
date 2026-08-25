import axios from 'axios';
import type {
  UploadResponse,
  PagesResponse,
  DeletePagesResponse,
  ReorderPagesResponse,
  CompressResponse,
  WatermarkResponse,
  ConvertResponse,
  TextWatermarkConfig,
  ImageWatermarkConfig,
} from '../types';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 上傳 PDF
export async function uploadPDF(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await api.post<UploadResponse>('/pdf/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

// 獲取頁面資訊
export async function getPages(pdfId: string, thumbnailSize: string = 'medium'): Promise<PagesResponse> {
  const response = await api.get<PagesResponse>(`/pdf/pages/${pdfId}`, {
    params: { thumbnail_size: thumbnailSize },
  });
  return response.data;
}

// 刪除頁面
export async function deletePages(pdfId: string, pageNumbers: number[]): Promise<DeletePagesResponse> {
  const response = await api.post<DeletePagesResponse>('/pdf/delete-pages', {
    pdfId,
    pageNumbers,
  });
  return response.data;
}

// 重新排序頁面
export async function reorderPages(pdfId: string, pageOrder: number[]): Promise<ReorderPagesResponse> {
  const response = await api.post<ReorderPagesResponse>('/pdf/reorder-pages', {
    pdfId,
    pageOrder,
  });
  return response.data;
}

// 壓縮 PDF
export async function compressPDF(
  pdfId: string,
  quality: number = 75,
  maxImageWidth: number = 1200,
  removeEmbeddedFiles: boolean = true
): Promise<CompressResponse> {
  const response = await api.post<CompressResponse>('/pdf/compress', {
    pdfId,
    quality,
    maxImageWidth,
    removeEmbeddedFiles,
  });
  return response.data;
}

// 添加文字浮水印
export async function addTextWatermark(
  pdfId: string,
  config: TextWatermarkConfig,
  pages: 'all' | 'selected' = 'all',
  selectedPageNumbers?: number[]
): Promise<WatermarkResponse> {
  const response = await api.post<WatermarkResponse>('/pdf/watermark/text', {
    pdfId,
    ...config,
    pages,
    selectedPageNumbers,
  });
  return response.data;
}

// 添加圖片浮水印
export async function addImageWatermark(
  pdfId: string,
  image: File,
  config: ImageWatermarkConfig,
  pages: 'all' | 'selected' = 'all',
  selectedPageNumbers?: number[]
): Promise<WatermarkResponse> {
  const formData = new FormData();
  formData.append('pdfId', pdfId);
  formData.append('image', image);
  formData.append('position', config.position);
  formData.append('opacity', config.opacity.toString());
  if (config.imageWidth) {
    formData.append('imageWidth', config.imageWidth.toString());
  }
  formData.append('pages', pages);
  if (selectedPageNumbers) {
    formData.append('selectedPageNumbers', selectedPageNumbers.join(','));
  }

  const response = await api.post<WatermarkResponse>('/pdf/watermark/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

// 轉換為圖片
export async function convertToImage(
  pdfId: string,
  format: 'jpg' | 'png',
  dpi: 72 | 150 | 300,
  pages: 'all' | 'selected' = 'all',
  selectedPageNumbers?: number[]
): Promise<ConvertResponse> {
  const response = await api.post<ConvertResponse>('/convert/to-image', {
    pdfId,
    format,
    dpi,
    pages,
    selectedPageNumbers,
  });
  return response.data;
}

// 下載檔案
export async function downloadFile(filename: string): Promise<Blob> {
  const response = await api.get(`/convert/download/${filename}`, {
    responseType: 'blob',
  });
  return response.data;
}

// 獲取縮圖
export async function getThumbnail(pdfId: string, pageNumber: number, size: string = 'medium'): Promise<Blob> {
  const response = await api.get(`/pdf/thumbnail/${pdfId}/page/${pageNumber}`, {
    params: { size },
    responseType: 'blob',
  });
  return response.data;
}

// 刪除 PDF
export async function deletePDF(pdfId: string): Promise<void> {
  await api.delete(`/pdf/${pdfId}`);
}

// 合併 PDF
export async function mergePDFs(pdfIds: string[]): Promise<{ newPdfId: string; name: string; pageCount: number }> {
  const formData = new FormData();
  pdfIds.forEach((id) => formData.append('pdf_ids', id));
  
  const response = await api.post<{ newPdfId: string; name: string; pageCount: number }>('/pdf/merge', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

// 獲取頁面預覽
export async function getPagePreview(pdfId: string, pageNumber: number): Promise<Blob> {
  const response = await api.get(`/pdf/preview/${pdfId}/${pageNumber}`, {
    responseType: 'blob',
  });
  return response.data;
}

// 取得要下載的 PDF 內容
export async function downloadPDF(pdfId: string): Promise<Blob> {
  const response = await api.get(`/pdf/download/${pdfId}`, {
    responseType: 'blob',
  });
  return response.data;
}

export default api;
