#!/bin/sh

# 啟動 Nginx
echo "Starting Nginx..."
nginx -g "daemon off;" &

# 等待 Nginx 啟動
sleep 2

# 啟動 FastAPI 後端
echo "Starting FastAPI backend..."
cd /app
exec uvicorn app.main:app --host 0.0.0.0 --port 7999 --reload
