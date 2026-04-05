"""
PDF 基本處理服務
"""
import io
from pathlib import Path
from typing import List, Tuple

from pypdf import PdfReader, PdfWriter
from PIL import Image, ImageDraw, ImageFont

from app.config import OUTPUTS_DIR, PAPER_SIZES
from app.utils.pdf_utils import (
    generate_unique_id,
    get_pdf_page_count,
    get_pdf_page_info,
    get_preset_size,
    validate_page_numbers,
    save_output_pdf,
    copy_pdf,
)


class PDFService:
    """PDF 基本操作服務"""

    @staticmethod
    def delete_pages(pdf_path: Path, page_numbers: List[int]) -> Path:
        """
        刪除指定的頁面

        Args:
            pdf_path: PDF 檔案路徑
            page_numbers: 要刪除的頁面號碼列表 (1-based)

        Returns:
            新 PDF 檔案路徑
        """
        reader = PdfReader(str(pdf_path))
        writer = PdfWriter()
        total_pages = len(reader.pages)

        validate_page_numbers(page_numbers, total_pages)

        # 將不刪除的頁面加入新 PDF
        pages_to_keep = [i + 1 for i in range(total_pages) if i + 1 not in page_numbers]

        if not pages_to_keep:
            raise ValueError("不能刪除所有頁面")

        for page_num in pages_to_keep:
            writer.add_page(reader.pages[page_num - 1])

        return save_output_pdf(writer, "deleted")

    @staticmethod
    def reorder_pages(pdf_path: Path, page_order: List[int]) -> Path:
        """
        重新排序頁面

        Args:
            pdf_path: PDF 檔案路徑
            page_order: 新的頁面順序 (1-based 頁面號碼)

        Returns:
            新 PDF 檔案路徑
        """
        reader = PdfReader(str(pdf_path))
        writer = PdfWriter()
        total_pages = len(reader.pages)

        # 驗證頁面順序
        if len(page_order) != total_pages:
            raise ValueError(f"頁面順序長度 ({len(page_order)}) 與總頁面數 ({total_pages}) 不符")

        validate_page_numbers(page_order, total_pages)

        # 按照新順序添加頁面
        for page_num in page_order:
            writer.add_page(reader.pages[page_num - 1])

        return save_output_pdf(writer, "reordered")

    @staticmethod
    def resize_pages(
        pdf_path: Path,
        target_width: int,
        target_height: int,
        page_numbers: List[int] = None,
        maintain_aspect_ratio: bool = True
    ) -> Path:
        """
        調整頁面尺寸

        Args:
            pdf_path: PDF 檔案路徑
            target_width: 目標寬度 (points)
            target_height: 目標高度 (points)
            page_numbers: 要調整的頁面號碼列表，None 表示所有頁面
            maintain_aspect_ratio: 是否保持長寬比

        Returns:
            新 PDF 檔案路徑
        """
        reader = PdfReader(str(pdf_path))
        writer = PdfWriter()
        total_pages = len(reader.pages)

        # 如果沒有指定頁面，則調整所有頁面
        if page_numbers is None:
            page_numbers = list(range(1, total_pages + 1))
        else:
            validate_page_numbers(page_numbers, total_pages)

        for page_idx in range(total_pages):
            page_num = page_idx + 1
            page = reader.pages[page_idx]

            if page_num in page_numbers:
                # 獲取原始尺寸
                original_width = page.mediabox.width
                original_height = page.mediabox.height

                if maintain_aspect_ratio:
                    # 計算保持長寬比的新尺寸
                    target_ratio = target_width / target_height
                    original_ratio = original_width / original_height

                    if original_ratio > target_ratio:
                        # 原始較寬，以寬度為基準
                        new_width = target_width
                        new_height = target_width / original_ratio
                    else:
                        # 原始較高，以高度為基準
                        new_height = target_height
                        new_width = target_height * original_ratio
                else:
                    new_width = target_width
                    new_height = target_height

                # 將頁面轉換為圖片，調整大小後再轉回 PDF
                img_buffer = io.BytesIO()
                page_image = PDFService._page_to_image(page, dpi=300)
                page_image.thumbnail((int(new_width * 4), int(new_height * 4)), Image.Resampling.LANCZOS)
                page_image.save(img_buffer, format="PNG")
                img_buffer.seek(0)

                # 創建新頁面並設置尺寸
                new_page = PdfWriter().add_blank_page(width=new_width, height=new_height)

                # 注意：這裡只是設置頁面尺寸，實際內容需要更複雜的處理
                # 對於簡單的尺寸調整，我們直接修改頁面媒體框
                page.mediabox.width = new_width
                page.mediabox.height = new_height
                writer.add_page(page)
            else:
                writer.add_page(page)

        return save_output_pdf(writer, "resized")

    @staticmethod
    def _page_to_image(page, dpi: int = 300) -> Image.Image:
        """
        將 PDF 頁面轉換為 PIL Image

        Args:
            page: pypdf Page 對象
            dpi: 解析度

        Returns:
            PIL Image 對象
        """
        # 獲取頁面尺寸
        width = page.mediabox.width
        height = page.mediabox.height

        # 計算像素尺寸
        pixel_width = int(width * dpi / 72)
        pixel_height = int(height * dpi / 72)

        # 創建空白圖片
        img = Image.new("RGB", (pixel_width, pixel_height), color="white")

        # 注意：這裡只是創建空白圖片
        # 實際的頁面渲染需要使用其他庫如 pdf2image
        return img

    @staticmethod
    def get_page_info(pdf_path: Path) -> List[dict]:
        """
        獲取所有頁面的資訊

        Args:
            pdf_path: PDF 檔案路徑

        Returns:
            頁面資訊列表
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

    @staticmethod
    def get_file_size(file_path: Path) -> int:
        """獲取檔案大小 (bytes)"""
        return file_path.stat().st_size

    @staticmethod
    def merge_pdfs(pdf_paths: List[Path]) -> Path:
        """
        合併多個 PDF 檔案

        Args:
            pdf_paths: PDF 檔案路徑列表

        Returns:
            合併後的 PDF 檔案路徑
        """
        if len(pdf_paths) < 2:
            raise ValueError("至少需要兩個 PDF 檔案才能合併")

        writer = PdfWriter()

        for pdf_path in pdf_paths:
            reader = PdfReader(str(pdf_path))
            for page in reader.pages:
                writer.add_page(page)

        return save_output_pdf(writer, "merged")
