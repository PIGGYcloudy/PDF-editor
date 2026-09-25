"""
格式轉換路由
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.models.schemas import ConvertToImageRequest, ConvertToImageResponse
from app.routers.errors import processing_errors
from app.services.convert_service import ConvertService
from app.utils.pdf_utils import resolve_pdf_path

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
