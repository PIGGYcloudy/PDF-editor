# PDF Editor 維修計劃總覽

## 專案資訊

- **專案名稱**: PDF Editor
- **工作目錄**: `d:/PDF-editor`
- **開發環境**: Python 虛擬環境 `.venv/`
- **容器化**: Docker Desktop
- **後端端口**: 7999

## 識別的問題總覽

| 編號 | 問題名稱 | 嚴重程度 | 狀態 | 計劃文件 |
|------|----------|----------|------|----------|
| 01 | Convert Service 頁面索引錯位 | 🔴 高 | 待修復 | [repair-plan-01-convert-service.md](./repair-plan-01-convert-service.md) |
| 02 | Compress Service 壓縮功能未實現 | 🔴 高 | 待修復 | [repair-plan-02-compress-service.md](./repair-plan-02-compress-service.md) |
| 03 | PDF Service Resize 空白頁面 | 🔴 高 | 待修復 | [repair-plan-03-pdf-service-resize.md](./repair-plan-03-pdf-service-resize.md) |
| 04 | Watermark Service 旋轉變形 | 🟡 中 | 待修復 | [repair-plan-04-watermark-service.md](./repair-plan-04-watermark-service.md) |
| 05 | PDF Utils 函式命名衝突 | 🟢 低 | 待修復 | [repair-plan-05-pdf-utils-naming.md](./repair-plan-05-pdf-utils-naming.md) |

## 修復優先順序

### 第一優先（高嚴重度）

1. **Convert Service 頁面索引錯位** - 影響 PDF 轉圖片功能
2. **Compress Service 壓縮功能未實現** - 壓縮功能完全無效
3. **PDF Service Resize 空白頁面** - 調整尺寸後內容丟失

### 第二優先（中嚴重度）

4. **Watermark Service 旋轉變形** - 浮水印美觀問題

### 第三優先（低嚴重度）

5. **PDF Utils 函式命名衝突** - 代碼質量問題

## 開發流程

### 1. 環境準備

```bash
# 確保虛擬環境存在
cd d:/PDF-editor
python -m venv .venv

# 激活虛擬環境
.venv\Scripts\activate

# 安裝依賴
cd backend
pip install -r requirements.txt

# 啟動後端服務
python -m uvicorn app.main:app --host 0.0.0.0 --port 7999
```

### 2. Git 分支策略

每個問題都應該在獨立的分支上修復：

```bash
# 確保在主分支並更新
git checkout main
git pull origin main

# 建立修復分支
git checkout -b fix/convert-service-page-index
# 或
git checkout -b fix/compress-service-implementation
# 或
git checkout -b fix/pdf-service-resize-blank-pages
# 或
git checkout -b fix/watermark-service-rotation-distortion
# 或
git checkout -b refactor/pdf-utils-function-naming
```

### 3. 修復步驟

1. **閱讀對應的維修計劃文件**
2. **實施修復代碼**
3. **在虛擬環境中測試**
4. **移除診斷日誌**（合併前必須）
5. **提交變更**
6. **建立 Pull Request**

### 4. Docker 測試

```bash
# 停止現有容器
docker-compose down

# 重新建構镜像
docker-compose build

# 啟動容器
docker-compose up -d

# 查看日誌
docker-compose logs -f backend

# 停止容器
docker-compose down
```

### 5. 合併到 Main

```bash
# 在合併前，確保已移除所有診斷日誌
# 檢查日誌語句並移除

# 合併到 main
git checkout main
git merge fix/your-branch-name

# 推送到遠端
git push origin main
```

## 日誌清理清單

在合併到 main 之前，必須移除以下診斷日誌：

### backend/app/main.py
- [ ] 移除 `logging.basicConfig()` 中的 DEBUG 級別設置
- [ ] 移除自定義的日誌格式

### backend/app/services/convert_service.py
- [ ] 移除 `logger = logging.getLogger(__name__)`
- [ ] 移除所有 `logger.warning()`, `logger.error()`, `logger.debug()` 調用

### backend/app/services/compress_service.py
- [ ] 移除 `logger = logging.getLogger(__name__)`
- [ ] 移除所有 `logger.warning()`, `logger.error()`, `logger.debug()` 調用

### backend/app/services/pdf_service.py
- [ ] 移除 `logger = logging.getLogger(__name__)`
- [ ] 移除所有 `logger.warning()`, `logger.error()`, `logger.debug()` 調用

### backend/app/services/watermark_service.py
- [ ] 移除 `logger = logging.getLogger(__name__)`
- [ ] 移除所有 `logger.warning()`, `logger.error()`, `logger.debug()` 調用

## 依賴更新

某些修復可能需要添加新的依賴：

### 可能需要添加的依賴

```txt
# backend/requirements.txt

# 如果需要使用 PyMuPDF 進行更好的 PDF 處理
pymupdf==1.23.8

# 如果需要使用 reportlab 生成 PDF
reportlab==4.0.7
```

### Dockerfile 更新

```dockerfile
# backend/Dockerfile

# 如果需要使用 poppler-utils（pdf2image 需要）
RUN apt-get update && apt-get install -y \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*
```

## 測試清單

### Convert Service 測試
- [ ] 連續頁面轉換（[1, 2, 3]）
- [ ] 非連續頁面轉換（[1, 3, 5]）
- [ ] 單頁轉換（[2]）
- [ ] 所有頁面轉換（None）

### Compress Service 測試
- [ ] 壓縮前後檔案大小比較
- [ ] 不同品質等級（low, medium, high）
- [ ] 壓縮後內容完整性

### PDF Service Resize 測試
- [ ] A4 轉 A3
- [ ] A3 轉 A4
- [ ] 自定義尺寸
- [ ] 保持長寬比 vs 不保持

### Watermark Service 測試
- [ ] 文字浮水印旋轉 45 度
- [ ] 文字浮水印旋轉 90 度
- [ ] 圖片浮水印旋轉
- [ ] 不同位置測試

### PDF Utils 測試
- [ ] 單頁尺寸獲取
- [ ] 邊界檢查
- [ ] 所有功能測試

## 聯絡資訊

如有疑問，請參考對應的維修計劃文件或提出 Issue。

---

**最後更新**: 2024-01-XX
**版本**: 1.0
