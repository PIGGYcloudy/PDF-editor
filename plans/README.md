# PDF 編輯器 - 計畫文件總覽

本目錄包含 PDF 編輯器專案的完整開發計畫文件。

## 文件列表

### 1. [架構文件](./architecture.md)

**內容**：
- 技術棧選擇與說明
- 專案目錄結構
- API 設計概要
- 資料模型定義
- 安全性考量
- 開發環境設定指南

**適用對象**：開發團隊、技術負責人

---

### 2. [開發步驟](./development-steps.md)

**內容**：
- 詳細的開發階段劃分
- 每個步驟的具體操作指令
- Git 提交策略
- 依賴安裝說明

**適用對象**：開發人員

**使用方式**：按照步驟順序執行，每完成一個步驟就進行 Git commit

---

### 3. [系統架構圖](./system-diagram.md)

**內容**：
- 整體系統架構圖
- 前端元件架構
- API 路由架構
- 服務層架構
- 資料流程序列圖
- 狀態管理架構
- 安全性架構

**適用對象**：所有團隊成員、利害關係人

---

### 4. [API 規格](./api-spec.md)

**內容**：
- 完整的 API 端點文件
- 請求/回應格式
- 錯誤碼列表
- CORS 設定
- 參數說明

**適用對象**：前端開發人員、後端開發人員、API 使用者

---

### 5. [測試計畫](./test-plan.md)

**內容**：
- 測試策略
- 單元測試案例
- 整合測試案例
- 端到端測試場景
- 測試資料準備
- 測試覆蓋率目標
- 效能測試項目

**適用對象**：測試人員、開發人員

---

## 開發流程建議

### 階段 1：準備

1. 閱讀 [架構文件](./architecture.md) 了解整體設計
2. 查看 [系統架構圖](./system-diagram.md) 理解系統流程
3. 設定開發環境

### 階段 2：後端開發

1. 參考 [開發步驟](./development-steps.md) 的階段 2
2. 依照 [API 規格](./api-spec.md) 實作端點
3. 撰寫單元測試

### 階段 3：前端開發

1. 參考 [開發步驟](./development-steps.md) 的階段 3
2. 依照 [API 規格](./api-spec.md) 呼叫後端
3. 撰寫元件測試

### 階段 4：整合測試

1. 參考 [測試計畫](./test-plan.md) 的端到端測試
2. 執行完整流程測試
3. 修復發現的問題

### 階段 5：部署準備

1. 更新 README.md
2. 準備部署文件
3. 最終測試

---

## 快速參考

### 技術棧摘要

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + TypeScript + Material-UI |
| 後端 | FastAPI + Python 3.11 |
| PDF 處理 | PyPDF2, Pillow, pdf2image |
| 資料庫 | 無（檔案系統儲存） |

### 端口配置

| 服務 | 端口 |
|------|------|
| 後端 API | 8000 |
| 前端開發伺服器 | 5173 (Vite) |

### 關鍵目錄

| 目錄 | 用途 |
|------|------|
| `backend/uploads/` | 上傳的原始 PDF |
| `backend/outputs/` | 處理後的輸出檔案 |
| `frontend/src/components/` | React 元件 |
| `backend/app/services/` | 業務邏輯服務 |

---

## Git 分支策略

```
main
├── feat/project-setup      # 專案初始化
├── feat/backend-core       # 後端核心功能
├── feat/pdf-operations     # PDF 操作功能
├── feat/advanced-features  # 進階功能（壓縮、浮水印、轉換）
├── feat/frontend-core      # 前端核心
├── feat/frontend-features  # 前端功能
└── feat/integration        # 前後端整合
```

---

## 聯絡與支援

如有問題，請參考相關文件或提出 Issue。
