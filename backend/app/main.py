"""
FastAPI 應用入口
"""
import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import (
    CLEANUP_INTERVAL_MINUTES,
    CORS_ORIGINS,
    FILE_RETENTION_HOURS,
    OUTPUTS_DIR,
    UPLOADS_DIR,
)
from app.routers import pdf, convert
from app.services.cleanup_service import CleanupService

# 配置日誌
logging.basicConfig(
    level=logging.DEBUG,
    format='[%(asctime)s] %(levelname)s [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


async def cleanup_expired_files_periodically():
    """啟動時先清理一次，之後每隔 CLEANUP_INTERVAL_MINUTES 清理過期檔案"""
    while True:
        try:
            removed = await asyncio.to_thread(
                CleanupService.remove_expired,
                [UPLOADS_DIR, OUTPUTS_DIR],
                FILE_RETENTION_HOURS * 60 * 60,
            )
            if removed:
                logger.info("已清理 %d 個過期檔案", removed)
        except Exception:
            logger.exception("清理過期檔案失敗")
        await asyncio.sleep(CLEANUP_INTERVAL_MINUTES * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_task = None
    if FILE_RETENTION_HOURS > 0:
        cleanup_task = asyncio.create_task(cleanup_expired_files_periodically())

    yield

    if cleanup_task is not None:
        cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup_task


# 創建 FastAPI 應用，設置最大上傳大小為 100MB
app = FastAPI(
    title="PDF 編輯器 API",
    description="PDF 編輯器後端 API，提供頁面管理、尺寸調整、壓縮、浮水印和格式轉換等功能",
    version="1.0.0",
    lifespan=lifespan,
)

# 添加請求大小限制中間件
@app.middleware("http")
async def check_content_length(request: Request, call_next):
    """檢查請求內容長度，防止過大的請求"""
    max_size = 100 * 1024 * 1024  # 100MB
    content_length = request.headers.get("Content-Length")
    
    if content_length and int(content_length) > max_size:
        return JSONResponse(
            status_code=413,
            content={"detail": f"檔案太大，最大支援 100MB"}
        )
    
    response = await call_next(request)
    return response

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由
app.include_router(pdf.router, prefix="/api")
app.include_router(convert.router, prefix="/api")


@app.get("/")
async def root():
    """API 根路徑"""
    return {
        "message": "PDF 編輯器 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """健康檢查"""
    return {"status": "healthy"}
