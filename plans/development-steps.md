# PDF 編輯器 - 開發步驟文件

## 階段 1: 專案初始化與環境設定

### 步驟 1.1: 建立專案目錄結構

```bash
# 建立主要目錄
mkdir backend
mkdir frontend
mkdir plans

# 建立後端目錄結構
mkdir backend\app
mkdir backend\app\models
mkdir backend\app\routers
mkdir backend\app\services
mkdir backend\app\utils
mkdir backend\uploads
mkdir backend\outputs

# 建立前端目錄結構
mkdir frontend\src
mkdir frontend\src\components
mkdir frontend\src\hooks
mkdir frontend\src\services
mkdir frontend\src\types
mkdir frontend\public
```

### 步驟 1.2: 建立 Python 虛擬環境

```bash
# 建立虛擬環境
python -m venv .venv

# 啟動虛擬環境 (Windows)
.venv\Scripts\activate

# 升級 pip
pip install --upgrade pip
```

### 步驟 1.3: 建立 .gitignore

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
.venv/
ENV/
env/
venv*/
env*/

# Python 虛擬環境 (明確指定)
.venv/

# FastAPI/後端
backend/uploads/*
backend/outputs/*
!backend/uploads/.gitkeep
!backend/outputs/.gitkeep

# 前端
frontend/node_modules/
frontend/dist/
frontend/.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# 作業系統
.DS_Store
Thumbs.db

# 環境變數
.env
.env.local
.env.*.local

# 日誌
*.log
```

### 步驟 1.4: 建立 README.md

包含專案說明、安裝步驟、使用說明。

### 步驟 1.5: 初始化 Git

```bash
git init
git add .
git commit -m "feat: 初始化專案結構"
```

---

## 階段 2: 後端 FastAPI 開發

### 步驟 2.1: 建立 requirements.txt

```txt
fastapi==0.104.1
uvicorn==0.24.0
python-multipart==0.0.6
pypdf==3.17.0
Pillow==10.1.0
pdf2image==1.16.3
python-dotenv==1.0.0
aiofiles==23.2.1
```

### 步驟 2.2: 安裝依賴

```bash
pip install -r requirements.txt
```

### 步驟 2.3: 建立 FastAPI 應用入口

建立 `backend/app/main.py`:
- 設定 FastAPI 應用
- 配置 CORS
- 註冊路由

### 步驟 2.4: 建立配置檔案

建立 `backend/app/config.py`:
- 上傳目錄設定
- 輸出目錄設定
- 最大檔案大小
- 允許的檔案類型

### 步驟 2.5: 建立 Pydantic 模型

建立 `backend/app/models/schemas.py`:
- UploadResponse
- DeletePagesRequest
- ReorderPagesRequest
- ResizeRequest
- CompressRequest
- WatermarkTextRequest
- WatermarkImageRequest
- ConvertToImageRequest

### 步驟 2.6: 建立 PDF 工具函數

建立 `backend/app/utils/pdf_utils.py`:
- 讀取 PDF 頁面數量
- 產生頁面縮圖
- 紙張尺寸常數

### 步驟 2.7: 建立 PDF 服務

建立 `backend/app/services/pdf_service.py`:
- 刪除頁面邏輯
- 重新排序頁面邏輯
- 調整尺寸邏輯

### 步驟 2.8: 建立壓縮服務

建立 `backend/app/services/compress_service.py`:
- 圖片解析度降低
- PDF 壓縮邏輯

### 步驟 2.9: 建立浮水印服務

建立 `backend/app/services/watermark_service.py`:
- 文字浮水印添加
- 圖片浮水印添加
- 位置計算邏輯

### 步驟 2.10: 建立轉換服務

建立 `backend/app/services/convert_service.py`:
- PDF 轉 JPG
- PDF 轉 PNG
- 解析度設定

### 步驟 2.11: 建立 API 路由

建立 `backend/app/routers/pdf.py`:
- POST /upload
- POST /delete-pages
- POST /reorder-pages
- POST /resize
- POST /compress
- POST /watermark/text
- POST /watermark/image

建立 `backend/app/routers/convert.py`:
- POST /to-image
- GET /download/{filename}

### 步驟 2.12: 測試後端 API

使用 curl 或 Postman 測試所有端點。

---

## 階段 3: 前端 React 開發

### 步驟 3.1: 建立 React 專案

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### 步驟 3.2: 安裝依賴

```bash
# UI 元件庫
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material

# 拖曳功能
npm install react-beautiful-dnd

# 檔案上傳
npm install react-dropzone

# HTTP 客戶端
npm install axios

# 路由
npm install react-router-dom
```

### 步驟 3.3: 建立 TypeScript 類型

建立 `frontend/src/types/index.ts`:
- PDFFile
- Page
- WatermarkConfig
- SizePreset

### 步驟 3.4: 建立 API 服務

建立 `frontend/src/services/api.ts`:
- 設定 axios 基礎 URL
- 建立所有 API 呼叫函數

### 步驟 3.5: 建立檔案上傳元件

建立 `frontend/src/components/FileUpload.tsx`:
- 拖曳區域
- 多檔案選擇
- 上傳進度顯示

### 步驟 3.6: 建立 PDF 預覽元件

建立 `frontend/src/components/PDFPreview.tsx`:
- 頁面縮圖網格
- 頁面資訊顯示

### 步驟 3.7: 建立頁面縮圖元件

建立 `frontend/src/components/PageThumbnail.tsx`:
- 單一頁面預覽
- 選取狀態
- 拖曳把手

### 步驟 3.8: 建立頁面排序元件

建立 `frontend/src/components/PageReorder.tsx`:
- 可拖曳列表
- 排序動畫
- 排序完成處理

### 步驟 3.9: 建立尺寸選擇器元件

建立 `frontend/src/components/SizeSelector.tsx`:
- 常用尺寸下拉選單
- 自訂尺寸輸入
- 寬高比鎖定

### 步驟 3.10: 建立壓縮元件

建立 `frontend/src/components/Compressor.tsx`:
- 壓縮品質滑桿
- 預估壓縮比
- 壓縮按鈕

### 步驟 3.11: 建立浮水印元件

建立 `frontend/src/components/Watermark.tsx`:
- 文字/圖片切換
- 文字設定表單
- 圖片上傳
- 位置選擇器
- 透明度滑桿
- 旋轉角度滑桿
- 預覽功能

### 步驟 3.12: 建立轉換元件

建立 `frontend/src/components/Converter.tsx`:
- 格式選擇 (JPG/PNG)
- 解析度選擇
- 轉換按鈕
- 下載連結

### 步驟 3.13: 建立 Custom Hooks

建立 `frontend/src/hooks/usePDF.ts`:
- PDF 狀態管理
- 頁面操作邏輯

建立 `frontend/src/hooks/useDragDrop.ts`:
- 拖曳狀態管理
- 排序邏輯

### 步驟 3.14: 建立主應用程式

更新 `frontend/src/App.tsx`:
- 整合所有元件
- 狀態管理
- 路由設定

### 步驟 3.15: 樣式設計

更新 `frontend/src/App.css`:
- 響應式佈局
- 主題顏色
- 動畫效果

---

## 階段 4: 前後端整合

### 步驟 4.1: 設定 CORS

在 `backend/app/main.py` 中配置 CORS:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 步驟 4.2: 測試檔案上傳

- 前端上傳 PDF
- 後端接收並儲存
- 返回檔案資訊

### 步驟 4.3: 測試頁面操作

- 刪除頁面
- 重新排序
- 調整尺寸

### 步驟 4.4: 測試進階功能

- 壓縮功能
- 浮水印功能
- 格式轉換

### 步驟 4.5: 錯誤處理

- 前端錯誤顯示
- 後端異常處理
- 載入狀態管理

---

## 階段 5: 測試與優化

### 步驟 5.1: 功能測試清單

#### 基本功能
- [ ] 單檔案上傳
- [ ] 多檔案上傳
- [ ] 拖曳上傳
- [ ] PDF 頁面預覽
- [ ] 頁面刪除
- [ ] 頁面拖曳排序

#### 進階功能
- [ ] 單頁面尺寸調整
- [ ] 所有頁面尺寸調整
- [ ] 常用尺寸選擇
- [ ] 自訂尺寸輸入
- [ ] PDF 壓縮
- [ ] 文字浮水印
- [ ] 圖片浮水印
- [ ] 浮水印位置設定
- [ ] 浮水印透明度
- [ ] 浮水印旋轉
- [ ] PDF 轉 JPG
- [ ] PDF 轉 PNG

### 步驟 5.2: 邊界測試

- [ ] 大檔案處理 (>50MB)
- [ ] 多頁面 PDF (>100 頁)
- [ ] 不同 PDF 版本
- [ ] 加密 PDF
- [ ] 損壞的 PDF 檔案

### 步驟 5.3: 使用者體驗優化

- [ ] 載入動畫
- [ ] 進度條
- [ ] 錯誤提示
- [ ] 成功提示
- [ ] 響應式設計
- [ ] 無障礙功能

---

## 階段 6: 文件與部署

### 步驟 6.1: 更新 README

包含:
- 專案介紹
- 功能列表
- 安裝步驟
- 使用說明
- API 文件連結

### 步驟 6.2: 撰寫 API 文件

使用 FastAPI 內建 Swagger UI 或撰寫獨立文件。

### 步驟 6.3: 部署準備

- 環境變數設定
- 生產環境配置
- Docker 化 (可選)

### 步驟 6.4: 最終測試

完整測試所有功能後，準備發布。

---

## Git 提交策略

每個步驟完成後都要進行 commit:

```bash
# 階段 1
git add .
git commit -m "feat: 初始化專案結構與環境設定"

# 階段 2 - 後端
git add .
git commit -m "feat: 建立 FastAPI 後端基礎架構"

git add .
git commit -m "feat: 實作 PDF 基本處理功能"

git add .
git commit -m "feat: 實作 PDF 壓縮功能"

git add .
git commit -m "feat: 實作 PDF 浮水印功能"

git add .
git commit -m "feat: 實作 PDF 格式轉換功能"

# 階段 3 - 前端
git add .
git commit -m "feat: 建立 React 前端基礎架構"

git add .
git commit -m "feat: 實作檔案上傳功能"

git add .
git commit -m "feat: 實作 PDF 預覽與頁面管理"

git add .
git commit -m "feat: 實作頁面尺寸調整功能"

git add .
git commit -m "feat: 實作壓縮與浮水印功能介面"

git add .
git commit -m "feat: 實作格式轉換功能介面"

# 階段 4
git add .
git commit -m "feat: 完成前後端整合"

# 階段 5
git add .
git commit -m "test: 完成功能測試與優化"

# 階段 6
git add .
git commit -m "docs: 完成文件撰寫"
```
