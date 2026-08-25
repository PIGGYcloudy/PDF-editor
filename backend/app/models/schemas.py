"""
Pydantic 模型定義
"""
from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


WatermarkPosition = Literal[
    "center",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
]
PageSelection = Literal["all", "selected"]


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
    pageNumbers: List[int] = Field(
        ...,
        min_length=1,
        description="要刪除的頁面號碼列表 (1-based)",
    )

    @field_validator("pageNumbers")
    @classmethod
    def validate_unique_pages(cls, page_numbers: List[int]):
        if len(page_numbers) != len(set(page_numbers)):
            raise ValueError("頁面號碼不得重複")
        return page_numbers


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
    maxImageWidth: int = Field(1200, ge=1, description="圖片最大寬度 (px)")
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
    position: WatermarkPosition = Field(
        "center",
        description="位置：center, top-left, top-right, bottom-left, bottom-right",
    )
    fontSize: int = Field(48, ge=8, le=200, description="字體大小 (pt)")
    fontFamily: str = Field("Helvetica", min_length=1, description="字體家族")
    color: str = Field("#FF0000", description="顏色 (hex)")
    opacity: float = Field(0.3, ge=0, le=1, description="透明度 (0-1)")
    rotation: int = Field(45, ge=0, le=360, description="旋轉角度 (度)")
    pages: PageSelection = Field("all", description="all 或 selected")
    selectedPageNumbers: Optional[List[int]] = Field(None, description="當 pages 為 selected 時必填")

    @model_validator(mode="after")
    def validate_selected_pages(self):
        if self.pages == "selected" and not self.selectedPageNumbers:
            raise ValueError("pages 為 selected 時必須提供 selectedPageNumbers")
        if (
            self.pages == "selected"
            and self.selectedPageNumbers
            and len(self.selectedPageNumbers)
            != len(set(self.selectedPageNumbers))
        ):
            raise ValueError("selectedPageNumbers 不得重複")
        return self


class WatermarkResponse(BaseModel):
    newPdfId: str


# 轉換為圖片請求
class ConvertToImageRequest(BaseModel):
    pdfId: str
    format: Literal["jpg", "png"] = Field("jpg", description="輸出格式：jpg 或 png")
    dpi: Literal[72, 150, 300] = Field(150, description="解析度 (DPI): 72, 150, 300")
    pages: PageSelection = Field("all", description="all 或 selected")
    selectedPageNumbers: Optional[List[int]] = Field(None, description="當 pages 為 selected 時必填")

    @model_validator(mode="after")
    def validate_selected_pages(self):
        if self.pages == "selected" and not self.selectedPageNumbers:
            raise ValueError("pages 為 selected 時必須提供 selectedPageNumbers")
        if (
            self.pages == "selected"
            and self.selectedPageNumbers
            and len(self.selectedPageNumbers)
            != len(set(self.selectedPageNumbers))
        ):
            raise ValueError("selectedPageNumbers 不得重複")
        return self


class ConvertToImageResponse(BaseModel):
    zipUrl: str
    imageCount: int
    format: str
