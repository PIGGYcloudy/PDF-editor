"""
統一頁面尺寸服務

手機掃描或不同來源的 PDF 常有各種頁面大小。這裡以座標轉換把每頁內容
縮放置中到指定紙張上，不轉成圖片，文字、向量、連結都會保留。
"""
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pypdf import PageObject, Transformation
from pypdf.generic import (
    ArrayObject,
    FloatObject,
    NameObject,
    RectangleObject,
)

from app.utils.pdf_utils import (
    clone_pdf_writer,
    save_output_pdf,
    validate_page_numbers,
)

MM_TO_PT = 72 / 25.4

# 直式尺寸 (寬, 高)，單位 pt
PAGE_SIZE_PRESETS: Dict[str, Tuple[float, float]] = {
    "A3": (297 * MM_TO_PT, 420 * MM_TO_PT),
    "A4": (210 * MM_TO_PT, 297 * MM_TO_PT),
    "A5": (148 * MM_TO_PT, 210 * MM_TO_PT),
    "B4": (250 * MM_TO_PT, 353 * MM_TO_PT),
    "B5": (176 * MM_TO_PT, 250 * MM_TO_PT),
    "Letter": (612.0, 792.0),
    "Legal": (612.0, 1008.0),
}
ORIENTATIONS = ("auto", "portrait", "landscape")
FIT_MODES = ("fit", "fill")

# 小於這個差距 (pt) 視為相同尺寸，不重新處理頁面
SIZE_TOLERANCE = 0.5

PAGE_BOXES = ("/MediaBox", "/CropBox", "/BleedBox", "/TrimBox", "/ArtBox")
# 這些註解欄位是 x, y 交錯排列的座標陣列
ANNOTATION_POINT_ARRAYS = ("/QuadPoints", "/Vertices", "/L", "/CL")


class PageSizeService:
    """把頁面統一成指定的紙張尺寸。"""

    @staticmethod
    def normalize(
        pdf_path: Path,
        size: str,
        orientation: str = "auto",
        mode: str = "fit",
        page_numbers: Optional[List[int]] = None,
    ) -> Path:
        """
        把頁面縮放置中到指定紙張

        Args:
            pdf_path: PDF 檔案路徑
            size: PAGE_SIZE_PRESETS 的名稱，例如 "A4"
            orientation: auto 依每頁原本的方向選直式或橫式；portrait、landscape 固定方向
            mode: fit 等比縮放並完整放入，多出的地方留白；fill 等比縮放填滿頁面，裁掉超出的部分
            page_numbers: 要處理的頁碼 (1-based)，None 表示所有頁面

        Returns:
            新 PDF 檔案路徑
        """
        if size not in PAGE_SIZE_PRESETS:
            raise ValueError(f"不支援的紙張尺寸：{size}")
        if orientation not in ORIENTATIONS:
            raise ValueError("方向必須是 auto、portrait 或 landscape")
        if mode not in FIT_MODES:
            raise ValueError("縮放方式必須是 fit 或 fill")

        writer = clone_pdf_writer(pdf_path)
        total_pages = len(writer.pages)
        if page_numbers is None:
            selected = set(range(1, total_pages + 1))
        else:
            validate_page_numbers(page_numbers, total_pages)
            selected = set(page_numbers)

        for page_index, page in enumerate(writer.pages, start=1):
            if page_index in selected:
                PageSizeService._fit_page(
                    page, PAGE_SIZE_PRESETS[size], orientation, mode
                )

        return save_output_pdf(writer, "resized")

    @staticmethod
    def _fit_page(
        page: PageObject,
        preset: Tuple[float, float],
        orientation: str,
        mode: str,
    ) -> None:
        crop = RectangleObject(page.cropbox)
        left, bottom = float(crop.left), float(crop.bottom)
        width, height = float(crop.width), float(crop.height)
        if width <= 0 or height <= 0:
            return

        # 方向以使用者看到的樣子（套用 /Rotate 之後）判斷；/Rotate 保留不動，
        # 所以實際的頁面座標在 90/270 度時要把寬高對調。
        sideways = page.rotation % 180 == 90
        visual_width, visual_height = (height, width) if sideways else (width, height)
        short, long = sorted(preset)
        if orientation == "landscape" or (
            orientation == "auto" and visual_width > visual_height
        ):
            target_visual = (long, short)
        else:
            target_visual = (short, long)
        target_width, target_height = (
            (target_visual[1], target_visual[0]) if sideways else target_visual
        )

        user_unit = float(page.user_unit)
        target_width /= user_unit
        target_height /= user_unit

        ratios = (target_width / width, target_height / height)
        scale = min(ratios) if mode == "fit" else max(ratios)
        offset_x = (target_width - width * scale) / 2 - left * scale
        offset_y = (target_height - height * scale) / 2 - bottom * scale

        already_fits = (
            abs(scale - 1) * max(width, height) < SIZE_TOLERANCE
            and abs(offset_x) < SIZE_TOLERANCE
            and abs(offset_y) < SIZE_TOLERANCE
            and RectangleObject(page.mediabox) == crop
        )
        if already_fits:
            return

        PageSizeService._clip_contents(page, left, bottom, width, height)
        transformation = Transformation().scale(scale).translate(offset_x, offset_y)
        page.add_transformation(transformation)
        PageSizeService._transform_annotations(page, transformation)

        # MediaBox 與 CropBox 可能繼承自上層，一律寫在頁面上覆蓋
        new_box = RectangleObject((0, 0, target_width, target_height))
        for box in PAGE_BOXES:
            if box in page or box in ("/MediaBox", "/CropBox"):
                page[NameObject(box)] = RectangleObject(new_box)

    @staticmethod
    def _clip_contents(
        page: PageObject, left: float, bottom: float, width: float, height: float
    ) -> None:
        """
        把內容裁到原本可見的範圍

        原本被 CropBox 裁掉的內容在縮小後可能落進新頁面的留白處，必須先裁掉。
        裁切路徑寫在原座標系，之後加上的轉換矩陣會一起套用到它。
        """
        content = page.get_contents()
        if content is None:
            return
        rectangle = [FloatObject(value) for value in (left, bottom, width, height)]
        content.operations[:0] = [
            (rectangle, b"re"),
            ([], b"W"),
            ([], b"n"),
        ]
        page.replace_contents(content)

    @staticmethod
    def _transform_annotations(page: PageObject, transformation: Transformation) -> None:
        """註解（連結、螢光筆等）的座標不在內容串流裡，要另外換算。"""
        annotations = page.get("/Annots")
        if annotations is None:
            return
        for reference in annotations.get_object():
            annotation = reference.get_object()
            rect = annotation.get("/Rect")
            if isinstance(rect, ArrayObject) and len(rect) == 4:
                x1, y1 = transformation.apply_on((float(rect[0]), float(rect[1])))
                x2, y2 = transformation.apply_on((float(rect[2]), float(rect[3])))
                annotation[NameObject("/Rect")] = RectangleObject(
                    (min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2))
                )
            for key in ANNOTATION_POINT_ARRAYS:
                points = annotation.get(key)
                if isinstance(points, ArrayObject):
                    annotation[NameObject(key)] = PageSizeService._transform_points(
                        points, transformation
                    )
            ink = annotation.get("/InkList")
            if isinstance(ink, ArrayObject):
                annotation[NameObject("/InkList")] = ArrayObject(
                    PageSizeService._transform_points(stroke.get_object(), transformation)
                    for stroke in ink
                )

    @staticmethod
    def _transform_points(points: ArrayObject, transformation: Transformation) -> ArrayObject:
        values = [float(value) for value in points]
        transformed = ArrayObject()
        for index in range(0, len(values) - 1, 2):
            x, y = transformation.apply_on((values[index], values[index + 1]))
            transformed.extend((FloatObject(x), FloatObject(y)))
        return transformed
