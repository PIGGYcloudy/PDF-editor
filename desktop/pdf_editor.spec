# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller 設定：在 desktop/ 目錄執行 `pyinstaller pdf_editor.spec`

打包前需要：
- frontend/dist：前端 production build（npm run build）
- desktop/build/poppler：Windows 版 Poppler（含 Library/bin/pdftoppm.exe）
"""
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

DESKTOP_DIR = Path(SPECPATH)
ROOT_DIR = DESKTOP_DIR.parent
POPPLER_DIR = DESKTOP_DIR / "build" / "poppler"

datas = [(str(ROOT_DIR / "frontend" / "dist"), "frontend")]
if POPPLER_DIR.is_dir():
    datas.append((str(POPPLER_DIR), "poppler"))
datas += collect_data_files("reportlab")

hiddenimports = (
    collect_submodules("app")
    + collect_submodules("uvicorn")
    + ["multipart", "python_multipart"]
)

a = Analysis(
    [str(DESKTOP_DIR / "launcher.py")],
    pathex=[str(ROOT_DIR / "backend")],
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["pytest", "ruff", "httpx"],
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="PDF Editor",
    console=False,
    upx=False,
)
coll = COLLECT(exe, a.binaries, a.datas, upx=False, name="PDF Editor")
