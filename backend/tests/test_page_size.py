from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from reportlab.pdfgen import canvas

from app.main import app
from app.services.page_size_service import PAGE_SIZE_PRESETS, PageSizeService
from app.utils.pdf_utils import render_page

A4_WIDTH, A4_HEIGHT = PAGE_SIZE_PRESETS["A4"]


def create_scan_like_pdf(path: Path) -> Path:
    """模擬手機掃描：每頁大小、比例都不同，第三頁是橫式。"""
    pdf = canvas.Canvas(str(path))
    for index, (width, height) in enumerate(
        [(1000, 1400), (580, 860), (900, 600)], start=1
    ):
        pdf.setPageSize((width, height))
        pdf.drawString(40, height - 60, f"Scanned page {index}")
        if index == 1:
            pdf.linkURL("https://example.com", (40, 40, 240, 90), relative=0)
        pdf.showPage()
    pdf.save()
    return path


def visual_sizes(reader: PdfReader):
    sizes = []
    for page in reader.pages:
        width, height = float(page.cropbox.width), float(page.cropbox.height)
        if page.rotation % 180 == 90:
            width, height = height, width
        sizes.append((round(width, 1), round(height, 1)))
    return sizes


def test_normalize_fits_every_page_to_a4_and_keeps_text(tmp_path: Path):
    source = create_scan_like_pdf(tmp_path / "scan.pdf")

    result = PdfReader(str(PageSizeService.normalize(source, "A4")))

    portrait = (round(A4_WIDTH, 1), round(A4_HEIGHT, 1))
    landscape = (portrait[1], portrait[0])
    assert visual_sizes(result) == [portrait, portrait, landscape]
    for index, page in enumerate(result.pages, start=1):
        assert f"Scanned page {index}" in page.extract_text()
        assert page.mediabox == page.cropbox


def test_normalize_moves_link_annotations_with_content(tmp_path: Path):
    source = create_scan_like_pdf(tmp_path / "scan.pdf")

    page = PdfReader(str(PageSizeService.normalize(source, "A4"))).pages[0]

    # 1000x1400 縮放到 A4 寬度，比例約 0.595，高度方向置中
    scale = A4_WIDTH / 1000
    offset_y = (A4_HEIGHT - 1400 * scale) / 2
    rect = [float(value) for value in page["/Annots"][0].get_object()["/Rect"]]
    assert rect == pytest.approx(
        [40 * scale, 40 * scale + offset_y, 240 * scale, 90 * scale + offset_y],
        abs=0.01,
    )


def test_normalize_fixed_orientation_and_fill(tmp_path: Path):
    source = create_scan_like_pdf(tmp_path / "scan.pdf")

    result = PdfReader(str(PageSizeService.normalize(
        source, "A5", orientation="portrait", mode="fill"
    )))

    a5 = PAGE_SIZE_PRESETS["A5"]
    assert set(visual_sizes(result)) == {(round(a5[0], 1), round(a5[1], 1))}


def test_normalize_only_selected_pages(tmp_path: Path):
    source = create_scan_like_pdf(tmp_path / "scan.pdf")

    result = PdfReader(str(PageSizeService.normalize(source, "A4", page_numbers=[2])))

    sizes = visual_sizes(result)
    assert sizes[0] == (1000, 1400)
    assert sizes[1] == (round(A4_WIDTH, 1), round(A4_HEIGHT, 1))
    assert sizes[2] == (900, 600)


def test_normalize_respects_rotation(tmp_path: Path):
    source = create_scan_like_pdf(tmp_path / "scan.pdf")
    writer = PdfWriter(clone_from=str(source))
    # 直式頁面轉 90 度後，看起來是橫式
    writer.pages[1].rotate(90)
    rotated = tmp_path / "rotated.pdf"
    writer.write(rotated)

    result = PdfReader(str(PageSizeService.normalize(rotated, "A4")))

    assert result.pages[1].rotation == 90
    assert visual_sizes(result)[1] == (round(A4_HEIGHT, 1), round(A4_WIDTH, 1))
    assert "Scanned page 2" in result.pages[1].extract_text()


def test_normalize_hides_content_outside_original_cropbox(tmp_path: Path):
    source = tmp_path / "cropped.pdf"
    pdf = canvas.Canvas(str(source), pagesize=(600, 600))
    # 左半部是黑色，裁切後只看得到右半部的白色區域
    pdf.rect(0, 0, 300, 600, stroke=0, fill=1)
    pdf.showPage()
    pdf.save()
    writer = PdfWriter(clone_from=str(source))
    writer.pages[0].cropbox = RectangleObject((300, 0, 600, 600))
    writer.write(source)

    output = PageSizeService.normalize(source, "A4", orientation="landscape")
    image = render_page(output, 1, dpi=36).convert("L")

    # 等比放入後左右留白；原本被裁掉的黑色區域不能出現在留白處
    assert image.getextrema()[0] > 200


def test_normalize_rejects_invalid_options(tmp_path: Path):
    source = create_scan_like_pdf(tmp_path / "scan.pdf")

    with pytest.raises(ValueError, match="紙張"):
        PageSizeService.normalize(source, "A0")
    with pytest.raises(ValueError, match="無效的頁面號碼"):
        PageSizeService.normalize(source, "A4", page_numbers=[4])


def test_normalize_size_endpoint(tmp_path: Path):
    source = create_scan_like_pdf(tmp_path / "scan.pdf")
    client = TestClient(app)
    upload = client.post(
        "/api/pdf/upload",
        files=[("files", ("scan.pdf", source.read_bytes(), "application/pdf"))],
    )
    pdf_id = upload.json()["files"][0]["id"]

    response = client.post("/api/pdf/normalize-size", json={
        "pdfId": pdf_id, "size": "Letter", "pages": "selected", "selectedPageNumbers": [1],
    })
    assert response.status_code == 200
    pages = client.get(f"/api/pdf/pages/{response.json()['newPdfId']}").json()["pages"]
    assert (pages[0]["width"], pages[0]["height"]) == (612, 792)
    assert (pages[1]["width"], pages[1]["height"]) == (580, 860)

    invalid = client.post("/api/pdf/normalize-size", json={"pdfId": pdf_id, "size": "A0"})
    assert invalid.status_code == 422
    missing = client.post("/api/pdf/normalize-size", json={"pdfId": pdf_id, "pages": "selected"})
    assert missing.status_code == 422
