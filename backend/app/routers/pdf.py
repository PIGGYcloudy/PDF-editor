"""
PDF 處理路由
"""
import io
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse

from app.config import UPLOADS_DIR, OUTPUTS_DIR, MAX_FILE_SIZE, PAPER_SIZES, CORS_ORIGINS
from app.models.schemas import (
    DeletePagesRequest,
    DeletePagesResponse,
    ReorderPagesRequest,
    ReorderPagesResponse,
    ResizeRequest,
    ResizeResponse,
    CompressRequest,
    CompressResponse,
    WatermarkTextRequest,
    WatermarkResponse,
    PagesResponse,
    UploadResponse,
    PDFFile,
)
from app.utils.pdf_utils import (
    generate_unique_id,
    get_pdf_page_count,
    get_pdf_page_info,
    generate_thumbnail,
    save_uploaded_file,
    get_preset_size,
)
from app.services.pdf_service import PDFService
from app.services.compress_service import CompressService
from app.services.watermark_service import WatermarkService

router = APIRouter(prefix="/pdf", tags=["PDF"])


# 建立 PDF 檔案 ID 到路徑的映射
pdf_files: dict[str, Path] = {}


@router.post("/upload", response_model=UploadResponse)
async def upload_pdf(files: List[UploadFile] = File(...)):
    """上傳 PDF 檔案"""
    if not files:
        raise HTTPException(status_code=400, detail="沒有上傳任何檔案")

    uploaded_files = []

    for file in files:
        # 檢查檔案類型
        if file.content_type != "application/pdf":
            raise HTTPException(
                status_code=400,
                detail=f"檔案類型不支援：{file.filename} (需要 PDF 格式)"
            )

        # 讀取檔案內容
        content = await file.read()

        # 檢查檔案大小
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"檔案超過大小限制：{file.filename} (最大 50MB)"
            )

        # 儲存檔案
        file_path = save_uploaded_file(content, file.filename)
        file_id = file_path.stem.split("_")[0]  # 提取 UUID

        # 獲取頁面數量
        page_count = get_pdf_page_count(file_path)

        # 儲存映射
        pdf_files[file_id] = file_path

        uploaded_files.append(PDFFile(
            id=file_id,
            name=file.filename,
            size=len(content),
            pageCount=page_count,
            uploadedAt=datetime.now()
        ))

    return UploadResponse(files=uploaded_files)


@router.get("/pages/{pdf_id}", response_model=PagesResponse)
async def get_pages(pdf_id: str, thumbnail_size: str = "medium"):
    """獲取 PDF 頁面資訊"""
    if pdf_id not in pdf_files:
        raise HTTPException(status_code=404, detail="PDF 檔案不存在")

    pdf_path = pdf_files[pdf_id]
    pages_info = PDFService.get_page_info(pdf_path)

    # 添加縮圖 URL
    for page in pages_info:
        page["thumbnailUrl"] = f"/api/thumbnail/{pdf_id}/page/{page['pageNumber']}?size={thumbnail_size}"

    return PagesResponse(
        pdfId=pdf_id,
        pageCount=len(pages_info),
        pages=pages_info
    )


@router.post("/delete-pages", response_model=DeletePagesResponse)
async def delete_pages(request: DeletePagesRequest):
    """刪除指定的頁面"""
    if request.pdfId not in pdf_files:
        raise HTTPException(status_code=404, detail="PDF 檔案不存在")

    try:
        new_path = PDFService.delete_pages(
            pdf_files[request.pdfId],
            request.pageNumbers
        )

        # 獲取新檔案 ID
        new_id = new_path.stem.split("_")[1]  # 提取 UUID

        # 儲存映射
        pdf_files[new_id] = new_path

        # 獲取剩餘頁面數
        remaining_pages = get_pdf_page_count(new_path)

        return DeletePagesResponse(
            newPdfId=new_id,
            deletedPages=request.pageNumbers,
            remainingPages=remaining_pages
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reorder-pages", response_model=ReorderPagesResponse)
async def reorder_pages(request: ReorderPagesRequest):
    """重新排序頁面"""
    if request.pdfId not in pdf_files:
        raise HTTPException(status_code=404, detail="PDF 檔案不存在")

    try:
        new_path = PDFService.reorder_pages(
            pdf_files[request.pdfId],
            request.pageOrder
        )

        # 獲取新檔案 ID
        new_id = new_path.stem.split("_")[1]

        # 儲存映射
        pdf_files[new_id] = new_path

        # 獲取頁面數
        page_count = get_pdf_page_count(new_path)

        return ReorderPagesResponse(
            newPdfId=new_id,
            pageCount=page_count
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/resize", response_model=ResizeResponse)
async def resize_pages(request: ResizeRequest):
    """調整頁面尺寸"""
    if request.pdfId not in pdf_files:
        raise HTTPException(status_code=404, detail="PDF 檔案不存在")

    # 獲取目標尺寸
    if request.targetSize.preset:
        target_width, target_height = get_preset_size(request.targetSize.preset)
    elif request.targetSize.customWidth and request.targetSize.customHeight:
        target_width = request.targetSize.customWidth
        target_height = request.targetSize.customHeight
    else:
        raise HTTPException(
            status_code=400,
            detail="請指定預設尺寸或自訂尺寸"
        )

    try:
        new_path = PDFService.resize_pages(
            pdf_files[request.pdfId],
            target_width,
            target_height,
            request.selectedPageNumbers if request.pages == "selected" else None,
            request.maintainAspectRatio
        )

        # 獲取新檔案 ID
        new_id = new_path.stem.split("_")[1]

        # 儲存映射
        pdf_files[new_id] = new_path

        return ResizeResponse(
            newPdfId=new_id,
            newSize={"width": target_width, "height": target_height}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/compress", response_model=CompressResponse)
async def compress_pdf(request: CompressRequest):
    """壓縮 PDF"""
    if request.pdfId not in pdf_files:
        raise HTTPException(status_code=404, detail="PDF 檔案不存在")

    try:
        new_path, original_size, compressed_size = CompressService.compress(
            pdf_files[request.pdfId],
            request.quality,
            request.maxImageWidth,
            request.removeEmbeddedFiles
        )

        # 獲取新檔案 ID
        new_id = new_path.stem.split("_")[1]

        # 儲存映射
        pdf_files[new_id] = new_path

        # 計算壓縮比
        compression_ratio = ((1 - compressed_size / original_size) * 100) if original_size > 0 else 0

        return CompressResponse(
            newPdfId=new_id,
            originalSize=original_size,
            compressedSize=compressed_size,
            compressionRatio=round(compression_ratio, 2)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/watermark/text", response_model=WatermarkResponse)
async def add_text_watermark(request: WatermarkTextRequest):
    """添加文字浮水印"""
    if request.pdfId not in pdf_files:
        raise HTTPException(status_code=404, detail="PDF 檔案不存在")

    try:
        new_path = WatermarkService.add_text_watermark(
            pdf_files[request.pdfId],
            request.text,
            request.position,
            request.fontSize,
            request.fontFamily,
            request.color,
            request.opacity,
            request.rotation,
            request.selectedPageNumbers if request.pages == "selected" else None
        )

        # 獲取新檔案 ID
        new_id = new_path.stem.split("_")[1]

        # 儲存映射
        pdf_files[new_id] = new_path

        return WatermarkResponse(newPdfId=new_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/watermark/image", response_model=WatermarkResponse)
async def add_image_watermark(
    pdfId: str = Form(...),
    image: UploadFile = File(...),
    position: str = Form("center"),
    opacity: float = Form(0.5),
    imageWidth: Optional[int] = Form(None),
    pages: str = Form("all"),
    selectedPageNumbers: Optional[str] = Form(None)
):
    """添加圖片浮水印"""
    if pdfId not in pdf_files:
        raise HTTPException(status_code=404, detail="PDF 檔案不存在")

    # 檢查圖片類型
    allowed_image_types = ["image/png", "image/jpeg", "image/jpg", "image/gif"]
    if image.content_type not in allowed_image_types:
        raise HTTPException(
            status_code=400,
            detail=f"圖片類型不支援：{image.filename}"
        )

    # 讀取並儲存圖片
    image_content = await image.read()
    image_path = OUTPUTS_DIR / f"watermark_{generate_unique_id()}.png"

    with open(image_path, "wb") as f:
        f.write(image_content)

    # 解析選定頁面
    page_numbers = None
    if pages == "selected" and selectedPageNumbers:
        try:
            page_numbers = [int(p.strip()) for p in selectedPageNumbers.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="無效的頁面號碼格式")

    try:
        new_path = WatermarkService.add_image_watermark(
            pdf_files[pdfId],
            image_path,
            position,
            opacity,
            imageWidth,
            page_numbers
        )

        # 獲取新檔案 ID
        new_id = new_path.stem.split("_")[1]

        # 儲存映射
        pdf_files[new_id] = new_path

        # 清理臨時圖片
        image_path.unlink()

        return WatermarkResponse(newPdfId=new_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/thumbnail/{pdf_id}/page/{page_number}")
async def get_thumbnail(pdf_id: str, page_number: int, size: str = "medium"):
    """獲取頁面縮圖"""
    if pdf_id not in pdf_files:
        raise HTTPException(status_code=404, detail="PDF 檔案不存在")

    try:
        thumbnail_bytes = generate_thumbnail(
            pdf_files[pdf_id],
            page_number,
            size
        )

        return StreamingResponse(
            io.BytesIO(thumbnail_bytes),
            media_type="image/png"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{pdf_id}")
async def delete_pdf(pdf_id: str):
    """刪除 PDF 檔案"""
    if pdf_id not in pdf_files:
        raise HTTPException(status_code=404, detail="PDF 檔案不存在")

    try:
        # 刪除檔案
        pdf_files[pdf_id].unlink()
        del pdf_files[pdf_id]

        return {"message": "檔案刪除成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
