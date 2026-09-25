// PDF 檔案類型（後端回傳）
export interface PDFFile {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  uploadedAt: string;
}

// 頁面類型
export interface Page {
  pageNumber: number;
  width: number;
  height: number;
  thumbnailUrl?: string;
}

// 浮水印位置
export type WatermarkPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// 文字浮水印配置
export interface TextWatermarkConfig {
  text: string;
  position: WatermarkPosition;
  fontSize: number;
  fontFamily: string;
  color: string;
  opacity: number;
  rotation: number;
}

// 圖片浮水印配置
export interface ImageWatermarkConfig {
  position: WatermarkPosition;
  opacity: number;
  /** 圖片寬度 (pt)；未指定時依圖片原始尺寸 */
  imageWidth?: number;
}

// 壓縮選項
export interface CompressOptions {
  quality: number;
  maxImageWidth: number;
  removeEmbeddedFiles: boolean;
}

// 轉換選項
export type ConvertFormat = 'jpg' | 'png';
export type ConvertDpi = 72 | 150 | 300;

// 上傳回應
export interface UploadResponse {
  files: PDFFile[];
}

// 頁面回應
export interface PagesResponse {
  pdfId: string;
  pageCount: number;
  pages: Page[];
}

// 刪除頁面回應
export interface DeletePagesResponse {
  newPdfId: string;
  deletedPages: number[];
  remainingPages: number;
}

// 重新排序回應
export interface ReorderPagesResponse {
  newPdfId: string;
  pageCount: number;
}

// 壓縮回應
export interface CompressResponse {
  newPdfId: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

// 浮水印回應
export interface WatermarkResponse {
  newPdfId: string;
}

// 合併回應
export interface MergeResponse {
  newPdfId: string;
  name: string;
  pageCount: number;
}

// 轉換回應
export interface ConvertResponse {
  zipUrl: string;
  imageCount: number;
  format: string;
}
