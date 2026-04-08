"""
格式轉換路由
"""
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import OUTPUTS_DIR
from app.models.schemas import ConvertToImageRequest, ConvertToImageResponse
from app.services.convert_service import ConvertService

router = APIRouter(prefix="/convert", tags=["轉換"])


@router.post("/to-image", response_model=ConvertToImageResponse)
async def convert_to_image(request: ConvertToImageRequest):
    """將 PDF 轉換為圖片"""
    # 從 pdf.py 導入 pdf_files
    from app.routers.pdf import pdf_files

    if request.pdfId not in pdf_files:
        raise HTTPException(status_code=404, detail="PDF 檔案不存在")

    # 驗證格式
    if request.format.lower() not in ["jpg", "png"]:
        raise HTTPException(
            status_code=400,
            detail="不支援的格式，請使用 jpg 或 png"
        )

    # 驗證 DPI
    if request.dpi not in [72, 150, 300]:
        raise HTTPException(
            status_code=400,
            detail="不支援的 DPI，請使用 72、150 或 300"
        )

    try:
        # 轉換為圖片
        zip_path, image_count = ConvertService.convert_to_images(
            pdf_files[request.pdfId],
            request.format.lower(),
            request.dpi,
            request.selectedPageNumbers if request.pages == "selected" else None
        )

        # 返回下載 URL
        filename = zip_path.name
        return ConvertToImageResponse(
            zipUrl=f"/api/convert/download/{filename}",
            imageCount=image_count,
            format=request.format.lower()
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{filename}")
async def download_file(filename: str):
    """下載處理後的檔案"""
    file_path = OUTPUTS_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="檔案不存在")

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream"
    )
