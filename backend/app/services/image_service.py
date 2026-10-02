"""
圖片轉 PDF 服務
"""
from io import BytesIO
from pathlib import Path
from typing import BinaryIO, Sequence, Tuple

from PIL import Image, ImageOps, UnidentifiedImageError
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.utils import pdf_utils

# 一次最多轉成幾頁，避免一次處理過多圖片
MAX_IMAGES = 100
# 單張圖片的像素上限，避免解壓縮炸彈耗盡記憶體
MAX_IMAGE_PIXELS = 100_000_000
# A4 頁面 (pt) 與圖片和頁面邊緣的距離
A4_SIZE = (595.2756, 841.8898)
PAGE_MARGIN = 18
# 「依圖片大小」時，以 150 DPI 換算頁面尺寸，並限制在 PDF 建議的上限內
FIT_DPI = 150
MAX_PAGE_POINTS = 14400
# 嵌入前把圖片縮到 A4 約 300 DPI 的解析度即可，不需要保留相機的完整像素
MAX_EMBED_LONG_SIDE = 3508
JPEG_QUALITY = 90

# MPO 是部分手機相機輸出的多圖 JPEG
SUPPORTED_FORMATS = {"PNG", "JPEG", "MPO", "WEBP"}

PAGE_SIZES = ("a4", "fit")


class ImageService:
    """把圖片組成 PDF，每張圖片一頁。"""

    @staticmethod
    def suggest_name(filenames: Sequence[str]) -> str:
        """依第一張圖片的檔名決定 PDF 名稱。"""
        first = Path((filenames[0] if filenames else "").replace("\\", "/")).stem
        stem = first or "images"
        if len(filenames) > 1:
            stem = f"{stem}_等{len(filenames)}張"
        return f"{stem}.pdf"

    @staticmethod
    def images_to_pdf(
        images: Sequence[Tuple[str, BinaryIO]],
        page_size: str = "a4",
    ) -> Tuple[Path, int]:
        """
        依順序把圖片放進新的 PDF

        Args:
            images: (檔名, 檔案串流) 的列表，順序就是頁面順序
            page_size: "a4" 把圖片縮放置中在 A4 頁面（依圖片方向選直式或橫式），
                "fit" 讓每頁大小等於圖片大小

        Returns:
            (PDF 路徑, 頁數)
        """
        if page_size not in PAGE_SIZES:
            raise ValueError("頁面大小必須是 a4 或 fit")
        if not images:
            raise ValueError("請至少選擇一張圖片")
        if len(images) > MAX_IMAGES:
            raise ValueError(f"一次最多轉換 {MAX_IMAGES} 張圖片")

        output_path = pdf_utils.OUTPUTS_DIR / (
            f"images_{pdf_utils.generate_unique_id()}.pdf"
        )
        try:
            pdf = canvas.Canvas(str(output_path), pageCompression=1)
            for filename, source in images:
                prepared, original_size = ImageService._prepare(source, filename)
                page_width, page_height = ImageService._page_dimensions(
                    page_size, original_size
                )
                pdf.setPageSize((page_width, page_height))
                x, y, width, height = ImageService._placement(
                    page_size, page_width, page_height, original_size
                )
                pdf.drawImage(ImageReader(prepared), x, y, width=width, height=height)
                pdf.showPage()
            pdf.save()
        except BaseException:
            output_path.unlink(missing_ok=True)
            raise

        return output_path, len(images)

    @staticmethod
    def _prepare(source: BinaryIO, filename: str) -> Tuple[BytesIO, Tuple[int, int]]:
        """讀取圖片、修正方向、轉成 RGB 並重新編碼為 JPEG。"""
        try:
            with Image.open(source) as opened:
                if opened.format not in SUPPORTED_FORMATS:
                    raise ValueError(
                        f"不支援的圖片格式：{filename}（支援 PNG、JPG、WebP）"
                    )
                if opened.width * opened.height > MAX_IMAGE_PIXELS:
                    raise ValueError(f"圖片尺寸太大：{filename}")
                image = ImageOps.exif_transpose(opened)
                image.load()
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as error:
            raise ValueError(f"無法讀取圖片：{filename}") from error

        # 手機照片的方向存在 EXIF；exif_transpose 之後的尺寸才是看到的樣子
        original_size = image.size
        if image.mode in ("RGBA", "LA") or "transparency" in image.info:
            rgba = image.convert("RGBA")
            background = Image.new("RGB", rgba.size, (255, 255, 255))
            background.paste(rgba, mask=rgba.getchannel("A"))
            image = background
        else:
            image = image.convert("RGB")

        image.thumbnail((MAX_EMBED_LONG_SIDE, MAX_EMBED_LONG_SIDE), Image.Resampling.LANCZOS)
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=JPEG_QUALITY)
        buffer.seek(0)
        return buffer, original_size

    @staticmethod
    def _page_dimensions(page_size: str, image_size: Tuple[int, int]) -> Tuple[float, float]:
        width_px, height_px = image_size
        if page_size == "fit":
            scale = 72 / FIT_DPI
            return (
                min(max(width_px * scale, 1.0), MAX_PAGE_POINTS),
                min(max(height_px * scale, 1.0), MAX_PAGE_POINTS),
            )
        short, long = A4_SIZE
        return (long, short) if width_px > height_px else (short, long)

    @staticmethod
    def _placement(
        page_size: str,
        page_width: float,
        page_height: float,
        image_size: Tuple[int, int],
    ) -> Tuple[float, float, float, float]:
        """圖片在頁面上的 (x, y, 寬, 高)；y 以頁面左下角為原點。"""
        if page_size == "fit":
            return 0, 0, page_width, page_height

        width_px, height_px = image_size
        available_width = page_width - PAGE_MARGIN * 2
        available_height = page_height - PAGE_MARGIN * 2
        scale = min(available_width / width_px, available_height / height_px)
        width = width_px * scale
        height = height_px * scale
        return (page_width - width) / 2, (page_height - height) / 2, width, height

