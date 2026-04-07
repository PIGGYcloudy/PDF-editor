# 維修計劃 03: PDF Service Resize 空白頁面問題

## 問題描述

在 [`backend/app/services/pdf_service.py`](backend/app/services/pdf_service.py:179-207) 的 `_page_to_image()` 方法中，**只創建空白圖片，沒有渲染 PDF 內容**，導致 `resize_pages()` 功能調整後的頁面會失去所有原始內容。

### 根本原因

```python
# 當前有問題的邏輯
@staticmethod
def _page_to_image(page, dpi: int = 300) -> Image.Image:
    """將 PDF 頁面轉換為圖片（目前只返回空白圖片）"""
    # 獲取頁面尺寸
    media_box = page.mediabox
    width = media_box.width
    height = media_box.height
    
    # 計算像素尺寸
    pixel_width = int(width * dpi / 72)
    pixel_height = int(height * dpi / 72)
    
    # 創建空白白色圖片 - 問題在這裡！
    image = Image.new('RGB', (pixel_width, pixel_height), color='white')
    
    return image  # 返回空白圖片，PDF 內容丟失
```

### 影響範圍

- API 端點：`POST /api/pdf/resize`
- 前端功能：PDF 頁面尺寸調整
- 嚴重程度：**高** - 功能完全無效，內容丟失

## 修復方案

### 方案：使用 pdf2image 庫正確渲染 PDF 頁面

`pdf2image` 庫可以將 PDF 頁面正確渲染為圖片，保留所有內容。

### 前置條件

確保已安裝必要的系統依賴：

```bash
# Ubuntu/Debian
apt-get install poppler-utils

# Windows (使用 Chocolatey)
choco install poppler

# Docker (已在 Dockerfile 中配置)
# RUN apt-get update && apt-get install -y poppler-utils
```

### 推薦實作

```python
from pdf2image import convert_from_path
from PIL import Image
from pathlib import Path

@staticmethod
def _page_to_image(page, dpi: int = 300) -> Image.Image:
    """
    將 PDF 頁面轉換為圖片
    
    Args:
        page: PyPDF4 的 PageObject（但我們需要 PDF 路徑）
        dpi: 解析度
    
    Returns:
        PIL Image 物件
    """
    # 注意：這裡需要 PDF 路徑，而不是 page 物件
    # 需要修改呼叫方式
    pass
```

### 重構 `resize_pages()` 方法

由於 `_page_to_image()` 需要 PDF 路徑而不是 page 物件，我們需要重構整個方法：

```python
@staticmethod
def resize_pages(
    pdf_path: Path,
    target_size: Tuple[int, int] | None = None,
    preset: str | None = None,
    keep_aspect_ratio: bool = True
) -> Path:
    """
    調整 PDF 頁面尺寸
    
    Args:
        pdf_path: PDF 檔案路徑
        target_size: 目標尺寸（寬度，高度），單位為點（points）
        preset: 預設尺寸（A4, A3, Letter 等）
        keep_aspect_ratio: 是否保持長寬比
    
    Returns:
        調整後的 PDF 檔案路徑
    """
    from pdf2image import convert_from_path
    from reportlab.lib.pagesizes import A4, A3, letter
    from reportlab.pdfgen import canvas
    from io import BytesIO
    
    # 獲取目標尺寸
    if preset:
        preset_map = {
            "A4": A4,
            "A3": A3,
            "Letter": letter,
        }
        target_size = preset_map.get(preset.upper(), A4)
    
    if not target_size:
        target_size = A4  # 預設 A4
    
    # 將 PDF 轉換為圖片
    images = convert_from_path(str(pdf_path), dpi=300)
    
    # 創建新的 PDF
    output_buffer = BytesIO()
    packet = canvas.Canvas(output_buffer, pagesize=target_size)
    
    for image in images:
        # 計算調整後的大小
        img_width, img_height = image.size
        target_width, target_height = target_size
        
        if keep_aspect_ratio:
            # 保持長寬比調整大小
            img_ratio = img_width / img_height
            target_ratio = target_width / target_height
            
            if img_ratio > target_ratio:
                # 圖片較寬
                new_width = target_width
                new_height = int(target_width / img_ratio)
            else:
                # 圖片較高
                new_height = target_height
                new_width = int(target_height * img_ratio)
        else:
            new_width, new_height = target_width, target_height
        
        # 將圖片轉換為 PIL Image（如果还不是）
        if not isinstance(image, Image.Image):
            image = Image.frombytes('RGB', image.size, image.tobytes())
        
        # 調整圖片大小
        resized_image = image.resize((int(new_width), int(new_height)), Image.LANCZOS)
        
        # 添加到新頁面
        packet.addPage()
        # 注意：這裡需要將 PIL Image 轉換為 PDF 可接受的格式
        # 可能需要額外的處理
    
    packet.save()
    
    # 保存輸出檔案
    output_path = OUTPUT_DIR / f"resized_{pdf_path.stem}.pdf"
    with open(output_path, 'wb') as f:
        f.write(output_buffer.getvalue())
    
    return output_path
```

### 更簡單的方案：使用 PyMuPDF（推薦）

PyMuPDF 可以更簡單地實現 PDF 頁面尺寸調整：

```python
import fitz  # PyMuPDF
from reportlab.lib.pagesizes import A4, A3, letter

@staticmethod
def resize_pages(
    pdf_path: Path,
    target_size: Tuple[int, int] | None = None,
    preset: str | None = None,
    keep_aspect_ratio: bool = True
) -> Path:
    """
    使用 PyMuPDF 調整 PDF 頁面尺寸
    
    Args:
        pdf_path: PDF 檔案路徑
        target_size: 目標尺寸（寬度，高度），單位為點（points）
        preset: 預設尺寸（A4, A3, Letter 等）
        keep_aspect_ratio: 是否保持長寬比
    
    Returns:
        調整後的 PDF 檔案路徑
    """
    # 獲取目標尺寸
    preset_map = {
        "A4": A4,
        "A3": A3,
        "Letter": letter,
    }
    
    if preset:
        target_size = preset_map.get(preset.upper(), A4)
    
    if not target_size:
        target_size = A4  # 預設 A4
    
    # 打開 PDF
    doc = fitz.open(str(pdf_path))
    
    # 創建新的 PDF
    new_doc = fitz.open()
    
    for page in doc:
        # 創建新頁面，使用目標尺寸
        new_page = new_doc.new_page(width=target_size[0], height=target_size[1])
        
        # 獲取原始頁面矩陣
        src_rect = fitz.Rect(page.rect)
        
        # 計算目標矩形
        if keep_aspect_ratio:
            # 保持長寬比
            src_ratio = src_rect.width / src_rect.height
            target_ratio = target_size[0] / target_size[1]
            
            if src_ratio > target_ratio:
                # 原始較寬
                new_width = target_size[0]
                new_height = target_size[0] / src_ratio
            else:
                # 原始較高
                new_height = target_size[1]
                new_width = target_size[1] * src_ratio
            
            # 居中
            dst_rect = fitz.Rect(
                (target_size[0] - new_width) / 2,
                (target_size[1] - new_height) / 2,
                (target_size[0] + new_width) / 2,
                (target_size[1] + new_height) / 2
            )
        else:
            # 不保持長寬比
            dst_rect = fitz.Rect(0, 0, target_size[0], target_size[1])
        
        # 複製頁面內容到新頁面
        new_page.show_pdf_page(dst_rect, doc, page.number)
    
    # 保存
    output_path = OUTPUT_DIR / f"resized_{pdf_path.stem}.pdf"
    new_doc.save(str(output_path))
    new_doc.close()
    doc.close()
    
    return output_path
```

## 測試計劃

### 測試環境
- **開發環境**: `.venv/` 虛擬環境
- **測試環境**: Docker 容器
- **分支**: `fix/pdf-service-resize-blank-pages`

### 測試案例

#### 測試 1: A4 轉 A3
```
輸入：A4 尺寸的 PDF（包含文字和圖片）
預設：A3
預期：輸出為 A3 尺寸，內容正確顯示且保持長寬比
```

#### 測試 2: A3 轉 A4
```
輸入：A3 尺寸的 PDF
預設：A4
預期：輸出為 A4 尺寸，內容正確縮放
```

#### 測試 3: 自定義尺寸
```
輸入：任意尺寸 PDF
目標尺寸：(800, 600)
預期：輸出為指定尺寸，內容正確顯示
```

#### 測試 4: 不保持長寬比
```
輸入：橫向 PDF
預設：A4
keep_aspect_ratio: false
預期：內容填滿整個 A4 頁面（可能變形）
```

### Docker 測試步驟

```bash
# 1. 切換到修復分支
git checkout fix/pdf-service-resize-blank-pages

# 2. 安裝依賴（如果使用 PyMuPDF）
cd backend
../.venv/Scripts/python -m pip install pymupdf

# 3. 啟動服務
../.venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 7999

# 4. 測試 resize API
curl -X POST http://localhost:7999/api/pdf/resize \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_id": "test-pdf-id",
    "preset": "A3",
    "keep_aspect_ratio": true
  }'

# 5. 下載並檢查輸出檔案
# 確認內容正確顯示，沒有空白頁面

# 6. Docker 完整測試
docker-compose down
# 更新 Dockerfile 以包含 PyMuPDF
docker-compose build
docker-compose up -d
```

## 清理工作

合併前需要移除的日誌：

```python
# 移除以下日誌語句
logger.warning(f"[resize_pages] ⚠️ 警告：_page_to_image() 只返回空白圖片，調整後的頁面將失去原始內容")
logger.error(f"[_page_to_image] ⚠️ 返回空白圖片 {pixel_width}x{pixel_height}，PDF 內容將丟失！")
# ... 其他診斷日誌
```

## 相關檔案

- [`backend/app/services/pdf_service.py`](backend/app/services/pdf_service.py)
- [`backend/app/routers/pdf.py`](backend/app/routers/pdf.py:173-211)
- [`backend/requirements.txt`](backend/requirements.txt) - 可能需要添加 PyMuPDF
- [`backend/Dockerfile`](backend/Dockerfile) - 可能需要添加系統依賴

## Git 分支策略

```bash
# 從 main 建立新分支
git checkout main
git pull origin main
git checkout -b fix/pdf-service-resize-blank-pages

# 進行修復和測試
# ...

# 提交變更
git add .
git commit -m "fix: 修復 pdf_service resize 功能空白頁面問題

- 使用 PyMuPDF 正確渲染 PDF 頁面內容
- 重構 resize_pages() 方法
- 支援保持長寬比和自定義尺寸
- 移除診斷用的日誌語句"

# 建立 Pull Request 合併到 main
```

## 注意事項

1. **依賴管理**: 如果使用 PyMuPDF，需要更新 `requirements.txt`
2. **Docker 镜像**: 需要重新建構 Docker 镜像
3. **性能測試**: 大檔案轉換需要測試性能
4. **記憶體使用**: PDF 轉圖片可能消耗大量記憶體，需要監控
5. **後向相容**: 確保 API 介面保持不變
