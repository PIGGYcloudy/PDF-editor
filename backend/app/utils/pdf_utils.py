"""
PDF 工具函數
"""
import io
import uuid
from pathlib import Path
from typing import BinaryIO, List, Optional, Tuple, Union

from pypdf import PdfReader, PdfWriter
from PIL import Image
from pdf2image import convert_from_path

from app.config import UPLOADS_DIR, OUTPUTS_DIR, PAPER_SIZES, THUMBNAIL_SIZES


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
    reader = PdfReader(str(pdf_path))
    return len(reader.pages)


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
    
    # 使用 pdf2image 轉換頁面為圖片
    images = convert_from_path(
        str(pdf_path),
        first_page=page_number,
        last_page=page_number,
        dpi=100
    )
    
    if not images:
        raise ValueError(f"無法轉換頁面 {page_number} 為圖片")
    
    img = images[0]
    
    # 保持長寬比縮放
    img.thumbnail(target_size, Image.Resampling.LANCZOS)
    
    # 轉換為 PNG bytes
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def save_uploaded_file(file_content: bytes, filename: str) -> Path:
    """
    儲存上傳的檔案
    
    Args:
        file_content: 檔案內容
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
        f.write(file_content)
    
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
