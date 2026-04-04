"""
FastAPI 應用入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import pdf, convert

# 創建 FastAPI 應用
app = FastAPI(
    title="PDF 編輯器 API",
    description="PDF 編輯器後端 API，提供頁面管理、尺寸調整、壓縮、浮水印和格式轉換等功能",
    version="1.0.0"
)

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
