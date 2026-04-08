"""
PDF 浮水印服務
"""
from pathlib import Path
from typing import List, Optional

from pypdf import PdfReader, PdfWriter
from PIL import Image, ImageDraw, ImageFont

from app.utils.pdf_utils import save_output_pdf, hex_to_rgb, validate_page_numbers


class WatermarkService:
    """PDF 浮水印服務"""

    @staticmethod
    def add_text_watermark(
        pdf_path: Path,
        text: str,
        position: str = "center",
        font_size: int = 48,
        font_family: str = "Helvetica",
        color: str = "#FF0000",
        opacity: float = 0.3,
        rotation: int = 45,
        page_numbers: Optional[List[int]] = None
    ) -> Path:
        """
        添加文字浮水印到 PDF

        Args:
            pdf_path: PDF 檔案路徑
            text: 浮水印文字
            position: 位置 (center, top-left, top-right, bottom-left, bottom-right)
            font_size: 字體大小 (pt)
            font_family: 字體家族
            color: 顏色 (hex)
            opacity: 透明度 (0-1)
            rotation: 旋轉角度 (度)
            page_numbers: 要添加浮水印的頁面，None 表示所有頁面

        Returns:
            新 PDF 檔案路徑
        """
        from pdf2image import convert_from_path

        reader = PdfReader(str(pdf_path))
        total_pages = len(reader.pages)

        # 如果沒有指定頁面，則添加至所有頁面
        if page_numbers is None:
            page_numbers = list(range(1, total_pages + 1))
        else:
            validate_page_numbers(page_numbers, total_pages)

        # 將 PDF 轉換為圖片
        images = convert_from_path(str(pdf_path), dpi=150)

        # 處理每頁
        processed_images = []
        for idx, img in enumerate(images):
            page_num = idx + 1

            if page_num in page_numbers:
                # 添加浮水印
                img = WatermarkService._add_text_watermark_to_image(
                    img, text, position, font_size, color, opacity, rotation
                )

            processed_images.append(img)

        # 將圖片轉換回 PDF
        if processed_images:
            # 使用 PIL 直接保存所有圖片為 PDF
            output_path = pdf_path.parent / "temp_watermark.pdf"
            processed_images[0].save(
                str(output_path),
                "PDF",
                resolution=100.0,
                save_all=True,
                append_images=processed_images[1:]
            )

            # 讀取並重新保存以確保格式正確
            writer = PdfWriter()
            temp_reader = PdfReader(str(output_path))

            for page in temp_reader.pages:
                writer.add_page(page)

            output_path.unlink()

            return save_output_pdf(writer, "watermarked")

        return save_output_pdf(PdfWriter(), "watermarked")

    @staticmethod
    def _add_text_watermark_to_image(
        image: Image.Image,
        text: str,
        position: str,
        font_size: int,
        color: str,
        opacity: float,
        rotation: int
    ) -> Image.Image:
        """
        在圖片上添加文字浮水印

        Args:
            image: PIL Image 對象
            text: 浮水印文字
            position: 位置
            font_size: 字體大小（基準值，會根據頁面尺寸自動調整）
            color: 顏色 (hex)
            opacity: 透明度
            rotation: 旋轉角度

        Returns:
            帶有浮水印的圖片
        """
        # 轉換為 RGBA 模式以支援透明度
        if image.mode != "RGBA":
            image = image.convert("RGBA")

        # 根據頁面尺寸自動調整字體大小
        img_width, img_height = image.size
        # 以頁面寬度的 15-20% 作為字體大小，確保可讀性
        auto_font_size = int(min(img_width, img_height) * 0.15)
        # 確保字體大小不會太小
        auto_font_size = max(auto_font_size, 24)

        # 嘗試載入粗體字體
        font_paths = [
            "arialbd.ttf",      # Arial Bold
            "arialb.ttf",       # Arial Bold (alternative)
            "arial.ttf",        # Arial (fallback)
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/arialb.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ]
        
        font = None
        for font_path in font_paths:
            try:
                font = ImageFont.truetype(font_path, auto_font_size)
                break
            except (OSError, FileNotFoundError):
                continue
        
        if font is None:
            font = ImageFont.load_default()

        # 創建僅包含文字的圖層
        draw_temp = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
        bbox = draw_temp.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        text_layer = Image.new('RGBA', (text_width, text_height), (0, 0, 0, 0))
        text_draw = ImageDraw.Draw(text_layer)

        # 設置顏色（包含透明度）
        rgb_color = hex_to_rgb(color)
        alpha = int(255 * opacity)
        text_color = (*rgb_color, alpha)
        text_draw.text((0, 0), text, font=font, fill=text_color)

        # 旋轉文字圖層
        if rotation != 0:
            text_layer = text_layer.rotate(
                rotation,
                expand=True,
                resample=Image.BICUBIC,
                fillcolor=(0, 0, 0, 0)
            )

        # 計算位置
        text_layer_width, text_layer_height = text_layer.size
        img_width, img_height = image.size

        if position == "center":
            x = (img_width - text_layer_width) // 2
            y = (img_height - text_layer_height) // 2
        elif position == "top-left":
            x = 10
            y = 10
        elif position == "top-right":
            x = img_width - text_layer_width - 10
            y = 10
        elif position == "bottom-left":
            x = 10
            y = img_height - text_layer_height - 10
        elif position == "bottom-right":
            x = img_width - text_layer_width - 10
            y = img_height - text_layer_height - 10
        else:
            x = (img_width - text_layer_width) // 2
            y = (img_height - text_layer_height) // 2

        # 創建透明圖層並合成
        watermark_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
        watermark_layer.paste(text_layer, (x, y), text_layer)

        # 合併圖層
        image = Image.alpha_composite(image, watermark_layer)

        return image

    @staticmethod
    def add_image_watermark(
        pdf_path: Path,
        watermark_image_path: Path,
        position: str = "center",
        opacity: float = 0.5,
        image_width: Optional[int] = None,
        page_numbers: Optional[List[int]] = None
    ) -> Path:
        """
        添加圖片浮水印到 PDF

        Args:
            pdf_path: PDF 檔案路徑
            watermark_image_path: 浮水印圖片路徑
            position: 位置 (center, top-left, top-right, bottom-left, bottom-right)
            opacity: 透明度 (0-1)
            image_width: 浮水印圖片寬度 (px)，None 表示使用原始寬度
            page_numbers: 要添加浮水印的頁面，None 表示所有頁面

        Returns:
            新 PDF 檔案路徑
        """
        from pdf2image import convert_from_path

        reader = PdfReader(str(pdf_path))
        total_pages = len(reader.pages)

        # 如果沒有指定頁面，則添加至所有頁面
        if page_numbers is None:
            page_numbers = list(range(1, total_pages + 1))
        else:
            validate_page_numbers(page_numbers, total_pages)

        # 載入浮水印圖片
        watermark_img = Image.open(watermark_image_path)
        if watermark_img.mode != "RGBA":
            watermark_img = watermark_img.convert("RGBA")

        # 調整浮水印大小
        if image_width is not None:
            ratio = image_width / watermark_img.width
            new_height = int(watermark_img.height * ratio)
            watermark_img = watermark_img.resize((image_width, new_height), Image.Resampling.LANCZOS)

        # 將 PDF 轉換為圖片
        images = convert_from_path(str(pdf_path), dpi=150)

        # 處理每頁
        processed_images = []
        for idx, img in enumerate(images):
            page_num = idx + 1

            if page_num in page_numbers:
                # 添加浮水印
                img = WatermarkService._add_image_watermark_to_image(
                    img, watermark_img, position, opacity
                )

            processed_images.append(img)

        # 將圖片轉換回 PDF
        if processed_images:
            # 使用 PIL 直接保存所有圖片為 PDF
            output_path = pdf_path.parent / "temp_watermark_img.pdf"
            processed_images[0].save(
                str(output_path),
                "PDF",
                resolution=100.0,
                save_all=True,
                append_images=processed_images[1:]
            )

            # 讀取並重新保存以確保格式正確
            writer = PdfWriter()
            temp_reader = PdfReader(str(output_path))

            for page in temp_reader.pages:
                writer.add_page(page)

            output_path.unlink()

            return save_output_pdf(writer, "watermarked")

        return save_output_pdf(PdfWriter(), "watermarked")

    @staticmethod
    def _add_image_watermark_to_image(
        image: Image.Image,
        watermark: Image.Image,
        position: str,
        opacity: float
    ) -> Image.Image:
        """
        在圖片上添加圖片浮水印

        Args:
            image: PIL Image 對象
            watermark: 浮水印圖片
            position: 位置
            opacity: 透明度

        Returns:
            帶有浮水印的圖片
        """
        # 轉換為 RGBA 模式
        if image.mode != "RGBA":
            image = image.convert("RGBA")

        # 調整透明度
        if opacity < 1.0:
            # 創建透明度圖層
            alpha = watermark.split()[3] if watermark.mode == "RGBA" else None
            alpha = alpha.point(lambda x: int(x * opacity)) if alpha else None
            watermark = watermark.copy()
            if alpha:
                watermark.putalpha(alpha)

        # 計算位置
        img_width, img_height = image.size
        wm_width, wm_height = watermark.size

        if position == "center":
            x = (img_width - wm_width) // 2
            y = (img_height - wm_height) // 2
        elif position == "top-left":
            x = 10
            y = 10
        elif position == "top-right":
            x = img_width - wm_width - 10
            y = 10
        elif position == "bottom-left":
            x = 10
            y = img_height - wm_height - 10
        elif position == "bottom-right":
            x = img_width - wm_width - 10
            y = img_height - wm_height - 10
        else:
            x = (img_width - wm_width) // 2
            y = (img_height - wm_height) // 2

        # 創建透明圖層
        watermark_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
        watermark_layer.paste(watermark, (x, y), watermark)

        # 合併圖層
        image = Image.alpha_composite(image, watermark_layer)

        return image
