# 維修計劃 04: Watermark Service 旋轉尺寸變化問題

## 問題描述

在 [`backend/app/services/watermark_service.py`](backend/app/services/watermark_service.py:100-189) 的 `_add_text_watermark_to_image()` 方法中，當浮水印旋轉角度不為 0 且 `expand=True` 時，**浮水印圖層尺寸會改變**，然後被強制縮放回原圖尺寸，導致浮水印變形。

### 根本原因

```python
# 當前有問題的邏輯
def _add_text_watermark_to_image(
    image: Image.Image,
    text: str,
    # ... 其他參數
    rotation: int = 0,
    # ...
) -> Image.Image:
    # 創建浮水印圖層
    watermark_layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
    
    # 繪製文字
    # ...
    
    # 旋轉浮水印 - 問題在這裡！
    if rotation != 0:
        watermark_layer = watermark_layer.rotate(
            rotation,
            expand=True,  # 這會改變圖片尺寸！
            # ...
        )
        # 旋轉後 watermark_layer.size != image.size
    
    # 強制縮放回原圖尺寸 - 導致變形
    if watermark_layer.size != image.size:
        watermark_layer = watermark_layer.resize(image.size)  # 變形！
    
    return Image.alpha_composite(image, watermark_layer)
```

### 影響範圍

- API 端點：`POST /api/pdf/watermark/text`
- 前端功能：文字浮水印（使用旋轉時）
- 嚴重程度：**中** - 浮水印變形，影響美觀

## 修復方案

### 方案：正確處理旋轉後的浮水印

不應該強制縮放旋轉後的浮水印，而是應該：

1. **在中心位置合成旋轉後的浮水印**
2. **或者預先計算旋轉後的尺寸**

### 推薦實作

```python
@staticmethod
def _add_text_watermark_to_image(
    image: Image.Image,
    text: str,
    font_size: int = 48,
    font_color: Tuple[int, int, int] = (255, 255, 255),
    opacity: int = 128,
    position: str = "center",
    rotation: int = 45,
    font_path: str | None = None
) -> Image.Image:
    """
    在圖片上添加文字浮水印
    
    Args:
        image: 原始圖片
        text: 浮水印文字
        font_size: 字體大小
        font_color: 字體顏色 (R, G, B)
        opacity: 透明度 (0-255)
        position: 位置 (center, top-left, top-right, bottom-left, bottom-right)
        rotation: 旋轉角度
        font_path: 字體檔案路徑
    
    Returns:
        添加浮水印後的圖片
    """
    # 確保圖片是 RGBA 模式
    if image.mode != 'RGBA':
        image = image.convert('RGBA')
    
    # 創建透明圖層
    watermark_layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(watermark_layer)
    
    # 載入字體
    font = ImageFont.truetype(font_path, font_size) if font_path else ImageFont.load_default()
    
    # 計算文字尺寸
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # 創建僅包含文字的圖層
    text_layer = Image.new('RGBA', (text_width, text_height), (0, 0, 0, 0))
    text_draw = ImageDraw.Draw(text_layer)
    
    # 設置顏色（包含透明度）
    color_with_opacity = (*font_color, opacity)
    text_draw.text((0, 0), text, font=font, fill=color_with_opacity)
    
    # 旋轉文字圖層
    if rotation != 0:
        # 旋轉時 expand=True，讓旋轉後的文字完整顯示
        text_layer = text_layer.rotate(
            rotation,
            expand=True,
            resample=Image.BICUBIC,
            fillcolor=(0, 0, 0, 0)
        )
    
    # 計算位置
    text_layer_width, text_layer_height = text_layer.size
    img_width, img_height = image.size
    
    if position == "center":
        x = (img_width - text_layer_width) // 2
        y = (img_height - text_layer_height) // 2
    elif position == "top-left":
        x = 10
        y = 10
    elif position == "top-right":
        x = img_width - text_layer_width - 10
        y = 10
    elif position == "bottom-left":
        x = 10
        y = img_height - text_layer_height - 10
    elif position == "bottom-right":
        x = img_width - text_layer_width - 10
        y = img_height - text_layer_height - 10
    else:
        x = (img_width - text_layer_width) // 2
        y = (img_height - text_layer_height) // 2
    
    # 將文字圖層合成到主圖層
    watermark_layer.paste(text_layer, (x, y), text_layer)
    
    # 合成到原始圖片
    return Image.alpha_composite(image, watermark_layer)
```

### 改進的圖片浮水印方法

同樣適用於 `_add_image_watermark_to_image()`：

```python
@staticmethod
def _add_image_watermark_to_image(
    image: Image.Image,
    watermark_path: Path,
    size: float = 0.3,
    position: str = "center",
    rotation: int = 0,
    opacity: int = 128
) -> Image.Image:
    """
    在圖片上添加圖片浮水印
    
    Args:
        image: 原始圖片
        watermark_path: 浮水印圖片路徑
        size: 浮水印相對於原始圖片的大小比例
        position: 位置
        rotation: 旋轉角度
        opacity: 透明度
    
    Returns:
        添加浮水印後的圖片
    """
    # 確保圖片是 RGBA 模式
    if image.mode != 'RGBA':
        image = image.convert('RGBA')
    
    # 載入浮水印圖片
    watermark = Image.open(watermark_path)
    if watermark.mode != 'RGBA':
        watermark = watermark.convert('RGBA')
    
    # 計算浮水印尺寸
    img_width, img_height = image.size
    watermark_width = int(img_width * size)
    watermark_height = int(img_height * size)
    watermark = watermark.resize((watermark_width, watermark_height), Image.LANCZOS)
    
    # 設置透明度
    if opacity < 255:
        # 分離 RGBA 通道
        r, g, b, a = watermark.split()
        # 調整 alpha 通道
        a = a.point(lambda x: int(x * opacity / 255))
        # 重新組合
        watermark = Image.merge('RGBA', (r, g, b, a))
    
    # 旋轉浮水印
    if rotation != 0:
        watermark = watermark.rotate(
            rotation,
            expand=True,  # 允許尺寸變化
            resample=Image.BICUBIC,
            fillcolor=(0, 0, 0, 0)
        )
        # 更新尺寸
        watermark_width, watermark_height = watermark.size
    
    # 計算位置
    if position == "center":
        x = (img_width - watermark_width) // 2
        y = (img_height - watermark_height) // 2
    elif position == "top-left":
        x = 10
        y = 10
    elif position == "top-right":
        x = img_width - watermark_width - 10
        y = 10
    elif position == "bottom-left":
        x = 10
        y = img_height - watermark_height - 10
    elif position == "bottom-right":
        x = img_width - watermark_width - 10
        y = img_height - watermark_height - 10
    else:
        x = (img_width - watermark_width) // 2
        y = (img_height - watermark_height) // 2
    
    # 創建透明圖層並合成
    watermark_layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
    watermark_layer.paste(watermark, (x, y), watermark)
    
    return Image.alpha_composite(image, watermark_layer)
```

## 測試計劃

### 測試環境
- **開發環境**: `.venv/` 虛擬環境
- **測試環境**: Docker 容器
- **分支**: `fix/watermark-service-rotation-distortion`

### 測試案例

#### 測試 1: 文字浮水印旋轉 45 度
```
輸入：PDF 檔案
文字："CONFIDENTIAL"
旋轉：45 度
位置：center
預期：浮水印正確旋轉，無變形，居中顯示
```

#### 測試 2: 文字浮水印旋轉 90 度
```
輸入：PDF 檔案
文字："DRAFT"
旋轉：90 度
位置：center
預期：浮水印垂直顯示，無變形
```

#### 測試 3: 圖片浮水印旋轉
```
輸入：PDF 檔案 + Logo 圖片
旋轉：30 度
位置：bottom-right
預期：Logo 正確旋轉，無變形，位於右下角
```

#### 測試 4: 不同位置測試
```
位置：top-left, top-right, bottom-left, bottom-right, center
預期：所有位置都正確顯示，無變形
```

### Docker 測試步驟

```bash
# 1. 切換到修復分支
git checkout fix/watermark-service-rotation-distortion

# 2. 在虛擬環境中測試
cd backend
../.venv/Scripts/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 7999

# 3. 測試文字浮水印 API
curl -X POST http://localhost:7999/api/pdf/watermark/text \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_id": "test-pdf-id",
    "text": "CONFIDENTIAL",
    "font_size": 48,
    "font_color": [255, 0, 0],
    "opacity": 128,
    "position": "center",
    "rotation": 45
  }'

# 4. 測試圖片浮水印 API
curl -X POST http://localhost:7999/api/pdf/watermark/image \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_id": "test-pdf-id",
    "watermark_id": "logo-image-id",
    "size": 0.3,
    "position": "center",
    "rotation": 30,
    "opacity": 128
  }'

# 5. 下載並檢查輸出檔案
# 確認浮水印無變形

# 6. Docker 完整測試
docker-compose down
docker-compose build
docker-compose up -d
```

## 清理工作

合併前需要移除的日誌：

```python
# 移除以下日誌語句
logger.warning(f"[_add_text_watermark_to_image] ⚠️ 旋轉 {rotation} 度，expand=True 會改變浮水印尺寸")
logger.error(f"[_add_text_watermark_to_image] ⚠️ 浮水印尺寸 {watermark_layer.size} 與圖片尺寸 {image.size} 不同，將強制縮放導致變形")
# ... 其他診斷日誌
```

## 相關檔案

- [`backend/app/services/watermark_service.py`](backend/app/services/watermark_service.py)
- [`backend/app/routers/pdf.py`](backend/app/routers/pdf.py:247-335)
- [`backend/app/models/schemas.py`](backend/app/models/schemas.py:106-129)

## Git 分支策略

```bash
# 從 main 建立新分支
git checkout main
git pull origin main
git checkout -b fix/watermark-service-rotation-distortion

# 進行修復和測試
# ...

# 提交變更
git add .
git commit -m "fix: 修復 watermark_service 旋轉導致浮水印變形問題

- 重構 _add_text_watermark_to_image() 正確處理旋轉
- 重構 _add_image_watermark_to_image() 正確處理旋轉
- 移除強制縮放邏輯，改為正確定位
- 移除診斷用的日誌語句"

# 建立 Pull Request 合併到 main
```

## 注意事項

1. **字體支援**: 確保系統有必要的字體檔案
2. **透明度處理**: 正確處理 RGBA 通道的透明度
3. **性能**: 大圖片處理時注意性能
4. **後向相容**: 確保 API 介面保持不變
5. **邊界情況**: 處理浮水印大於原始圖片的情況
