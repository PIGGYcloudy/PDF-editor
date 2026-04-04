"""
應用程式配置設定
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# 專案根目錄
BASE_DIR = Path(__file__).resolve().parent.parent

# 上傳目錄
UPLOADS_DIR = BASE_DIR / "uploads"
OUTPUTS_DIR = BASE_DIR / "outputs"

# 確保目錄存在
UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUTS_DIR.mkdir(exist_ok=True)

# 檔案設定
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_FILE_TYPES = ["application/pdf"]

# 圖片設定
THUMBNAIL_SIZES = {
    "small": (100, 100),
    "medium": (200, 200),
    "large": (400, 400),
}

# 預設 DPI
DEFAULT_DPI = 150

# 紙張尺寸 (寬度，高度) - 單位：points (1/72 英寸)
PAPER_SIZES = {
    "A3": (842, 1191),
    "A4": (595, 842),
    "A5": (420, 595),
    "B2": (1417, 2004),
    "B3": (1000, 1417),
    "B4": (709, 1000),
    "B5": (500, 709),
    "Letter": (612, 792),
    "Legal": (612, 1008),
}

# CORS 設定
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
