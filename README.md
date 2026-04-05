# PDF 編輯器

一個基於 React + FastAPI 的網頁版 PDF 編輯器，提供頁面管理、尺寸調整、壓縮、浮水印和格式轉換等功能。

## 功能特性

- ✅ **檔案上傳**：支援拖曳檔案上傳，可同時上傳多個 PDF
- ✅ **頁面管理**：刪除頁面、拖曳重新排序
- ✅ **尺寸調整**：支援常用尺寸 (A3/A4/A5/B2/B3/B4/B5/Letter/Legal) 和自訂尺寸
- ✅ **PDF 壓縮**：降低圖片解析度以減少檔案大小
- ✅ **浮水印功能**：支援文字和圖片浮水印，可設定位置、透明度、旋轉角度
- ✅ **格式轉換**：PDF 轉 JPG/PNG，支援不同解析度

## 技術棧

### 前端
- React 18 + TypeScript
- Material-UI (MUI)
- react-beautiful-dnd (拖曳排序)
- react-dropzone (檔案上傳)
- Vite (建構工具)

### 後端
- FastAPI
- PyPDF2 / pypdf (PDF 處理)
- Pillow (圖片處理)
- pdf2image (PDF 轉圖片)
- Uvicorn (ASGI 伺服器)

## 專案結構

```
PDF-editor/
├── .venv/                    # Python 虛擬環境
├── backend/                  # FastAPI 後端
│   ├── app/
│   │   ├── main.py          # FastAPI 應用入口
│   │   ├── config.py        # 配置設定
│   │   ├── models/          # Pydantic 模型
│   │   ├── routers/         # API 路由
│   │   ├── services/        # 業務邏輯
│   │   └── utils/           # 工具函數
│   ├── uploads/             # 上傳檔案暫存
│   ├── outputs/             # 輸出檔案
│   └── requirements.txt     # Python 依賴
├── frontend/                # React 前端
│   ├── src/
│   │   ├── components/      # React 元件
│   │   ├── hooks/           # Custom Hooks
│   │   ├── services/        # API 服務
│   │   └── types/           # TypeScript 類型
│   ├── package.json
│   └── vite.config.ts
├── plans/                   # 計畫文件
├── docker-compose.yml       # Docker Compose 配置
├── Dockerfile.development   # 開發環境 Dockerfile
├── .gitignore
└── README.md
```

## 快速開始 (Docker)

> **推薦方式**: 使用 Docker 運行，無需安裝 Python、Node.js 等環境

### 系統需求
- Docker 和 Docker Compose

### 啟動步驟

```bash
# 1. 建構並啟動所有服務
docker-compose up --build

# 2. 開啟瀏覽器訪問 http://localhost
```

應用程式將在以下端口運行：
- **前端**: http://localhost
- **後端 API**: http://localhost:7999
- **API 文檔**: http://localhost:7999/docs

### 其他 Docker 命令

```bash
# 背景運行
docker-compose up -d

# 查看日誌
docker-compose logs -f

# 停止服務
docker-compose down

# 停止並刪除卷（將刪除上傳和輸出檔案）
docker-compose down -v
```

## 本地安裝與設定

### 系統需求 (本地開發)

- Python 3.11+
- Node.js 18+ (如未安裝，請先從 https://nodejs.org/ 下載並安裝)
- Poppler (用於 pdf2image)

### Node.js 安裝 (如尚未安裝)

**Windows**:
1. 前往 https://nodejs.org/ 下載 LTS 版本
2. 執行安裝程式，選擇「Add to PATH」選項
3. 驗證安裝：`node --version` 和 `npm --version`

**macOS**:
```bash
brew install node
```

**Ubuntu/Debian**:
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 後端設定

1. 建立並啟動虛擬環境：

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
```

2. 安裝依賴：

```bash
cd backend
pip install -r requirements.txt
```

3. 安裝 Poppler (用於 PDF 轉圖片)：

**Windows**:
- 下載：https://github.com/oschwartz10612/poppler-windows/releases
- 解壓後將 `poppler\Library\bin` 加入系統 PATH

**macOS**:
```bash
brew install poppler
```

**Ubuntu/Debian**:
```bash
sudo apt-get install poppler-utils
```

4. 啟動後端伺服器：

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 7999
```

> **注意**: 如果端口 7999 被佔用，可以修改為其他可用端口，並同步更新 `frontend/vite.config.ts` 中的代理目標。

### 前端設定

> **注意**: 在安裝前端依賴前，請確保已安裝 Node.js 和 npm。

1. 安裝依賴：

```bash
cd frontend
npm install
```

2. 啟動開發伺服器：

```bash
npm run dev
```

3. 開啟瀏覽器訪問 http://localhost:5173

> **注意**: 前端預設代理到後端端口 7999。如果後端運行在其他端口，請修改 `frontend/vite.config.ts` 中的 `target` 配置。

## 使用說明

### 上傳 PDF

1. 將 PDF 檔案拖曳到上傳區域，或點擊區域選擇檔案
2. 支援同時上傳多個 PDF 檔案

### 管理頁面

1. **刪除頁面**：點擊頁面縮圖選取，點擊「刪除頁面」按鈕
2. **重新排序**：拖曳頁面縮圖到目標位置

### 調整尺寸

1. 選擇預設尺寸或輸入自訂尺寸
2. 選擇要調整的頁面（單頁或所有頁面）
3. 點擊「調整尺寸」按鈕

### 壓縮 PDF

1. 調整壓縮品質滑桿
2. 點擊「壓縮」按鈕
3. 查看壓縮比並下載

### 添加浮水印

1. 選擇文字或圖片浮水印
2. 設定浮水印參數（位置、透明度、旋轉等）
3. 點擊「添加浮水印」按鈕

### 轉換為圖片

1. 選擇輸出格式（JPG/PNG）
2. 選擇解析度（72/150/300 DPI）
3. 點擊「轉換」按鈕
4. 下載 ZIP 檔案

## API 文件

詳細的 API 文件請參考 [`plans/api-spec.md`](plans/api-spec.md)。

## 開發文件

- [架構文件](plans/architecture.md)
- [開發步驟](plans/development-steps.md)
- [系統架構圖](plans/system-diagram.md)
- [API 規格](plans/api-spec.md)
- [測試計畫](plans/test-plan.md)

## 測試

### 後端測試

```bash
cd backend
pytest tests/
```

### 前端測試

```bash
cd frontend
npm test
```

## 授權

MIT License

## 貢獻

歡迎提出 Issue 和 Pull Request！