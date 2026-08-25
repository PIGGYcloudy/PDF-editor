from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pdf2image import convert_from_path
from pydantic import ValidationError
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
    RectangleObject,
)
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.main import app
from app.models.schemas import (
    CompressRequest,
    ConvertToImageRequest,
    DeletePagesRequest,
    WatermarkTextRequest,
)
from app.routers import pdf as pdf_router
from app.services.compress_service import CompressService
from app.services.pdf_service import PDFService
from app.services.watermark_service import WatermarkService


def create_sample_pdf(path: Path, include_image: bool = False) -> Path:
    pdf = canvas.Canvas(str(path), pagesize=A4)
    pdf.setTitle("Functional test")
    pdf.drawString(72, 780, "Original page one")
    pdf.linkURL(
        "https://example.com",
        (72, 760, 220, 790),
        relative=0,
    )

    if include_image:
        image = Image.effect_noise((1800, 1200), 80).convert("RGB")
        image_buffer = BytesIO()
        image.save(image_buffer, format="JPEG", quality=95)
        image_buffer.seek(0)
        pdf.drawImage(
            ImageReader(image_buffer),
            72,
            180,
            width=450,
            height=300,
        )

    pdf.showPage()
    pdf.drawString(72, 780, "Original page two")
    pdf.showPage()
    pdf.save()
    return path


def page_sizes(reader: PdfReader):
    return [
        (float(page.mediabox.width), float(page.mediabox.height))
        for page in reader.pages
    ]


def page_box_snapshot(page):
    return {
        name: tuple(float(value) for value in getattr(page, name))
        for name in (
            "mediabox",
            "cropbox",
            "bleedbox",
            "trimbox",
            "artbox",
        )
    }


def annotation_snapshot(page):
    snapshots = []
    for annotation_reference in page.get("/Annots", []):
        annotation = annotation_reference.get_object()
        snapshots.append(
            {
                "subtype": str(annotation.get("/Subtype")),
                "rect": tuple(float(value) for value in annotation.get("/Rect", [])),
                "quad_points": tuple(
                    float(value)
                    for value in annotation.get("/QuadPoints", [])
                ),
            }
        )
    return snapshots


def test_reorder_rejects_duplicate_or_missing_pages(tmp_path: Path):
    source = create_sample_pdf(tmp_path / "source.pdf")

    with pytest.raises(ValueError, match="不得重複"):
        PDFService.reorder_pages(source, [1, 1])


def test_text_watermark_preserves_document_structure_and_honors_font(
    tmp_path: Path,
):
    source = create_sample_pdf(tmp_path / "source.pdf")
    original = PdfReader(str(source))

    output = WatermarkService.add_text_watermark(
        source,
        "REVIEWED",
        position="center",
        font_size=24,
        font_family="Times-Roman",
        color="#008000",
        opacity=0.4,
        rotation=30,
        page_numbers=[2],
    )
    result = PdfReader(str(output))

    assert page_sizes(result) == page_sizes(original)
    assert result.pdf_header >= "%PDF-1.4"
    assert "Original page one" in result.pages[0].extract_text()
    assert "REVIEWED" not in result.pages[0].extract_text()
    assert (
        result.pages[0].get_contents().get_data()
        == original.pages[0].get_contents().get_data()
    )
    assert "Original page two" in result.pages[1].extract_text()
    assert "REVIEWED" in result.pages[1].extract_text()
    assert "/Annots" in result.pages[0]

    watermark_fonts = []

    def capture_text(text, _cm, _tm, font_dictionary, font_size):
        if "REVIEWED" in text:
            watermark_fonts.append(
                (font_dictionary.get("/BaseFont"), float(font_size))
            )

    result.pages[1].extract_text(visitor_text=capture_text)
    assert watermark_fonts == [("/Times-Roman", 24.0)]


def test_image_watermark_preserves_text_and_page_size(tmp_path: Path):
    source = create_sample_pdf(tmp_path / "source.pdf")
    watermark_path = tmp_path / "watermark.png"
    Image.new("RGBA", (240, 80), (255, 0, 0, 180)).save(watermark_path)
    original = PdfReader(str(source))

    output = WatermarkService.add_image_watermark(
        source,
        watermark_path,
        position="bottom-right",
        opacity=0.5,
        image_width=200,
        page_numbers=[1],
    )
    result = PdfReader(str(output))

    assert page_sizes(result) == page_sizes(original)
    assert "Original page one" in result.pages[0].extract_text()
    assert "Original page two" in result.pages[1].extract_text()
    assert "/Annots" in result.pages[0]


def test_image_watermark_reuses_resources_across_equal_sized_pages(
    tmp_path: Path,
):
    source = tmp_path / "many-pages.pdf"
    pdf = canvas.Canvas(str(source), pagesize=A4)
    for page_number in range(10):
        pdf.drawString(72, 780, f"Page {page_number + 1}")
        pdf.showPage()
    pdf.save()

    watermark_path = tmp_path / "shared-logo.png"
    Image.effect_noise((500, 200), 80).convert("RGBA").save(
        watermark_path
    )
    output = WatermarkService.add_image_watermark(
        source,
        watermark_path,
        image_width=200,
    )
    result = PdfReader(str(output))
    watermark_references = []
    for page in result.pages:
        xobjects = page["/Resources"]["/XObject"].get_object()
        image_references = [
            reference
            for reference in xobjects.values()
            if reference.get_object().get("/Subtype") == "/Image"
        ]
        assert len(image_references) == 1
        reference = image_references[0]
        watermark_references.append(
            (reference.idnum, reference.generation)
        )

    assert len(set(watermark_references)) == 1


def test_cjk_watermark_does_not_accumulate_resource_aliases(
    tmp_path: Path,
):
    source = tmp_path / "many-text-pages.pdf"
    pdf = canvas.Canvas(str(source), pagesize=A4)
    for page_number in range(10):
        pdf.drawString(72, 780, f"Page {page_number + 1}")
        pdf.showPage()
    pdf.save()

    output = WatermarkService.add_text_watermark(
        source,
        "機密文件",
    )
    result = PdfReader(str(output))
    cjk_references = []
    for page in result.pages:
        fonts = page["/Resources"]["/Font"].get_object()
        assert len(fonts) <= 3
        matching_references = [
            reference
            for reference in fonts.values()
            if "DroidSansFallback"
            in str(reference.get_object().get("/BaseFont"))
        ]
        assert len(matching_references) == 1
        reference = matching_references[0]
        cjk_references.append((reference.idnum, reference.generation))

    assert len(set(cjk_references)) == 1


def test_watermark_does_not_mutate_unselected_shared_resources(
    tmp_path: Path,
):
    source = tmp_path / "shared-resources.pdf"
    writer = PdfWriter()
    first_page = writer.add_blank_page(width=200, height=200)
    second_page = writer.add_blank_page(width=200, height=200)
    shared_resources = writer._add_object(
        DictionaryObject(
            {
                NameObject("/ProcSet"): ArrayObject(
                    [NameObject("/PDF")]
                )
            }
        )
    )
    first_page[NameObject("/Resources")] = shared_resources
    second_page[NameObject("/Resources")] = shared_resources
    with source.open("wb") as output_file:
        writer.write(output_file)

    output = WatermarkService.add_text_watermark(
        source,
        "SELECTED",
        page_numbers=[1],
    )
    result = PdfReader(str(output))

    assert list(result.pages[1]["/Resources"]["/ProcSet"]) == ["/PDF"]
    assert "/Font" not in result.pages[1]["/Resources"]


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_watermark_respects_rotation_cropbox_and_annotations(
    tmp_path: Path,
    rotation: int,
):
    source = tmp_path / f"rotated-{rotation}.pdf"
    pdf = canvas.Canvas(str(source), pagesize=(220, 300))
    pdf.linkURL("https://example.com", (60, 80, 100, 110), relative=0)
    pdf.showPage()
    pdf.save()

    prepared = PdfWriter(clone_from=str(source))
    prepared_page = prepared.pages[0]
    prepared_page.cropbox = RectangleObject([30, 50, 180, 250])
    prepared_page.rotation = rotation
    with source.open("wb") as output_file:
        prepared.write(output_file)

    before = PdfReader(str(source))
    boxes_before = page_box_snapshot(before.pages[0])
    annotations_before = annotation_snapshot(before.pages[0])

    watermark_path = tmp_path / "red-logo.png"
    Image.new("RGBA", (20, 10), (255, 0, 0, 255)).save(watermark_path)
    output = WatermarkService.add_image_watermark(
        source,
        watermark_path,
        position="top-left",
        opacity=1,
        image_width=20,
    )
    result = PdfReader(str(output))
    result_page = result.pages[0]

    assert result_page.rotation == rotation
    assert page_box_snapshot(result_page) == boxes_before
    assert annotation_snapshot(result_page) == annotations_before

    rendered = convert_from_path(
        str(output),
        dpi=72,
        use_cropbox=True,
        first_page=1,
        last_page=1,
    )[0].convert("RGB")
    red_mask = Image.new("1", rendered.size)
    red_mask.putdata([
        red > 180 and green < 100 and blue < 100
        for red, green, blue in rendered.getdata()
    ])
    red_bounds = red_mask.getbbox()
    assert red_bounds is not None
    assert red_bounds[0] <= 12
    assert red_bounds[1] <= 12


def test_compress_preserves_text_links_and_page_size(tmp_path: Path):
    source = create_sample_pdf(tmp_path / "source.pdf", include_image=True)
    original = PdfReader(str(source))

    output, original_size, compressed_size = CompressService.compress(
        source,
        quality=55,
        max_image_width=600,
        remove_embedded_files=False,
    )
    result = PdfReader(str(output))

    assert original_size == source.stat().st_size
    assert compressed_size == output.stat().st_size
    assert page_sizes(result) == page_sizes(original)
    assert "Original page one" in result.pages[0].extract_text()
    assert "Original page two" in result.pages[1].extract_text()
    assert "/Annots" in result.pages[0]
    assert result.pages[0].images[0].image.width <= 600
    assert result.pdf_header >= original.pdf_header


def test_compress_preserves_stencil_image_semantics(tmp_path: Path):
    source = tmp_path / "stencil.pdf"
    writer = PdfWriter()
    page = writer.add_blank_page(width=100, height=100)

    stencil = DecodedStreamObject()
    stencil.set_data(b"\xff" * 8)
    stencil.update(
        {
            NameObject("/Type"): NameObject("/XObject"),
            NameObject("/Subtype"): NameObject("/Image"),
            NameObject("/Width"): NumberObject(8),
            NameObject("/Height"): NumberObject(8),
            NameObject("/BitsPerComponent"): NumberObject(1),
            NameObject("/ImageMask"): BooleanObject(True),
            NameObject("/Decode"): ArrayObject(
                [NumberObject(0), NumberObject(1)]
            ),
        }
    )
    stencil_reference = writer._add_object(stencil)
    page[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/XObject"): DictionaryObject(
                {NameObject("/Stencil"): stencil_reference}
            )
        }
    )
    contents = DecodedStreamObject()
    contents.set_data(
        b"q 1 0 0 rg 50 0 0 50 25 25 cm /Stencil Do Q"
    )
    page[NameObject("/Contents")] = writer._add_object(contents)
    with source.open("wb") as output_file:
        writer.write(output_file)

    output, _, _ = CompressService.compress(
        source,
        quality=30,
        max_image_width=2,
        remove_embedded_files=False,
    )
    result = PdfReader(str(output))
    image_reference = (
        result.pages[0]["/Resources"]["/XObject"]["/Stencil"]
    )
    image_object = image_reference.get_object()

    assert bool(image_object["/ImageMask"]) is True
    assert image_object["/Width"] == 8
    assert image_object.get_data() == b"\xff" * 8


def test_compress_keeps_small_lossless_images_lossless(tmp_path: Path):
    source = tmp_path / "lossless.pdf"
    image = Image.new("P", (64, 64))
    image.putpalette(
        [
            255, 255, 255,
            0, 0, 0,
        ]
        + [0, 0, 0] * 254
    )
    image.putdata(
        [
            (x // 8 + y // 8) % 2
            for y in range(64)
            for x in range(64)
        ]
    )
    image_buffer = BytesIO()
    image.save(image_buffer, format="PNG")
    image_buffer.seek(0)

    pdf = canvas.Canvas(str(source), pagesize=(200, 200))
    pdf.drawImage(
        ImageReader(image_buffer),
        40,
        40,
        width=120,
        height=120,
    )
    pdf.save()

    original = PdfReader(str(source))
    original_image = (
        original.pages[0].images[0].indirect_reference.get_object()
    )
    output, _, _ = CompressService.compress(
        source,
        quality=10,
        max_image_width=1200,
        remove_embedded_files=False,
    )
    result = PdfReader(str(output))
    result_image = (
        result.pages[0].images[0].indirect_reference.get_object()
    )

    assert result_image.get("/Filter") == original_image.get("/Filter")
    assert result_image.get_data() == original_image.get_data()


def test_compress_removes_attachment_data_only_when_requested(tmp_path: Path):
    plain_source = create_sample_pdf(tmp_path / "plain.pdf")
    source = tmp_path / "with-attachment.pdf"
    attachment_data = b"ATTACHMENT-SENTINEL-" + b"x" * 200_000
    writer = PdfWriter(clone_from=str(plain_source))
    writer.add_attachment("secret.bin", attachment_data)
    filespec = (
        writer.root_object["/Names"]["/EmbeddedFiles"]["/Names"][1]
    )
    writer.pages[0][NameObject("/AF")] = ArrayObject([filespec])
    first_annotation = writer.pages[0]["/Annots"][0].get_object()
    first_annotation[NameObject("/AF")] = ArrayObject([filespec])
    with source.open("wb") as output_file:
        writer.write(output_file)

    removed_output, _, _ = CompressService.compress(
        source,
        remove_embedded_files=True,
    )
    retained_output, _, _ = CompressService.compress(
        source,
        remove_embedded_files=False,
    )

    removed_reader = PdfReader(str(removed_output))
    retained_reader = PdfReader(str(retained_output))
    assert removed_reader.attachments == {}
    assert "secret.bin" in retained_reader.attachments
    assert b"ATTACHMENT-SENTINEL-" not in removed_output.read_bytes()
    assert removed_output.stat().st_size < retained_output.stat().st_size


def test_watermark_rejects_unknown_font_and_supports_cjk(
    tmp_path: Path,
):
    source = create_sample_pdf(tmp_path / "source.pdf")

    with pytest.raises(ValueError, match="不支援的字體"):
        WatermarkService.add_text_watermark(
            source,
            "CONFIDENTIAL",
            font_family="Not-A-Real-Font",
        )

    output = WatermarkService.add_text_watermark(
        source,
        "機密文件",
        font_family="Helvetica",
        page_numbers=[1],
    )
    result = PdfReader(str(output))
    fonts = result.pages[0]["/Resources"]["/Font"].get_object()
    base_fonts = {
        str(font.get_object().get("/BaseFont"))
        for font in fonts.values()
    }
    assert any("DroidSansFallback" in font for font in base_fonts)
    assert "機密文件" in result.pages[0].extract_text()


def test_parallel_operations_create_independent_outputs(tmp_path: Path):
    source = create_sample_pdf(tmp_path / "source.pdf", include_image=True)

    with ThreadPoolExecutor(max_workers=4) as executor:
        watermark_futures = [
            executor.submit(
                WatermarkService.add_text_watermark,
                source,
                f"WM-{index}",
            )
            for index in range(2)
        ]
        compress_futures = [
            executor.submit(
                CompressService.compress,
                source,
                60,
                800,
                False,
            )
            for _ in range(2)
        ]

    paths = [future.result() for future in watermark_futures]
    paths.extend(future.result()[0] for future in compress_futures)
    assert len(set(paths)) == 4
    assert all(len(PdfReader(str(path)).pages) == 2 for path in paths)


def test_request_models_reject_inconsistent_options():
    with pytest.raises(ValidationError):
        WatermarkTextRequest(
            pdfId="pdf-id",
            text="watermark",
            pages="selected",
        )

    with pytest.raises(ValidationError):
        ConvertToImageRequest(
            pdfId="pdf-id",
            pages="selected",
        )

    with pytest.raises(ValidationError):
        CompressRequest(
            pdfId="pdf-id",
            maxImageWidth=0,
        )

    with pytest.raises(ValidationError):
        DeletePagesRequest(
            pdfId="pdf-id",
            pageNumbers=[],
        )

    with pytest.raises(ValidationError):
        ConvertToImageRequest(
            pdfId="pdf-id",
            pages="selected",
            selectedPageNumbers=[1, 1],
        )


def test_merge_returns_unique_ids(tmp_path: Path):
    source = create_sample_pdf(tmp_path / "source.pdf")
    pdf_bytes = source.read_bytes()
    client = TestClient(app)

    upload = client.post(
        "/api/pdf/upload",
        files=[
            ("files", ("one.pdf", pdf_bytes, "application/pdf")),
            ("files", ("two.pdf", pdf_bytes, "application/pdf")),
        ],
    )
    assert upload.status_code == 200
    ids = [item["id"] for item in upload.json()["files"]]

    first_merge = client.post(
        "/api/pdf/merge",
        data={"pdf_ids": ids},
    )
    second_merge = client.post(
        "/api/pdf/merge",
        data={"pdf_ids": ids},
    )

    assert first_merge.status_code == 200
    assert second_merge.status_code == 200
    first_id = first_merge.json()["newPdfId"]
    second_id = second_merge.json()["newPdfId"]
    assert first_id != "merged"
    assert second_id != "merged"
    assert first_id != second_id


def test_upload_rejects_invalid_batch_without_partial_commit(
    tmp_path: Path,
    isolated_storage,
):
    source = create_sample_pdf(tmp_path / "source.pdf")
    client = TestClient(app)

    response = client.post(
        "/api/pdf/upload",
        files=[
            (
                "files",
                ("valid.pdf", source.read_bytes(), "application/pdf"),
            ),
            (
                "files",
                ("broken.pdf", b"not a pdf", "application/pdf"),
            ),
        ],
    )

    assert response.status_code == 400
    assert "損壞" in response.json()["detail"]
    assert pdf_router.pdf_files == {}
    assert list(isolated_storage["uploads"].iterdir()) == []


def test_upload_sanitizes_filename(tmp_path: Path, isolated_storage):
    source = create_sample_pdf(tmp_path / "source.pdf")
    client = TestClient(app)

    response = client.post(
        "/api/pdf/upload",
        files=[
            (
                "files",
                ("../../safe.pdf", source.read_bytes(), "application/pdf"),
            ),
        ],
    )

    assert response.status_code == 200
    uploaded_path = next(iter(pdf_router.pdf_files.values()))
    assert uploaded_path.parent == isolated_storage["uploads"]
    assert uploaded_path.name.endswith("_safe.pdf")
