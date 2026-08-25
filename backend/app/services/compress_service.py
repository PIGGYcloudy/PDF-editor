"""
PDF 壓縮服務
"""
from io import BytesIO
from pathlib import Path
from typing import Set, Tuple

from PIL import Image
from pypdf import PdfWriter

from app.utils.pdf_utils import clone_pdf_writer, save_output_pdf


class CompressService:
    """在保留 PDF 文字、向量與頁面結構的前提下壓縮內容。"""

    @staticmethod
    def compress(
        pdf_path: Path,
        quality: int = 75,
        max_image_width: int = 1200,
        remove_embedded_files: bool = True,
    ) -> Tuple[Path, int, int]:
        """
        重壓內嵌圖片並壓縮頁面內容流。

        這個流程不會把整頁點陣化，因此可搜尋文字、向量、連結、表單與
        原始頁面尺寸都能保留。
        """
        if not 1 <= quality <= 100:
            raise ValueError("壓縮品質必須介於 1 到 100")
        if max_image_width < 1:
            raise ValueError("圖片最大寬度必須大於 0")

        original_size = pdf_path.stat().st_size
        writer = clone_pdf_writer(pdf_path, minimum_version=b"%PDF-1.5")
        processed_images: Set[Tuple[int, int]] = set()

        for page in writer.pages:
            for image_file in list(page.images):
                reference = image_file.indirect_reference
                if reference is None:
                    # pypdf 不支援原位替換 inline image；保留原始內容。
                    continue

                reference_key = (reference.idnum, reference.generation)
                if reference_key in processed_images:
                    continue
                processed_images.add(reference_key)

                image_object = reference.get_object()
                if image_object.get("/ImageMask", False):
                    # 1-bit stencil 會使用頁面當下的填色；轉成一般圖片會改變
                    # 原本語意與外觀，因此必須保留原始 XObject。
                    continue

                source_image = image_file.image
                if source_image is None:
                    continue

                filter_value = image_object.get("/Filter")
                if filter_value is None:
                    filter_names = set()
                else:
                    filter_value = filter_value.get_object()
                    filter_values = (
                        filter_value
                        if isinstance(filter_value, list)
                        else [filter_value]
                    )
                    filter_names = {
                        str(value.get_object())
                        for value in filter_values
                    }

                needs_resize = source_image.width > max_image_width
                is_lossy_source = bool(
                    filter_names & {"/DCTDecode", "/JPXDecode"}
                )
                if not needs_resize and not is_lossy_source:
                    # 未超寬的無損線稿、索引色與 CCITT/Flate 圖片保持原樣，
                    # 避免轉成 JPEG 後失真或檔案反而變大。
                    continue

                compressed_image = source_image.copy()
                if needs_resize:
                    ratio = max_image_width / compressed_image.width
                    new_height = max(1, round(compressed_image.height * ratio))
                    compressed_image = compressed_image.resize(
                        (max_image_width, new_height),
                        Image.Resampling.LANCZOS,
                    )

                if compressed_image.mode == "P":
                    target_mode = (
                        "RGBA"
                        if "transparency" in compressed_image.info
                        else "RGB"
                    )
                    compressed_image = compressed_image.convert(target_mode)
                elif compressed_image.mode == "LA":
                    compressed_image = compressed_image.convert("RGBA")
                elif compressed_image.mode not in ("RGB", "RGBA", "L", "CMYK"):
                    compressed_image = compressed_image.convert("RGB")

                try:
                    image_file.replace(
                        compressed_image,
                        quality=quality,
                        optimize=True,
                    )
                except (OSError, TypeError, ValueError):
                    # 特殊或不完整的影像物件不應讓整份 PDF 壓縮失敗。
                    continue

            page.compress_content_streams()

        if remove_embedded_files:
            CompressService._remove_embedded_files(writer)

        # pypdf 會把替換圖片留下的舊 SMask/ICC 物件，以及被移除的附件
        # stream 保留在 writer 物件表中。重新從可達物件樹 clone 一次，
        # 避免無用資料仍被寫入輸出檔。
        intermediate = BytesIO()
        writer.write(intermediate)
        intermediate.seek(0)
        writer = clone_pdf_writer(
            intermediate,
            minimum_version=b"%PDF-1.5",
        )

        output_path = save_output_pdf(writer, "compressed")
        return output_path, original_size, output_path.stat().st_size

    @staticmethod
    def compress_with_image_resizing(
        pdf_path: Path,
        quality: int = 75,
        max_image_width: int = 1200,
    ) -> Tuple[Path, int, int]:
        """保留舊有公開方法，轉由結構保留式壓縮流程處理。"""
        return CompressService.compress(
            pdf_path,
            quality,
            max_image_width,
            remove_embedded_files=False,
        )

    @staticmethod
    def _remove_embedded_files(writer: PdfWriter) -> None:
        """移除文件、頁面與註解層級的附件關聯。"""
        writer.remove_annotations("/FileAttachment")
        root = writer.root_object

        names = root.get("/Names")
        if names is not None:
            names_object = names.get_object()
            if "/EmbeddedFiles" in names_object:
                del names_object["/EmbeddedFiles"]

        if "/AF" in root:
            del root["/AF"]

        for page in writer.pages:
            if "/AF" in page:
                del page["/AF"]

            for annotation_reference in page.get("/Annots", []):
                annotation = annotation_reference.get_object()
                if "/AF" in annotation:
                    del annotation["/AF"]
