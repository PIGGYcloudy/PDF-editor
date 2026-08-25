"""
PDF 浮水印服務
"""
import math
from io import BytesIO
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ArrayObject, DictionaryObject, NameObject
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from app.utils.pdf_utils import (
    clone_pdf_writer,
    hex_to_rgb,
    save_output_pdf,
    validate_page_numbers,
)


class WatermarkService:
    """以 PDF 疊加層加入浮水印，保留原文件結構與頁面尺寸。"""

    POSITIONS = {
        "center",
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
    }
    FONT_ALIASES = {
        "arial": "Helvetica",
        "arial bold": "Helvetica-Bold",
        "helvetica": "Helvetica",
        "times": "Times-Roman",
        "times new roman": "Times-Roman",
        "courier": "Courier",
    }
    CJK_FONT_NAME = "DroidSansFallback"
    CJK_FONT_PATH = Path(
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf"
    )
    RESOURCE_DICTIONARY_KEYS = {
        "/ExtGState",
        "/Font",
        "/XObject",
        "/ColorSpace",
        "/Pattern",
        "/Shading",
        "/Properties",
    }

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
        page_numbers: Optional[List[int]] = None,
    ) -> Path:
        """將文字浮水印疊加到指定頁面。"""
        if not text:
            raise ValueError("浮水印文字不能為空")
        WatermarkService._validate_common_options(position, opacity)
        if font_size < 1:
            raise ValueError("字體大小必須大於 0")

        writer = clone_pdf_writer(pdf_path, minimum_version=b"%PDF-1.4")
        selected_pages = WatermarkService._selected_pages(
            page_numbers,
            len(writer.pages),
        )
        font_name = WatermarkService._resolve_font(font_family, text)
        rgb_color = hex_to_rgb(color)
        overlay_cache = {}

        for page_index, page in enumerate(writer.pages, start=1):
            if page_index not in selected_pages:
                continue

            page_width, page_height = WatermarkService._visual_page_size(page)
            user_unit = float(page.user_unit)
            cache_key = (page_width, page_height, user_unit)
            if cache_key not in overlay_cache:
                overlay = WatermarkService._create_text_overlay(
                    page_width,
                    page_height,
                    text,
                    position,
                    font_size / user_unit,
                    font_name,
                    rgb_color,
                    opacity,
                    rotation,
                    margin=10 / user_unit,
                )
                overlay_cache[cache_key] = PdfReader(overlay).pages[0]
            WatermarkService._merge_overlay(
                page,
                overlay_cache[cache_key],
            )

        return save_output_pdf(writer, "watermarked")

    @staticmethod
    def add_image_watermark(
        pdf_path: Path,
        watermark_image_path: Path,
        position: str = "center",
        opacity: float = 0.5,
        image_width: Optional[int] = None,
        page_numbers: Optional[List[int]] = None,
    ) -> Path:
        """將圖片浮水印疊加到指定頁面。"""
        WatermarkService._validate_common_options(position, opacity)
        if image_width is not None and image_width < 1:
            raise ValueError("浮水印圖片寬度必須大於 0")

        with Image.open(watermark_image_path) as source_image:
            watermark_image = source_image.convert("RGBA")

        writer = clone_pdf_writer(pdf_path, minimum_version=b"%PDF-1.4")
        selected_pages = WatermarkService._selected_pages(
            page_numbers,
            len(writer.pages),
        )
        overlay_cache = {}

        for page_index, page in enumerate(writer.pages, start=1):
            if page_index not in selected_pages:
                continue

            page_width, page_height = WatermarkService._visual_page_size(page)
            user_unit = float(page.user_unit)
            cache_key = (page_width, page_height, user_unit)
            if cache_key not in overlay_cache:
                overlay = WatermarkService._create_image_overlay(
                    page_width,
                    page_height,
                    watermark_image,
                    position,
                    opacity,
                    image_width,
                    user_unit,
                )
                overlay_cache[cache_key] = PdfReader(overlay).pages[0]
            WatermarkService._merge_overlay(
                page,
                overlay_cache[cache_key],
            )

        return save_output_pdf(writer, "watermarked")

    @staticmethod
    def _selected_pages(
        page_numbers: Optional[List[int]],
        total_pages: int,
    ) -> set[int]:
        if page_numbers is None:
            return set(range(1, total_pages + 1))

        validate_page_numbers(page_numbers, total_pages)
        if not page_numbers:
            raise ValueError("至少需要選擇一個頁面")
        return set(page_numbers)

    @staticmethod
    def _validate_common_options(position: str, opacity: float) -> None:
        if position not in WatermarkService.POSITIONS:
            raise ValueError(f"無效的浮水印位置：{position}")
        if not 0 <= opacity <= 1:
            raise ValueError("透明度必須介於 0 和 1")

    @staticmethod
    def _resolve_font(font_family: str, text: str) -> str:
        if WatermarkService._contains_cjk(text):
            try:
                pdfmetrics.getFont(WatermarkService.CJK_FONT_NAME)
            except KeyError:
                if not WatermarkService.CJK_FONT_PATH.exists():
                    raise ValueError("伺服器缺少中文字型，無法建立中文浮水印")
                pdfmetrics.registerFont(
                    TTFont(
                        WatermarkService.CJK_FONT_NAME,
                        WatermarkService.CJK_FONT_PATH,
                    )
                )
            return WatermarkService.CJK_FONT_NAME

        try:
            text.encode("cp1252")
        except UnicodeEncodeError:
            raise ValueError("目前字型不支援輸入的字元")

        requested_font = font_family.strip()
        alias = WatermarkService.FONT_ALIASES.get(
            requested_font.lower(),
            requested_font,
        )
        try:
            pdfmetrics.getFont(alias)
            return alias
        except KeyError:
            raise ValueError(f"不支援的字體：{font_family}")

    @staticmethod
    def _contains_cjk(text: str) -> bool:
        return any(
            "\u3400" <= character <= "\u4dbf"
            or "\u4e00" <= character <= "\u9fff"
            or "\uf900" <= character <= "\ufaff"
            for character in text
        )

    @staticmethod
    def _merge_overlay(page, overlay_page) -> None:
        WatermarkService._detach_page_resources(page)
        cropbox = page.cropbox
        left = float(cropbox.left)
        bottom = float(cropbox.bottom)
        width = float(cropbox.width)
        height = float(cropbox.height)
        rotation = page.rotation % 360
        transformation = {
            0: (1, 0, 0, 1, left, bottom),
            90: (0, 1, -1, 0, left + width, bottom),
            180: (-1, 0, 0, -1, left + width, bottom + height),
            270: (0, -1, 1, 0, left, bottom + height),
        }[rotation]
        page.merge_transformed_page(
            overlay_page,
            transformation,
            over=True,
            expand=False,
        )

    @staticmethod
    def _detach_page_resources(page) -> None:
        """
        分離頁面資源字典，避免修改到其他共用同一 `/Resources` 的頁面。

        子字典只做淺複製；實際字型與圖片的間接物件仍然共用，因此既不會
        污染未選頁面，也不會重複嵌入大型資源。
        """
        resources = page.get("/Resources")
        if resources is None:
            page[NameObject("/Resources")] = DictionaryObject()
            return

        detached_resources = DictionaryObject()
        for key, value in resources.get_object().items():
            if str(key) == "/ProcSet":
                resource_array = value.get_object()
                if isinstance(resource_array, ArrayObject):
                    detached_resources[key] = ArrayObject(resource_array)
                    continue
            if str(key) in WatermarkService.RESOURCE_DICTIONARY_KEYS:
                resource_dictionary = value.get_object()
                if isinstance(resource_dictionary, DictionaryObject):
                    detached_resources[key] = DictionaryObject(
                        resource_dictionary
                    )
                    continue
            detached_resources[key] = value

        page[NameObject("/Resources")] = detached_resources

    @staticmethod
    def _visual_page_size(page) -> Tuple[float, float]:
        width = float(page.cropbox.width)
        height = float(page.cropbox.height)
        if page.rotation % 360 in (90, 270):
            return height, width
        return width, height

    @staticmethod
    def _create_text_overlay(
        page_width: float,
        page_height: float,
        text: str,
        position: str,
        font_size: float,
        font_name: str,
        rgb_color: Tuple[int, int, int],
        opacity: float,
        rotation: int,
        margin: float,
    ) -> BytesIO:
        buffer = BytesIO()
        overlay = canvas.Canvas(
            buffer,
            pagesize=(page_width, page_height),
            pageCompression=1,
        )
        overlay.saveState()
        overlay.setFillAlpha(opacity)
        overlay.setFillColorRGB(*(channel / 255 for channel in rgb_color))
        overlay.setFont(font_name, font_size)

        text_width = pdfmetrics.stringWidth(text, font_name, font_size)
        ascent, descent = pdfmetrics.getAscentDescent(font_name, font_size)
        text_height = ascent - descent
        radians = math.radians(rotation)
        rotated_width = (
            abs(text_width * math.cos(radians))
            + abs(text_height * math.sin(radians))
        )
        rotated_height = (
            abs(text_width * math.sin(radians))
            + abs(text_height * math.cos(radians))
        )
        center_x, center_y = WatermarkService._position_center(
            page_width,
            page_height,
            rotated_width,
            rotated_height,
            position,
            margin,
        )

        overlay.translate(center_x, center_y)
        overlay.rotate(rotation)
        overlay.drawCentredString(0, -(ascent + descent) / 2, text)
        overlay.restoreState()
        overlay.showPage()
        overlay.save()
        buffer.seek(0)
        return buffer

    @staticmethod
    def _create_image_overlay(
        page_width: float,
        page_height: float,
        image: Image.Image,
        position: str,
        opacity: float,
        image_width: Optional[int],
        user_unit: float,
    ) -> BytesIO:
        # imageWidth 的公開 API 單位為 pt；未指定時則以原始像素在 150 DPI
        # 下的實體寬度作為合理預設。
        width_points = (
            float(image_width)
            if image_width is not None
            else image.width * 72 / 150
        )
        width = width_points / user_unit
        height = width * image.height / image.width

        margin = 10 / user_unit
        max_width = max(1.0, page_width - margin * 2)
        max_height = max(1.0, page_height - margin * 2)
        fit_ratio = min(1.0, max_width / width, max_height / height)
        width *= fit_ratio
        height *= fit_ratio
        center_x, center_y = WatermarkService._position_center(
            page_width,
            page_height,
            width,
            height,
            position,
            margin,
        )

        buffer = BytesIO()
        overlay = canvas.Canvas(
            buffer,
            pagesize=(page_width, page_height),
            pageCompression=1,
        )
        overlay.saveState()
        overlay.setFillAlpha(opacity)
        overlay.drawImage(
            ImageReader(image),
            center_x - width / 2,
            center_y - height / 2,
            width=width,
            height=height,
            mask="auto",
        )
        overlay.restoreState()
        overlay.showPage()
        overlay.save()
        buffer.seek(0)
        return buffer

    @staticmethod
    def _position_center(
        page_width: float,
        page_height: float,
        object_width: float,
        object_height: float,
        position: str,
        margin: float,
    ) -> Tuple[float, float]:
        if position == "center":
            return page_width / 2, page_height / 2
        if position == "top-left":
            return margin + object_width / 2, page_height - margin - object_height / 2
        if position == "top-right":
            return page_width - margin - object_width / 2, page_height - margin - object_height / 2
        if position == "bottom-left":
            return margin + object_width / 2, margin + object_height / 2
        if position == "bottom-right":
            return page_width - margin - object_width / 2, margin + object_height / 2
        raise ValueError(f"無效的浮水印位置：{position}")
