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

# 資料目錄：上傳與輸出檔的存放位置。Windows 桌面版把它指到使用者的
# AppData 或 portable 資料夾，因為安裝目錄可能沒有寫入權限。
DATA_DIR = Path(os.getenv("PDF_EDITOR_DATA_DIR") or BASE_DIR)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 上傳目錄
UPLOADS_DIR = DATA_DIR / "uploads"
OUTPUTS_DIR = DATA_DIR / "outputs"

# 確保目錄存在
UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUTS_DIR.mkdir(exist_ok=True)

# 日誌等級
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# 單次請求（一次上傳的所有檔案合計）的大小上限，需與前端 nginx 的
# client_max_body_size 一致
MAX_UPLOAD_MB = 100
MAX_UPLOAD_SIZE = MAX_UPLOAD_MB * 1024 * 1024

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

# Poppler 執行檔所在目錄；未設定時從 PATH 尋找（Docker 與 Linux 開發環境）
POPPLER_PATH = os.getenv("POPPLER_PATH") or None

# 前端 production build 的目錄；設定時由後端直接提供網頁（Windows 桌面版），
# 不設定時由 nginx 或 Vite 提供
STATIC_DIR = os.getenv("PDF_EDITOR_STATIC_DIR") or None

# 中文浮水印字型，依序使用第一個存在的檔案；可用 CJK_FONT_PATH 指定
_WINDOWS_FONTS_DIR = Path(os.getenv("WINDIR", r"C:\Windows")) / "Fonts"
CJK_FONT_CANDIDATES = [
    Path(path)
    for path in (
        os.getenv("CJK_FONT_PATH"),
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        # Windows 內建字型：微軟正黑體、微軟雅黑、細明體
        _WINDOWS_FONTS_DIR / "msjh.ttc",
        _WINDOWS_FONTS_DIR / "msyh.ttc",
        _WINDOWS_FONTS_DIR / "mingliu.ttc",
    )
    if path
]

# 圖片設定
THUMBNAIL_SIZES = {
    "small": (100, 100),
    "medium": (200, 200),
    "large": (400, 400),
}

# CORS 設定
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
