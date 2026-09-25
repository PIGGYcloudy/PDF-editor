# 使用 Python 3.11 slim 版本作為基礎映像
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 設定工作目錄
WORKDIR /app

# 安裝系統依賴（用於 pdf2image 與中文浮水印字型）
# poppler-data 是 Poppler 渲染未內嵌字型的中日韓文字所需的編碼資料，
# 使用 --no-install-recommends 時必須明確安裝
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-droid-fallback \
    poppler-data \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# 複製依賴檔案並安裝 Python 套件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 以非 root 使用者執行服務
RUN useradd --create-home --uid 10001 app

# 複製應用程式代碼
COPY . .

# 建立上傳和輸出目錄；具名 volume 第一次掛載時會沿用這裡的擁有者
RUN mkdir -p uploads outputs && chown app:app uploads outputs

USER app

# 暴露端口
EXPOSE 7999

# 啟動命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7999"]
