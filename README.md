# PDF Editor

[![CI](https://github.com/PIGGYcloudy/PDF-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/PIGGYcloudy/PDF-editor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一個可自行託管的網頁版 PDF 工具，使用 React、TypeScript 與 FastAPI 建置。它提供常見的頁面整理、壓縮、浮水印與圖片轉換功能，適合在本機或受信任環境處理文件。

> [!IMPORTANT]
> PDF 會上傳到執行此服務的後端並暫存在磁碟。請勿把預設設定直接暴露到公開網路；正式部署前請閱讀 [Security Policy](SECURITY.md#deployment-scope)。

## 功能

- 拖曳或選取多份 PDF 上傳；也可以直接上傳圖片（PNG、JPG、WebP），依檔名順序合成一份 PDF、每張一頁，頁面可選 A4 或依圖片大小，並會依 EXIF 修正手機照片的方向
- 頁面整理：刪除、旋轉（單頁或多頁）與拖曳重新排序（支援滑鼠、觸控長按與鍵盤）；變更先暫存在瀏覽器，按「套用變更」才一次產生新版本，套用前可隨時還原
- 頁面選取：Shift+點擊選取範圍、全選、奇數頁／偶數頁、反選
- 鍵盤快速鍵：`Delete` 刪除選取的頁面、`Ctrl/⌘+A` 全選、`Ctrl/⌘+Z` 復原、`Esc` 取消選取
- 拆分 PDF（依頁碼範圍，例如 `1-3, 5, 8-10`，或每 N 頁一個檔案），以及把選取的頁面抽出為新檔案
- 依勾選順序合併多份 PDF
- 保留文字與向量內容的 PDF 壓縮，可調整圖片品質、最大寬度與是否移除附件，並顯示壓縮前後的檔案大小
- 文字浮水印（字型、字級、顏色、位置、角度、不透明度）與圖片浮水印，設定時即時預覽在頁面上的樣子
- PDF 頁面轉 JPG 或 PNG，並以 ZIP 下載
- 頁面縮圖與高解析度預覽
- 復原上一步（每份文件最多保留 20 步）
- 同一分頁重新整理後恢復檔案列表、頁面排序／旋轉／刪除與復原紀錄；未套用或處理中離開頁面會提醒
- 「套用並另存 PDF」會先套用頁面編輯，再下載新版本；套用失敗時保留編輯
- 勾選多份 PDF 打包成 ZIP 下載（每次最多 100 份）；同名檔案會自動編號
- 縮圖與放大預覽失敗可重試，放大預覽同步呈現未套用的旋轉

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
- 後端 API：<http://localhost:8000>（只接受本機連線）
- OpenAPI 文件：<http://localhost:8000/docs>

停止服務：

```bash
docker compose down
```

後端在容器內以非 root 使用者執行，上傳與產出檔案存放在 Docker volume `uploads` 與 `outputs`（會加上專案名稱前綴，例如 `pdf-editor_uploads`）。若要連同檔案一起刪除，使用 `docker compose down -v`。

本機開發時，檔案位於 `backend/uploads/` 與 `backend/outputs/`；這些內容不會被 Git 追蹤，也會被排除在 Docker image 之外。

### 獨立測試版

可指定不同的 Compose 專案名稱及 port，同時保留原版。以下使用獨立的容器、網路及儲存 volumes：

```bash
PDF_FRONTEND_PORT=8082 PDF_BACKEND_PORT=8001 docker compose -p pdf-editor-ux up -d --build
```

測試版位於 <http://localhost:8082>；原版仍使用 <http://localhost:8081>。停止測試版：

```bash
PDF_FRONTEND_PORT=8082 PDF_BACKEND_PORT=8001 docker compose -p pdf-editor-ux down
```

### 工作區恢復

瀏覽器以 `sessionStorage` 暫存同一分頁的工作區，重新整理後會恢復檔案列表與未套用的頁面編輯，並向後端確認目前文件是否仍可存取。不同分頁互不覆寫；關閉分頁後不保證保留。此暫存只保存檔案識別資訊與編輯狀態，不保存 PDF 內容，不能取代下載備份；後端檔案仍適用保留期限。若瀏覽器停用儲存或空間不足，介面會提示無法暫存。過期項目仍可從清單移除。

### 檔案保留

後端會定期刪除閒置過久的檔案；每次存取 PDF 都會重新計算保留時間，轉換產生的 ZIP 則在下載完成後立即刪除。可用環境變數調整：

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `FILE_RETENTION_HOURS` | `24` | 檔案最後一次存取後保留的小時數；設為 `0` 停用自動清理 |
| `CLEANUP_INTERVAL_MINUTES` | `30` | 清理排程的執行間隔（分鐘） |

### 渲染資源

縮圖、預覽與轉圖片都需要用 Poppler 把頁面渲染成圖片，這是最耗 CPU 與記憶體的操作。後端會限制同時渲染的頁數，超過的請求排隊等待；單張圖片超過約 2500 萬像素時會自動降低 DPI（A3 在 300 DPI 約 1750 萬像素，不受影響）。

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `MAX_CONCURRENT_RENDERS` | CPU 核心數，最多 `4` | 同時渲染的頁數上限；記憶體較少的主機可以調低 |

### 日誌

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `LOG_LEVEL` | `INFO` | 後端日誌等級，例如 `DEBUG`、`WARNING`。處理失敗的詳細原因只會寫在日誌，不會回傳給瀏覽器 |

## 本機開發

### 後端

需求：Python 3.11+ 與 Poppler。

Ubuntu/Debian：

```bash
sudo apt-get install poppler-utils poppler-data fonts-droid-fallback
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 7999
```

macOS 可使用 `brew install poppler` 安裝 Poppler。

### 前端

需求：Node.js 22.12+（建議使用 24 LTS）。

```bash
cd frontend
npm ci
npm run dev
```

開發伺服器位於 <http://localhost:5173>，並將 `/api` 代理至 <http://localhost:7999>。

## 測試與建置

```bash
cd backend
ruff check
pytest -q
```

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
```

`backend/requirements-dev.txt` 包含執行服務所需的套件，以及 pytest、ruff 等開發工具；Docker image 只安裝 `requirements.txt`。

瀏覽器回歸測試會上傳專用測試 PDF，並在結束後刪除這些測試檔案。請對獨立測試版執行：

```bash
cd frontend
npx playwright install chromium
PDF_TEST_URL=http://127.0.0.1:8082 npm run test:e2e
```

每次 push 到 `main` 與每個 Pull Request 都會透過 GitHub Actions 執行 lint、測試、production build 與依賴漏洞稽核；Dependabot 每週檢查 Python 與 npm 更新。

## API 與開發文件

- 互動式 API 文件：啟動後開啟 `/docs`
- [歷史設計與修復紀錄](plans/README.md)

`plans/` 保留早期設計與修復紀錄，部分內容描述已移除的功能；目前行為以程式碼、OpenAPI 與本 README 為準。

## 已知限制

- 預設沒有使用者帳號、身分驗證或速率限制；知道檔案 ID 的人都能存取該檔案。
- 單次上傳（可一次選多個檔案）合計最多 100 MB；需要處理更多檔案時可分次上傳後再合併。大型或複雜 PDF 仍可能耗用大量記憶體與 CPU。
- 超大頁面轉成圖片時，實際解析度可能低於選擇的 DPI。
- 加密或格式異常的 PDF 可能無法處理。

## 參與貢獻

歡迎回報 Issue 或提交 Pull Request。開始前請閱讀 [CONTRIBUTING.md](CONTRIBUTING.md)；安全問題請依 [SECURITY.md](SECURITY.md) 私下回報。

## License

本專案採用 [MIT License](LICENSE)。
