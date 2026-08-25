# PDF Editor

[![CI](https://github.com/PIGGYcloudy/PDF-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/PIGGYcloudy/PDF-editor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一個可自行託管的網頁版 PDF 工具，使用 React、TypeScript 與 FastAPI 建置。它提供常見的頁面整理、壓縮、浮水印與圖片轉換功能，適合在本機或受信任環境處理文件。

> [!IMPORTANT]
> PDF 會上傳到執行此服務的後端並暫存在磁碟。請勿把預設設定直接暴露到公開網路；正式部署前請閱讀 [Security Policy](SECURITY.md#deployment-scope)。

## 功能

- 拖曳或選取多份 PDF 上傳
- 刪除頁面與拖曳重新排序
- 合併多份 PDF
- 保留文字與向量內容的 PDF 壓縮
- 文字與圖片浮水印
- PDF 頁面轉 JPG 或 PNG，並以 ZIP 下載
- 頁面縮圖與高解析度預覽

## 技術架構

- 前端：React 18、TypeScript、Material UI、Vite
- 後端：FastAPI、pypdf、Pillow、pdf2image、ReportLab
- 系統工具：Poppler
- 部署：Docker Compose、Nginx

## 使用 Docker 啟動

需求：Docker 與 Docker Compose。

```bash
git clone https://github.com/PIGGYcloudy/PDF-editor.git
cd PDF-editor
docker compose up --build
```

啟動後：

- Web UI：<http://localhost:8081>
- 後端 API：<http://localhost:8000>
- OpenAPI 文件：<http://localhost:8000/docs>

停止服務：

```bash
docker compose down
```

上傳與產出檔案位於 `backend/uploads/` 與 `backend/outputs/`。這些內容不會被 Git 追蹤，也會被排除在 Docker image 之外；請依自己的隱私與保留政策定期清理。

## 本機開發

### 後端

需求：Python 3.11+ 與 Poppler。

Ubuntu/Debian：

```bash
sudo apt-get install poppler-utils fonts-droid-fallback
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 7999
```

macOS 可使用 `brew install poppler` 安裝 Poppler。

### 前端

需求：Node.js 20.19+ 或 22.12+。

```bash
cd frontend
npm ci
npm run dev
```

開發伺服器位於 <http://localhost:5173>，並將 `/api` 代理至 <http://localhost:7999>。

## 測試與建置

```bash
cd backend
pytest -q
```

```bash
cd frontend
npm ci
npm run build
```

每次 push 到 `main` 與每個 Pull Request 都會透過 GitHub Actions 執行測試、production build 與依賴漏洞稽核；Dependabot 每週檢查 Python 與 npm 更新。

## API 與開發文件

- 互動式 API 文件：啟動後開啟 `/docs`
- [歷史設計與修復紀錄](plans/README.md)

`plans/` 保留早期設計與修復紀錄，部分內容描述已移除的功能；目前行為以程式碼、OpenAPI 與本 README 為準。

## 已知限制

- 檔案索引目前保存在單一後端程序的記憶體中；服務重新啟動後不會恢復索引。
- 預設沒有使用者帳號、身分驗證、速率限制或自動清理排程。
- 100 MB 限制是單一檔案上限；大型或複雜 PDF 仍可能耗用大量記憶體與 CPU。
- 加密或格式異常的 PDF 可能無法處理。

## 參與貢獻

歡迎回報 Issue 或提交 Pull Request。開始前請閱讀 [CONTRIBUTING.md](CONTRIBUTING.md)；安全問題請依 [SECURITY.md](SECURITY.md) 私下回報。

## License

本專案採用 [MIT License](LICENSE)。
