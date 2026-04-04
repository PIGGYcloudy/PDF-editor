// PDF 檔案類型
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

// 頁面資訊（包含選取狀態）
export interface PageWithState extends Page {
  isSelected: boolean;
  isDragging?: boolean;
}

// 紙張尺寸預設值
export type PaperSizePreset = 'A3' | 'A4' | 'A5' | 'B2' | 'B3' | 'B4' | 'B5' | 'Letter' | 'Legal';

// 紙張尺寸
export interface PaperSize {
  width: number;
  height: number;
}

// 尺寸選擇
export interface SizeSelection {
  preset: PaperSizePreset | null;
  customWidth: number | null;
  customHeight: number | null;
}

// 浮水印類型
export type WatermarkType = 'text' | 'image';

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
  imageWidth?: number;
  imageUrl?: string;
  imageData?: string;
}

// 浮水印配置
export interface WatermarkConfig {
  type: WatermarkType;
  text?: TextWatermarkConfig;
  image?: ImageWatermarkConfig;
  pages: 'all' | 'selected';
  selectedPageNumbers?: number[];
}

// 壓縮配置
export interface CompressConfig {
  quality: number;
  maxImageWidth: number;
  removeEmbeddedFiles: boolean;
}

// 轉換配置
export interface ConvertConfig {
  format: 'jpg' | 'png';
  dpi: 72 | 150 | 300;
  pages: 'all' | 'selected';
  selectedPageNumbers?: number[];
}

// API 回應類型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

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

// 尺寸調整回應
export interface ResizeResponse {
  newPdfId: string;
  newSize: PaperSize;
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

// 轉換回應
export interface ConvertResponse {
  zipUrl: string;
  imageCount: number;
  format: string;
}
