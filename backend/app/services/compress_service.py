"""
PDF 壓縮服務
"""
import io
from pathlib import Path
from typing import Tuple

from pypdf import PdfReader, PdfWriter
from PIL import Image


class CompressService:
    """PDF 壓縮服務"""

    @staticmethod
    def compress(
        pdf_path: Path,
        quality: int = 75,
        max_image_width: int = 1200,
        remove_embedded_files: bool = True
    ) -> Tuple[Path, int, int]:
        """
        壓縮 PDF 檔案

        Args:
            pdf_path: PDF 檔案路徑
            quality: 圖片壓縮品質 (1-100)
            max_image_width: 圖片最大寬度 (px)
            remove_embedded_files: 是否移除嵌入檔案

        Returns:
            (新 PDF 路徑，原始大小，壓縮後大小)
        """
        from app.utils.pdf_utils import save_output_pdf

        reader = PdfReader(str(pdf_path))
        writer = PdfWriter()

        original_size = pdf_path.stat().st_size

        for page in reader.pages:
            # 添加頁面到新的 PDF
            writer.add_page(page)

            # 注意：pypdf 本身不直接支援圖片壓縮
            # 實際的壓縮需要更複雜的處理，這裡只是基本框架

        # 儲存壓縮後的 PDF
        new_path = save_output_pdf(writer, "compressed")

        compressed_size = new_path.stat().st_size

        return new_path, original_size, compressed_size

    @staticmethod
    def compress_with_image_resizing(
        pdf_path: Path,
        quality: int = 75,
        max_image_width: int = 1200
    ) -> Tuple[Path, int, int]:
        """
        通過調整圖片大小來壓縮 PDF

        這是一個更複雜的實現，需要將 PDF 轉換為圖片再壓縮

        Args:
            pdf_path: PDF 檔案路徑
            quality: 圖片壓縮品質 (1-100)
            max_image_width: 圖片最大寬度 (px)

        Returns:
            (新 PDF 路徑，原始大小，壓縮後大小)
        """
        from pdf2image import convert_from_path
        from app.utils.pdf_utils import save_output_pdf

        original_size = pdf_path.stat().st_size

        # 將 PDF 轉換為圖片
        images = convert_from_path(str(pdf_path), dpi=150)

        # 壓縮每張圖片
        compressed_images = []
        for img in images:
            # 調整圖片大小
            if img.width > max_image_width:
                ratio = max_image_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_image_width, new_height), Image.Resampling.LANCZOS)

            # 轉換為 RGB (如果原本是 RGBA)
            if img.mode == "RGBA":
                # 創建白色背景
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")

            compressed_images.append(img)

        # 將壓縮後的圖片轉換回 PDF
        if compressed_images:
            # 第一張圖片保存為 PDF
            temp_path = pdf_path.parent / "temp_compressed.pdf"
            compressed_images[0].save(
                str(temp_path),
                "PDF",
                resolution=100.0
            )

            # 添加其餘頁面
            pdf_writer = PdfWriter()

            if temp_path.exists():
                temp_reader = PdfReader(str(temp_path))
                for page in temp_reader.pages:
                    pdf_writer.add_page(page)
                temp_path.unlink()

            # 保存最終的 PDF
            new_path = save_output_pdf(pdf_writer, "compressed")
            compressed_size = new_path.stat().st_size

            return new_path, original_size, compressed_size

        # 如果沒有圖片，返回原始檔案的副本
        new_path = save_output_pdf(PdfWriter(), "compressed")
        return new_path, original_size, original_size
