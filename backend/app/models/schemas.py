"""
Pydantic 模型定義
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# 通用回應模型
class SuccessResponse(BaseModel):
    success: bool = True
    data: Optional[dict] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: dict


# PDF 檔案模型
class PDFFile(BaseModel):
    id: str
    name: str
    size: int
    pageCount: int
    uploadedAt: datetime


class UploadResponse(BaseModel):
    files: List[PDFFile]


# 頁面模型
class Page(BaseModel):
    pageNumber: int
    width: int
    height: int
    thumbnailUrl: Optional[str] = None


class PagesResponse(BaseModel):
    pdfId: str
    pageCount: int
    pages: List[Page]


# 刪除頁面請求
class DeletePagesRequest(BaseModel):
    pdfId: str
    pageNumbers: List[int] = Field(..., description="要刪除的頁面號碼列表 (1-based)")


class DeletePagesResponse(BaseModel):
    newPdfId: str
    deletedPages: List[int]
    remainingPages: int


# 重新排序頁面請求
class ReorderPagesRequest(BaseModel):
    pdfId: str
    pageOrder: List[int] = Field(..., description="新的頁面順序 (1-based 頁面號碼)")


class ReorderPagesResponse(BaseModel):
    newPdfId: str
    pageCount: int


# 壓縮請求
class CompressRequest(BaseModel):
    pdfId: str
    quality: int = Field(75, ge=1, le=100, description="圖片壓縮品質 (1-100)")
    maxImageWidth: int = Field(1200, description="圖片最大寬度 (px)")
    removeEmbeddedFiles: bool = Field(True, description="是否移除嵌入檔案")


class CompressResponse(BaseModel):
    newPdfId: str
    originalSize: int
    compressedSize: int
    compressionRatio: float


# 文字浮水印請求
class WatermarkTextRequest(BaseModel):
    pdfId: str
    text: str = Field(..., min_length=1, description="浮水印文字")
    position: str = Field("center", description="位置：center, top-left, top-right, bottom-left, bottom-right")
    fontSize: int = Field(48, ge=8, le=200, description="字體大小 (pt)")
    fontFamily: str = Field("Helvetica", description="字體家族")
    color: str = Field("#FF0000", description="顏色 (hex)")
    opacity: float = Field(0.3, ge=0, le=1, description="透明度 (0-1)")
    rotation: int = Field(45, ge=0, le=360, description="旋轉角度 (度)")
    pages: str = Field("all", description="all 或 selected")
    selectedPageNumbers: Optional[List[int]] = Field(None, description="當 pages 為 selected 時必填")


class WatermarkResponse(BaseModel):
    newPdfId: str


# 轉換為圖片請求
class ConvertToImageRequest(BaseModel):
    pdfId: str
    format: str = Field("jpg", description="輸出格式：jpg 或 png")
    dpi: int = Field(150, description="解析度 (DPI): 72, 150, 300")
    pages: str = Field("all", description="all 或 selected")
    selectedPageNumbers: Optional[List[int]] = Field(None, description="當 pages 為 selected 時必填")


class ConvertToImageResponse(BaseModel):
    zipUrl: str
    imageCount: int
    format: str
