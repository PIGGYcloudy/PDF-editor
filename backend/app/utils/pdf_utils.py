"""
PDF 工具函數
"""
import io
import math
import os
import shutil
import threading
import uuid
from pathlib import Path
from typing import BinaryIO, List, Optional, Tuple, Union

from pypdf import PdfReader, PdfWriter
from PIL import Image
from pdf2image import convert_from_path

from app.config import (
    MAX_CONCURRENT_RENDERS,
    MAX_RENDER_PIXELS,
    OUTPUTS_DIR,
    PAPER_SIZES,
    THUMBNAIL_SIZES,
    UPLOADS_DIR,
)

# 所有 Poppler 渲染都必須經過 render_page，以此限制同時執行的數量。路由在
# threadpool 中排隊等待，不會卡住 event loop。
_render_slots = threading.BoundedSemaphore(MAX_CONCURRENT_RENDERS)


PDF_VERSION_HEADERS = (
    b"%PDF-1.0",
    b"%PDF-1.1",
    b"%PDF-1.2",
    b"%PDF-1.3",
    b"%PDF-1.4",
    b"%PDF-1.5",
    b"%PDF-1.6",
    b"%PDF-1.7",
    b"%PDF-2.0",
)


def generate_unique_id() -> str:
    """生成唯一的檔案 ID"""
    return str(uuid.uuid4())


def clone_pdf_writer(
    source: Union[Path, BinaryIO],
    minimum_version: Optional[bytes] = None,
) -> PdfWriter:
    """完整複製 PDF，並保留來源版本或提高到功能所需的最低版本。"""
    reader = PdfReader(source)
    writer = PdfWriter(clone_from=reader)
    source_header = reader.pdf_header
    if isinstance(source_header, str):
        source_header = source_header.encode("ascii")

    if source_header not in PDF_VERSION_HEADERS:
        source_header = b"%PDF-1.3"

    target_header = source_header
    if minimum_version in PDF_VERSION_HEADERS:
        target_header = PDF_VERSION_HEADERS[
            max(
                PDF_VERSION_HEADERS.index(source_header),
                PDF_VERSION_HEADERS.index(minimum_version),
            )
        ]

    writer.pdf_header = target_header
    return writer


def get_pdf_page_count(pdf_path: Path) -> int:
    """獲取 PDF 頁面數量"""
    # 傳入檔案物件讓 pypdf 按需讀取，不把整份 PDF 載入記憶體。
    with open(pdf_path, "rb") as pdf_file:
        return len(PdfReader(pdf_file).pages)


def get_pdf_page_info(pdf_path: Path) -> List[dict]:
    """
    獲取 PDF 所有頁面的資訊
    
    Args:
        pdf_path: PDF 檔案路徑
    
    Returns:
        頁面資訊列表，每個元素包含 pageNumber, width, height
    """
    reader = PdfReader(str(pdf_path))
    pages_info = []
    
    for idx, page in enumerate(reader.pages):
        width = int(page.mediabox.width)
        height = int(page.mediabox.height)
        
        pages_info.append({
            "pageNumber": idx + 1,
            "width": width,
            "height": height,
        })
    
    return pages_info


def get_single_page_size(pdf_path: Path, page_number: int) -> Tuple[int, int]:
    """
    獲取 PDF 單頁的尺寸資訊

    Args:
        pdf_path: PDF 檔案路徑
        page_number: 頁面號碼（從 1 開始）

    Returns:
        (寬度，高度) 單位為點（points）

    Raises:
        IndexError: 當 page_number 超出範圍時
    """
    reader = PdfReader(str(pdf_path))
    if page_number < 1 or page_number > len(reader.pages):
        raise IndexError(f"Page number {page_number} out of range")

    page = reader.pages[page_number - 1]
    media_box = page.mediabox
    return int(media_box.width), int(media_box.height)


def render_page(pdf_path: Path, page_number: int, dpi: int) -> Image.Image:
    """
    將 PDF 單頁渲染為圖片

    同時渲染的數量受 MAX_CONCURRENT_RENDERS 限制；頁面過大時會降低 DPI，
    讓輸出不超過 MAX_RENDER_PIXELS，避免超大頁面耗盡記憶體。

    Args:
        pdf_path: PDF 檔案路徑
        page_number: 頁面號碼 (1-based)
        dpi: 期望的解析度

    Returns:
        渲染後的圖片

    Raises:
        ValueError: 頁面號碼無效或無法渲染
    """
    # 傳入檔案物件而非路徑，pypdf 才會按需讀取，不會把整份 PDF 載入記憶體。
    with open(pdf_path, "rb") as pdf_file:
        reader = PdfReader(pdf_file)
        total_pages = len(reader.pages)
        if not 1 <= page_number <= total_pages:
            raise ValueError(
                f"無效的頁面號碼：{page_number} (有效範圍：1-{total_pages})"
            )
        page = reader.pages[page_number - 1]
        # Poppler 預設渲染 MediaBox；CropBox 只會比它小，因此以此估算較保守。
        width_inches = float(page.mediabox.width) * float(page.user_unit) / 72
        height_inches = float(page.mediabox.height) * float(page.user_unit) / 72

    page_area = width_inches * height_inches
    if page_area > 0 and dpi * dpi * page_area > MAX_RENDER_PIXELS:
        dpi = max(1, math.floor(math.sqrt(MAX_RENDER_PIXELS / page_area)))

    with _render_slots:
        images = convert_from_path(
            str(pdf_path),
            dpi=dpi,
            first_page=page_number,
            last_page=page_number,
        )

    if not images:
        raise ValueError(f"無法轉換頁面 {page_number} 為圖片")
    return images[0]


def generate_thumbnail(
    pdf_path: Path,
    page_number: int,
    size: str = "medium"
) -> bytes:
    """
    生成 PDF 頁面縮圖

    Args:
        pdf_path: PDF 檔案路徑
        page_number: 頁面號碼 (1-based)
        size: 縮圖大小 ("small", "medium", "large")

    Returns:
        PNG 圖片的 bytes
    """
    target_size = THUMBNAIL_SIZES.get(size, THUMBNAIL_SIZES["medium"])

    img = render_page(pdf_path, page_number, dpi=100)

    # 保持長寬比縮放
    img.thumbnail(target_size, Image.Resampling.LANCZOS)
    
    # 轉換為 PNG bytes
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def save_uploaded_file(source: BinaryIO, filename: str) -> Path:
    """
    儲存上傳的檔案

    Args:
        source: 上傳檔案的串流，會從目前位置分段複製
        filename: 原始檔案名稱
    
    Returns:
        儲存後的路徑
    """
    unique_id = generate_unique_id()
    safe_filename = Path(filename.replace("\\", "/")).name
    if not safe_filename:
        safe_filename = "document.pdf"

    # 確保副檔名是 .pdf
    if not safe_filename.lower().endswith('.pdf'):
        safe_filename = safe_filename + '.pdf'
    
    new_filename = f"{unique_id}_{safe_filename}"
    file_path = UPLOADS_DIR / new_filename

    with open(file_path, "wb") as f:
        shutil.copyfileobj(source, f)

    return file_path


def save_output_pdf(pdf_writer: PdfWriter, prefix: str = "output") -> Path:
    """
    儲存處理後的 PDF
    
    Args:
        pdf_writer: PdfWriter 實例
        prefix: 檔案名前綴
    
    Returns:
        儲存後的路徑
    """
    unique_id = generate_unique_id()
    filename = f"{prefix}_{unique_id}.pdf"
    file_path = OUTPUTS_DIR / filename
    
    with open(file_path, "wb") as f:
        pdf_writer.write(f)

    return file_path


def uploaded_pdf_id(file_path: Path) -> str:
    """取出 save_uploaded_file 所產生 `<id>_<原檔名>.pdf` 檔名中的 ID。"""
    return file_path.name.split("_", 1)[0]


def output_pdf_id(file_path: Path) -> str:
    """取出 save_output_pdf 所產生 `<前綴>_<id>.pdf` 檔名中的 ID。"""
    return file_path.stem.rsplit("_", 1)[-1]


def is_valid_pdf_id(pdf_id: str) -> bool:
    """ID 必須是標準格式的 UUID，確保不會被當成 glob 或路徑片段解讀。"""
    try:
        return str(uuid.UUID(pdf_id)) == pdf_id
    except ValueError:
        return False


def resolve_pdf_path(pdf_id: str) -> Optional[Path]:
    """
    依 ID 找出上傳或處理後的 PDF

    ID 直接編碼在檔名中，因此不需要程序內的索引：服務重啟或以多個
    worker 執行時都能找到檔案。找到後會更新修改時間，讓仍在使用中的
    檔案不會被過期清理刪除。

    Args:
        pdf_id: PDF 檔案 ID

    Returns:
        檔案路徑；ID 無效或檔案不存在時回傳 None
    """
    if not is_valid_pdf_id(pdf_id):
        return None

    candidates = [
        *UPLOADS_DIR.glob(f"{pdf_id}_*"),
        *OUTPUTS_DIR.glob(f"*_{pdf_id}.pdf"),
    ]
    for file_path in candidates:
        # 上傳檔保留使用者的副檔名大小寫，例如 `SCAN.PDF`。
        if file_path.suffix.lower() != ".pdf" or not file_path.is_file():
            continue
        try:
            os.utime(file_path)
        except OSError:
            pass
        return file_path

    return None


def copy_pdf(source_path: Path, new_filename: str) -> Path:
    """
    複製 PDF 檔案
    
    Args:
        source_path: 來源檔案路徑
        new_filename: 新檔案名稱
    
    Returns:
        新檔案路徑
    """
    reader = PdfReader(str(source_path))
    writer = PdfWriter()
    
    for page in reader.pages:
        writer.add_page(page)
    
    file_path = OUTPUTS_DIR / new_filename
    
    with open(file_path, "wb") as f:
        writer.write(f)
    
    return file_path


def get_preset_size(preset: str) -> Tuple[int, int]:
    """
    獲取預設紙張尺寸
    
    Args:
        preset: 尺寸名稱
    
    Returns:
        (寬度，高度) - 單位：points
    """
    if preset not in PAPER_SIZES:
        raise ValueError(f"無效的尺寸：{preset}")
    return PAPER_SIZES[preset]


def validate_page_numbers(page_numbers: List[int], total_pages: int) -> None:
    """
    驗證頁面號碼是否有效
    
    Args:
        page_numbers: 頁面號碼列表
        total_pages: 總頁面數
    
    Raises:
        ValueError: 如果頁面號碼無效
    """
    if not page_numbers:
        raise ValueError("至少需要選擇一個頁面")
    if len(page_numbers) != len(set(page_numbers)):
        raise ValueError("頁面號碼不得重複")

    for page_num in page_numbers:
        if page_num < 1 or page_num > total_pages:
            raise ValueError(f"無效的頁面號碼：{page_num} (有效範圍：1-{total_pages})")


def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """
    將 HEX 顏色轉換為 RGB
    
    Args:
        hex_color: HEX 顏色字串 (例如：#FF0000)
    
    Returns:
        (R, G, B) 元組
    """
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
