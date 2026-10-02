"""
格式轉換路由
"""
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.config import MAX_UPLOAD_MB, MAX_UPLOAD_SIZE
from app.models.schemas import (
    ConvertToImageRequest,
    ConvertToImageResponse,
    ImagesToPdfResponse,
)
from app.routers.errors import processing_errors
from app.services.convert_service import ConvertService
from app.services.image_service import ImageService
from app.utils.pdf_utils import output_pdf_id, resolve_pdf_path

# 與 PDF 路由相同，使用同步 `def` 讓 Poppler 渲染在 threadpool 執行。
router = APIRouter(prefix="/convert", tags=["轉換"])


@router.post("/to-image", response_model=ConvertToImageResponse)
def convert_to_image(request: ConvertToImageRequest):
    """將 PDF 轉換為圖片"""
    pdf_path = resolve_pdf_path(request.pdfId)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="PDF 檔案不存在或已過期")

    # 格式與 DPI 已由 ConvertToImageRequest 的 Literal 型別驗證。
    with processing_errors("轉換為圖片"):
        zip_path, image_count = ConvertService.convert_to_images(
            pdf_path,
            request.format,
            request.dpi,
            request.selectedPageNumbers if request.pages == "selected" else None
        )

    # 返回下載 URL
    return ConvertToImageResponse(
        zipUrl=f"/api/convert/download/{zip_path.name}",
        imageCount=image_count,
        format=request.format
    )


@router.post("/images-to-pdf", response_model=ImagesToPdfResponse)
def images_to_pdf(
    images: List[UploadFile] = File(...),
    pageSize: str = Form("a4"),
):
    """依上傳順序把圖片組成一份 PDF，每張圖片一頁"""
    # 檔案類型以 Pillow 實際解析的結果為準，不信任瀏覽器回報的 content type。
    sources = []
    total_size = 0
    for image in images:
        stream = image.file
        stream.seek(0, 2)
        total_size += stream.tell()
        stream.seek(0)
        sources.append((image.filename or "image", stream))

    if total_size > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"檔案太大：單次上傳合計最多 {MAX_UPLOAD_MB}MB",
        )

    with processing_errors("圖片轉 PDF"):
        pdf_path, page_count = ImageService.images_to_pdf(sources, pageSize)
        return ImagesToPdfResponse(
            id=output_pdf_id(pdf_path),
            name=ImageService.suggest_name([name for name, _ in sources]),
            pageCount=page_count,
            size=pdf_path.stat().st_size,
        )


@router.get("/download/{filename}")
def download_file(filename: str):
    """下載轉換產生的 ZIP，傳送完成後即從伺服器刪除"""
    zip_path = ConvertService.resolve_zip_path(filename)
    if zip_path is None:
        raise HTTPException(status_code=404, detail="檔案不存在或已過期")

    # 若傳送中斷導致沒有刪除，仍會由過期清理處理。
    return FileResponse(
        path=zip_path,
        filename=filename,
        media_type="application/zip",
        background=BackgroundTask(zip_path.unlink, missing_ok=True),
    )
