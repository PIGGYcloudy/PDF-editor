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
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_FILE_TYPES = ["application/pdf"]

# 檔案保留設定：閒置超過保留時間的上傳與輸出檔會被自動刪除，設為 0 可停用
FILE_RETENTION_HOURS = float(os.getenv("FILE_RETENTION_HOURS", "24"))
CLEANUP_INTERVAL_MINUTES = float(os.getenv("CLEANUP_INTERVAL_MINUTES", "30"))
if FILE_RETENTION_HOURS < 0:
    raise ValueError("FILE_RETENTION_HOURS 不可小於 0")
if CLEANUP_INTERVAL_MINUTES <= 0:
    raise ValueError("CLEANUP_INTERVAL_MINUTES 必須大於 0")

# 渲染設定：Poppler 渲染非常耗用 CPU 與記憶體，限制同時渲染的頁數，超過的
# 請求排隊等待。預設取 CPU 核心數，但最多 4，避免大型頁面同時渲染耗盡記憶體。
MAX_CONCURRENT_RENDERS = int(
    os.getenv("MAX_CONCURRENT_RENDERS", str(min(os.cpu_count() or 1, 4)))
)
if MAX_CONCURRENT_RENDERS < 1:
    raise ValueError("MAX_CONCURRENT_RENDERS 必須大於 0")

# 單張渲染圖片的像素上限；超大頁面會自動降低 DPI。A3 在 300 DPI 約 1750 萬像素，
# 不受影響。
MAX_RENDER_PIXELS = 25_000_000

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
