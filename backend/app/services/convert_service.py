"""
PDF 格式轉換服務
"""
import io
import re
import shutil
import zipfile
from pathlib import Path
from typing import List, Optional

from PIL import Image

from app.config import OUTPUTS_DIR
from app.utils.pdf_utils import (
    generate_unique_id,
    get_pdf_page_count,
    render_page,
    validate_page_numbers,
)

ZIP_FILENAME_PATTERN = re.compile(
    r"pdf_images_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.zip"
)


class ConvertService:
    """PDF 格式轉換服務"""

    @staticmethod
    def resolve_zip_path(filename: str) -> Optional[Path]:
        """
        找出 convert_to_images 產生的 ZIP

        只接受轉換產生的檔名格式，避免下載端點取得 outputs 中的其他檔案。

        Args:
            filename: ZIP 檔案名稱

        Returns:
            ZIP 路徑；檔名不符或檔案不存在時回傳 None
        """
        if not ZIP_FILENAME_PATTERN.fullmatch(filename):
            return None
        zip_path = OUTPUTS_DIR / filename
        return zip_path if zip_path.is_file() else None

    @staticmethod
    def convert_to_images(
        pdf_path: Path,
        output_format: str = "jpg",
        dpi: int = 150,
        page_numbers: Optional[List[int]] = None
    ) -> tuple[Path, int]:
        """
        將 PDF 轉換為圖片

        Args:
            pdf_path: PDF 檔案路徑
            output_format: 輸出格式 ("jpg" 或 "png")
            dpi: 解析度
            page_numbers: 要轉換的頁面，None 表示所有頁面

        Returns:
            (ZIP 檔案路徑，圖片數量)
        """
        total_pages = get_pdf_page_count(pdf_path)

        # 如果沒有指定頁面，則轉換所有頁面
        if page_numbers is None:
            page_numbers = list(range(1, total_pages + 1))
        else:
            validate_page_numbers(page_numbers, total_pages)

        # 創建輸出目錄
        unique_id = generate_unique_id()
        output_dir = OUTPUTS_DIR / f"images_{unique_id}"
        output_dir.mkdir(exist_ok=True)

        # 逐頁轉換，避免非連續頁面時的索引錯位問題
        format_ext = "jpg" if output_format.lower() == "jpg" else "png"
        format_mime = "jpeg" if format_ext == "jpg" else "png"
        image_count = 0

        for page_num in page_numbers:
            # 轉換單頁為圖片
            img = render_page(pdf_path, page_num, dpi)

            # 轉換為 RGB (如果格式是 JPG)
            if format_ext == "jpg" and img.mode != "RGB":
                if img.mode == "RGBA":
                    # 創建白色背景
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3])
                    img = background
                else:
                    img = img.convert("RGB")

            # 保存圖片
            image_filename = f"page_{page_num:04d}.{format_ext}"
            image_path = output_dir / image_filename
            img.save(str(image_path), format=format_mime.upper())
            image_count += 1

        # 創建 ZIP 檔案
        zip_filename = f"pdf_images_{unique_id}.zip"
        zip_path = OUTPUTS_DIR / zip_filename

        with zipfile.ZipFile(str(zip_path), 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for image_file in output_dir.iterdir():
                zip_file.write(image_file, arcname=image_file.name)

        # 刪除臨時目錄
        shutil.rmtree(output_dir)

        return zip_path, image_count

    @staticmethod
    def convert_single_page_to_image(
        pdf_path: Path,
        page_number: int,
        output_format: str = "jpg",
        dpi: int = 150
    ) -> bytes:
        """
        將 PDF 單頁轉換為圖片

        Args:
            pdf_path: PDF 檔案路徑
            page_number: 頁面號碼 (1-based)
            output_format: 輸出格式 ("jpg" 或 "png")
            dpi: 解析度

        Returns:
            圖片的 bytes
        """
        img = render_page(pdf_path, page_number, dpi)

        # 轉換為 RGB (如果格式是 JPG)
        if output_format.lower() == "jpg" and img.mode != "RGB":
            if img.mode == "RGBA":
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            else:
                img = img.convert("RGB")

        # 保存為 bytes
        buffer = io.BytesIO()
        format_mime = "JPEG" if output_format.lower() == "jpg" else "PNG"
        img.save(buffer, format=format_mime)
        buffer.seek(0)

        return buffer.getvalue()
