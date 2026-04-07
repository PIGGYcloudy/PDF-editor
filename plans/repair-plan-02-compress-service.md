# 維修計劃 02: Compress Service 壓縮功能未實現問題

## 問題描述

在 [`backend/app/services/compress_service.py`](backend/app/services/compress_service.py:19-71) 的 `compress()` 方法中，只是簡單複製 PDF 頁面，**沒有實際執行圖片壓縮**。

### 根本原因

```python
# 當前有問題的邏輯
def compress(
    pdf_path: Path,
    quality: CompressQuality = "medium"
) -> Path:
    """壓縮 PDF（簡單複製，未實際壓縮）"""
    pdf_reader = PdfReader(pdf_path)
    pdf_writer = PdfWriter()
    
    # 只是複製頁面，沒有壓縮
    for page in pdf_reader.pages:
        pdf_writer.add_page(page)
    
    # 輸出檔案大小與原始檔案相同
    return save_output_pdf(pdf_writer, "compressed")
```

### 影響範圍

- API 端點：`POST /api/pdf/compress`
- 前端功能：PDF 壓縮
- 嚴重程度：**高** - 功能完全無效

## 修復方案

### 方案：使用 `compress_with_image_resizing()` 作為主要壓縮方法

由於 `compress()` 方法沒有實際壓縮，我們應該：

1. **重構 `compress()` 方法**，使其呼叫真正的壓縮邏輯
2. **或者將 `compress_with_image_resizing()` 設為預設方法**

### 推薦實作

```python
def compress(
    pdf_path: Path,
    quality: CompressQuality = "medium"
) -> Path:
    """
    壓縮 PDF 檔案
    
    Args:
        pdf_path: PDF 檔案路徑
        quality: 壓縮品質（low, medium, high）
    
    Returns:
        壓縮後的 PDF 檔案路徑
    """
    # 直接使用圖片縮放壓縮方法
    return compress_with_image_resizing(pdf_path, quality)
```

### 增強 `compress_with_image_resizing()` 方法

確保壓縮方法正確處理所有圖片類型：

```python
def compress_with_image_resizing(
    pdf_path: Path,
    quality: CompressQuality = "medium"
) -> Path:
    """
    透過縮放圖片來壓縮 PDF
    
    Args:
        pdf_path: PDF 檔案路徑
        quality: 壓縮品質
            - low: 72 DPI, 60% 品質
            - medium: 150 DPI, 75% 品質（預設）
            - high: 200 DPI, 85% 品質
    
    Returns:
        壓縮後的 PDF 檔案路徑
    """
    pdf_reader = PdfReader(pdf_path)
    pdf_writer = PdfWriter()
    
    # 根據品質設定 DPI 和 JPEG 品質
    quality_settings = {
        "low": {"dpi": 72, "jpeg_quality": 60},
        "medium": {"dpi": 150, "jpeg_quality": 75},
        "high": {"dpi": 200, "jpeg_quality": 85}
    }
    settings = quality_settings.get(quality, quality_settings["medium"])
    
    for page in pdf_reader.pages:
        # 獲取頁面上的所有圖片
        images = page.images
        
        if images:
            # 處理圖片壓縮
            # 注意：pypdf 的圖片處理有限制
            # 可能需要使用其他庫如 PyMuPDF (fitz) 來實現更好的壓縮
            pass
        
        pdf_writer.add_page(page)
    
    # 使用更小的頁面資源
    pdf_writer.remove_unused_objects()
    
    return save_output_pdf(pdf_writer, "compressed")
```

### 替代方案：使用 PyMuPDF（如果需要更好的壓縮）

如果 pypdf 無法滿足壓縮需求，建議安裝 PyMuPDF：

```bash
pip install pymupdf
```

```python
import fitz  # PyMuPDF

def compress_with_pymupdf(
    pdf_path: Path,
    quality: CompressQuality = "medium"
) -> Path:
    """使用 PyMuPDF 壓縮 PDF"""
    doc = fitz.open(str(pdf_path))
    
    # 壓縮設定
    compression_settings = {
        "low": {"dpi": 72, "jpeg": 60},
        "medium": {"dpi": 150, "jpeg": 75},
        "high": {"dpi": 200, "jpeg": 85}
    }
    settings = compression_settings.get(quality, compression_settings["medium"])
    
    # 壓縮每個頁面
    for page in doc:
        # 獲取頁面圖片並壓縮
        images = page.get_images()
        for img in images:
            xref = img[0]
            try:
                image_bytes = doc.extract_image(xref)
                image_data = image_bytes["image"]
                # 壓縮圖片邏輯
            except Exception:
                continue
    
    # 保存壓縮後的 PDF
    output_path = OUTPUT_DIR / f"compressed_{pdf_path.stem}.pdf"
    doc.save(str(output_path), garbage=3, deflate=True)
    doc.close()
    
    return output_path
```

## 測試計劃

### 測試環境
- **開發環境**: `.venv/` 虛擬環境
- **測試環境**: Docker 容器
- **分支**: `fix/compress-service-implementation`

### 測試案例

#### 測試 1: 壓縮前後檔案大小比較
```
輸入：10MB 的 PDF 檔案
品質：medium
預期：輸出檔案大小明顯小於輸入（至少減少 30%）
```

#### 測試 2: 不同品質等級測試
```
輸入：同一個 PDF 檔案
品質：low, medium, high
預期：low < medium < high（檔案大小）
```

#### 測試 3: 壓縮後內容完整性
```
輸入：包含文字和圖片的 PDF
預期：壓縮後文字可讀，圖片可辨識
```

### Docker 測試步驟

```bash
# 1. 切換到修復分支
git checkout fix/compress-service-implementation

# 2. 在虛擬環境中測試
cd backend
../.venv/Scripts/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 7999

# 3. 測試壓縮 API
curl -X POST http://localhost:7999/api/pdf/compress \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_id": "test-pdf-id",
    "quality": "medium"
  }'

# 4. 比較檔案大小
ls -lh uploads/outputs/*.pdf

# 5. Docker 完整測試
docker-compose down
docker-compose build
docker-compose up -d
```

## 清理工作

合併前需要移除的日誌：

```python
# 移除以下日誌語句
logger.warning(f"[compress] ⚠️ 警告：compress() 方法只是複製 PDF，沒有實際壓縮圖片內容")
logger.warning(f"[compress] ⚠️ 建議使用 compress_with_image_resizing() 來真正壓縮 PDF")
logger.info(f"[compress] 開始壓縮：{pdf_path}, quality={quality}")
# ... 其他診斷日誌
```

## 相關檔案

- [`backend/app/services/compress_service.py`](backend/app/services/compress_service.py)
- [`backend/app/routers/pdf.py`](backend/app/routers/pdf.py:214-244)
- [`backend/app/models/schemas.py`](backend/app/models/schemas.py:91-102)

## Git 分支策略

```bash
# 從 main 建立新分支
git checkout main
git pull origin main
git checkout -b fix/compress-service-implementation

# 進行修復和測試
# ...

# 提交變更
git add .
git commit -m "fix: 實現 compress_service 的實際壓縮功能

- 重構 compress() 方法呼叫真正的壓縮邏輯
- 增強 compress_with_image_resizing() 方法
- 移除診斷用的日誌語句"

# 建立 Pull Request 合併到 main
```

## 注意事項

1. **依賴管理**: 如果使用 PyMuPDF，需要更新 `requirements.txt`
2. **Docker 镜像**: 需要重新建構 Docker 镜像以包含新的依賴
3. **性能測試**: 壓縮大檔案時需要測試性能表現
4. **後向相容**: 確保 API 介面保持不變
