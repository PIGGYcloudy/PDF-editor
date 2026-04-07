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
    def resize_pages(
        pdf_path: Path,
        target_width: int,
        target_height: int,
        page_numbers: Optional[List[int]] = None,
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
        from pdf2image import convert_from_path

        reader = PdfReader(str(pdf_path))
        total_pages = len(reader.pages)

        # 如果沒有指定頁面，則調整所有頁面
        if page_numbers is None:
            page_numbers = list(range(1, total_pages + 1))
        else:
            validate_page_numbers(page_numbers, total_pages)

        # 將 PDF 轉換為圖片
        images = convert_from_path(str(pdf_path), dpi=300)

        # 準備輸出圖片列表
        output_images = []

        for idx, img in enumerate(images):
            page_num = idx + 1

            if page_num in page_numbers:
                # 獲取原始尺寸
                original_width = img.width
                original_height = img.height

                # 計算目標尺寸（轉換為像素）
                # PDF points 到像素的轉換：1 point = 4 pixels (at 300 DPI)
                target_pixel_width = int(target_width * 4)
                target_pixel_height = int(target_height * 4)

                if maintain_aspect_ratio:
                    # 計算保持長寬比的新尺寸
                    target_ratio = target_pixel_width / target_pixel_height
                    original_ratio = original_width / original_height

                    if original_ratio > target_ratio:
                        # 原始較寬，以寬度為基準
                        new_width = target_pixel_width
                        new_height = int(target_pixel_width / original_ratio)
                    else:
                        # 原始較高，以高度為基準
                        new_height = target_pixel_height
                        new_width = int(target_pixel_height * original_ratio)
                else:
                    new_width = target_pixel_width
                    new_height = target_pixel_height

                # 調整圖片大小
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            output_images.append(img)

        # 將圖片轉換回 PDF
        if output_images:
            # 第一張圖片保存為 PDF
            temp_path = pdf_path.parent / "temp_resized.pdf"
            output_images[0].save(
                str(temp_path),
                "PDF",
                resolution=100.0
            )

            # 添加其餘頁面
            pdf_writer = PdfWriter()
            temp_reader = PdfReader(str(temp_path))

            for page in temp_reader.pages:
                pdf_writer.add_page(page)

            temp_path.unlink()

            return save_output_pdf(pdf_writer, "resized")

        return save_output_pdf(PdfWriter(), "resized")

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
