"""
PDF 基本處理服務
"""
from pathlib import Path
from typing import List, Optional

from pypdf import PdfReader, PdfWriter
from PIL import Image

from app.utils.pdf_utils import (
    get_preset_size,
    validate_page_numbers,
    save_output_pdf,
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
