import sys
from pathlib import Path

import pytest


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """讓服務與 API 測試不寫入專案的 uploads/outputs。"""
    uploads_dir = tmp_path / "uploads"
    outputs_dir = tmp_path / "outputs"
    uploads_dir.mkdir()
    outputs_dir.mkdir()

    from app.routers import pdf as pdf_router
    from app.utils import pdf_utils

    monkeypatch.setattr(pdf_utils, "UPLOADS_DIR", uploads_dir)
    monkeypatch.setattr(pdf_utils, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(pdf_router, "OUTPUTS_DIR", outputs_dir)
    pdf_router.pdf_files.clear()

    yield {
        "uploads": uploads_dir,
        "outputs": outputs_dir,
    }

    pdf_router.pdf_files.clear()
