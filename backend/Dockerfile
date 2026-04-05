# 使用 Python 3.11 slim 版本作為基礎映像
FROM python:3.11-slim

# 設定工作目錄
WORKDIR /app

# 安裝系統依賴（用於 pdf2image）
RUN apt-get update && apt-get install -y \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# 複製依賴檔案並安裝 Python 套件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式代碼
COPY . .

# 建立上傳和輸出目錄
RUN mkdir -p uploads outputs

# 暴露端口
EXPOSE 7999

# 啟動命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7999"]
