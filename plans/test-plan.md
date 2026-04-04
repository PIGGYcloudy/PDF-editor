# PDF 編輯器 - 測試計畫

## 測試策略

本專案採用分層測試策略：
1. **單元測試** - 測試個別函數和元件
2. **整合測試** - 測試 API 端點和服務整合
3. **端到端測試** - 測試完整使用者流程

---

## 後端測試

### 單元測試

#### 1. PDF 服務測試 (`test_pdf_service.py`)

```python
# 測試刪除頁面
def test_delete_single_page():
    """測試刪除單一頁面"""
    
def test_delete_multiple_pages():
    """測試刪除多個頁面"""
    
def test_delete_all_pages():
    """測試刪除所有頁面（應失敗）"""

# 測試重新排序
def test_reorder_pages():
    """測試頁面重新排序"""
    
def test_reorder_invalid_order():
    """測試無效的排序（應失敗）"""

# 測試尺寸調整
def test_resize_to_preset():
    """測試調整到預設尺寸"""
    
def test_resize_to_custom():
    """測試調整到自訂尺寸"""
    
def test_resize_maintain_aspect_ratio():
    """測試保持長寬比"""
```

#### 2. 壓縮服務測試 (`test_compress_service.py`)

```python
def test_compress_low_quality():
    """測試低品質壓縮"""
    
def test_compress_high_quality():
    """測試高品質壓縮"""
    
def test_compress_with_image_resize():
    """測試壓縮時調整圖片大小"""
```

#### 3. 浮水印服務測試 (`test_watermark_service.py`)

```python
# 文字浮水印
def test_text_watermark_center():
    """測試中心位置文字浮水印"""
    
def test_text_watermark_corners():
    """測試角落位置文字浮水印"""
    
def test_text_watermark_rotation():
    """測試旋轉文字浮水印"""
    
def test_text_watermark_opacity():
    """測試透明度設定"""

# 圖片浮水印
def test_image_watermark_center():
    """測試中心位置圖片浮水印"""
    
def test_image_watermark_size():
    """測試圖片浮水印大小"""
```

#### 4. 轉換服務測試 (`test_convert_service.py`)

```python
def test_convert_to_jpg():
    """測試轉換為 JPG"""
    
def test_convert_to_png():
    """測試轉換為 PNG"""
    
def test_convert_different_dpi():
    """測試不同解析度轉換"""
```

### 整合測試

#### API 端點測試 (`test_api.py`)

```python
# 測試上傳端點
def test_upload_pdf():
    """測試 PDF 上傳"""
    
def test_upload_invalid_file():
    """測試上傳無效檔案"""
    
def test_upload_too_large_file():
    """測試上傳過大檔案"""

# 測試頁面操作端點
def test_delete_pages_api():
    """測試刪除頁面 API"""
    
def test_reorder_pages_api():
    """測試重新排序 API"""
    
def test_resize_api():
    """測試尺寸調整 API"""

# 測試進階功能端點
def test_compress_api():
    """測試壓縮 API"""
    
def test_watermark_text_api():
    """測試文字浮水印 API"""
    
def test_watermark_image_api():
    """測試圖片浮水印 API"""
    
def test_convert_to_image_api():
    """測試轉換為圖片 API"""
```

---

## 前端測試

### 元件測試

#### 1. FileUpload 元件測試

```typescript
// 測試檔案拖曳
test('drag and drop files', () => {
  // 測試拖曳檔案到區域
});

// 測試點擊選擇檔案
test('click to select files', () => {
  // 測試點擊開啟檔案選擇器
});

// 測試檔案驗證
test('validate file type', () => {
  // 測試非 PDF 檔案顯示錯誤
});

// 測試多檔案上傳
test('upload multiple files', () => {
  // 測試同時上傳多個檔案
});
```

#### 2. PDFPreview 元件測試

```typescript
// 測試頁面渲染
test('render page thumbnails', () => {
  // 測試正確顯示所有頁面縮圖
});

// 測試頁面選取
test('select page', () => {
  // 測試點擊選取頁面
});

// 測試多選
test('select multiple pages', () => {
  // 測試 Ctrl+Click 多選
});
```

#### 3. PageReorder 元件測試

```typescript
// 測試拖曳排序
test('drag and drop to reorder', () => {
  // 測試拖曳頁面改變順序
});

// 測試排序完成
test('on reorder complete', () => {
  // 測試排序完成後呼叫 API
});
```

#### 4. SizeSelector 元件測試

```typescript
// 測試預設尺寸選擇
test('select preset size', () => {
  // 測試選擇 A4 等預設尺寸
});

// 測試自訂尺寸輸入
test('input custom size', () => {
  // 測試輸入自訂寬高
});

// 測試長寬比鎖定
test('aspect ratio lock', () => {
  // 測試鎖定長寬比時同步更新
});
```

#### 5. Watermark 元件測試

```typescript
// 測試文字浮水印設定
test('configure text watermark', () => {
  // 測試設定文字、字體、顏色等
});

// 測試圖片浮水印上傳
test('upload image watermark', () => {
  // 測試上傳浮水印圖片
});

// 測試位置選擇
test('select watermark position', () => {
  // 測試選擇不同位置
});

// 測試透明度調整
test('adjust opacity', () => {
  // 測試調整透明度滑桿
});
```

### Hooks 測試

#### usePDF Hook 測試

```typescript
// 測試 PDF 載入
test('load PDF', async () => {
  // 測試載入 PDF 並獲取頁面資訊
});

// 測試頁面操作
test('perform page operations', async () => {
  // 測試刪除、排序等操作
});

// 測試操作歷史
test('operation history', () => {
  // 測試 undo/redo 功能
});
```

---

## 端到端測試

### 測試場景

#### 場景 1: 基本工作流程

```typescript
test('basic workflow: upload, preview, delete, download', async () => {
  // 1. 上傳 PDF 檔案
  await page.dragAndDrop('.dropzone', 'test.pdf');
  
  // 2. 驗證頁面預覽顯示
  await expect('.page-thumbnail').toHaveCount(10);
  
  // 3. 刪除第 5 頁
  await page.click('.page-5');
  await page.click('.delete-button');
  
  // 4. 驗證頁面數量減少
  await expect('.page-thumbnail').toHaveCount(9);
  
  // 5. 下載處理後的檔案
  await page.click('.download-button');
  // 驗證下載發生
});
```

#### 場景 2: 頁面重新排序

```typescript
test('reorder pages', async () => {
  // 1. 上傳多頁面 PDF
  await page.dragAndDrop('.dropzone', 'multipage.pdf');
  
  // 2. 拖曳第 1 頁到最後
  await page.dragAndDrop('.page-1', '.page-10');
  
  // 3. 驗證排序完成
  await expect('.page-order').toHaveText('2,3,4,5,6,7,8,9,10,1');
  
  // 4. 下載並驗證
  await page.click('.download-button');
});
```

#### 場景 3: 尺寸調整

```typescript
test('resize pages', async () => {
  // 1. 上傳 PDF
  await page.dragAndDrop('.dropzone', 'test.pdf');
  
  // 2. 選擇 A4 尺寸
  await page.selectOption('.size-select', 'A4');
  
  // 3. 點擊調整尺寸
  await page.click('.resize-button');
  
  // 4. 驗證處理完成
  await expect('.success-message').toBeVisible();
});
```

#### 場景 4: PDF 壓縮

```typescript
test('compress PDF', async () => {
  // 1. 上傳大檔案 PDF
  await page.dragAndDrop('.dropzone', 'large.pdf');
  
  // 2. 設定壓縮品質為 50
  await page.dragToPosition('.quality-slider', { x: 50, y: 0 });
  
  // 3. 點擊壓縮
  await page.click('.compress-button');
  
  // 4. 驗證壓縮比顯示
  await expect('.compression-ratio').toBeVisible();
});
```

#### 場景 5: 添加文字浮水印

```typescript
test('add text watermark', async () => {
  // 1. 上傳 PDF
  await page.dragAndDrop('.dropzone', 'test.pdf');
  
  // 2. 開啟浮水印面板
  await page.click('.watermark-button');
  
  // 3. 輸入浮水印文字
  await page.fill('.watermark-text', 'CONFIDENTIAL');
  
  // 4. 設定位置和透明度
  await page.selectOption('.position-select', 'center');
  await page.dragToPosition('.opacity-slider', { x: 30, y: 0 });
  
  // 5. 添加浮水印
  await page.click('.apply-watermark-button');
  
  // 6. 驗證處理完成
  await expect('.success-message').toBeVisible();
});
```

#### 場景 6: PDF 轉圖片

```typescript
test('convert PDF to images', async () => {
  // 1. 上傳 PDF
  await page.dragAndDrop('.dropzone', 'test.pdf');
  
  // 2. 選擇轉換為 JPG
  await page.click('.format-jpg');
  
  // 3. 選擇解析度 300 DPI
  await page.selectOption('.dpi-select', '300');
  
  // 4. 點擊轉換
  await page.click('.convert-button');
  
  // 5. 驗證 ZIP 下載
  await page.click('.download-zip-button');
  // 驗證下載發生
});
```

---

## 測試資料

### 測試 PDF 檔案

準備以下測試檔案：

| 檔案名稱 | 描述 | 頁面數 | 大小 |
|---------|------|-------|------|
| `single-page.pdf` | 單頁面 PDF | 1 | ~50KB |
| `multipage.pdf` | 多頁面 PDF | 10 | ~500KB |
| `large.pdf` | 大檔案 PDF | 50 | ~5MB |
| `with-images.pdf` | 含圖片 PDF | 5 | ~2MB |
| `with-text.pdf` | 純文字 PDF | 10 | ~100KB |
| `a3-size.pdf` | A3 尺寸 PDF | 1 | ~100KB |
| `a4-size.pdf` | A4 尺寸 PDF | 1 | ~100KB |

### 測試圖片檔案

| 檔案名稱 | 描述 | 格式 |
|---------|------|------|
| `watermark-transparent.png` | 透明背景浮水印 | PNG |
| `watermark-logo.png` | Logo 浮水印 | PNG |
| `watermark-colored.jpg` | 彩色浮水印 | JPG |

---

## 測試執行

### 後端測試執行

```bash
cd backend
pytest tests/
```

### 前端測試執行

```bash
cd frontend
npm test
```

### 端到端測試執行

```bash
cd frontend
npm run test:e2e
```

---

## 測試覆蓋率目標

| 模組 | 目標覆蓋率 |
|------|-----------|
| 後端服務 | 80% |
| 前端元件 | 70% |
| API 端點 | 90% |
| 端到端流程 | 主要流程 100% |

---

## 效能測試

### 測試項目

1. **大檔案處理時間**
   - 50MB PDF 處理時間 < 30 秒
   - 100 頁 PDF 處理時間 < 60 秒

2. **並發處理**
   - 同時處理 5 個檔案不崩潰

3. **記憶體使用**
   - 處理過程中記憶體使用 < 512MB

### 測試工具

- **後端**: `locust` 或 `pytest-benchmark`
- **前端**: `Lighthouse`

---

## 測試檢查清單

### 功能測試

- [ ] 檔案上傳（單檔案）
- [ ] 檔案上傳（多檔案）
- [ ] 拖曳上傳
- [ ] PDF 頁面預覽
- [ ] 頁面刪除（單頁）
- [ ] 頁面刪除（多頁）
- [ ] 頁面拖曳排序
- [ ] 單頁面尺寸調整
- [ ] 所有頁面尺寸調整
- [ ] 預設尺寸選擇
- [ ] 自訂尺寸輸入
- [ ] PDF 壓縮（低品質）
- [ ] PDF 壓縮（高品質）
- [ ] 文字浮水印（中心）
- [ ] 文字浮水印（角落）
- [ ] 文字浮水印（旋轉）
- [ ] 圖片浮水印
- [ ] PDF 轉 JPG
- [ ] PDF 轉 PNG
- [ ] 檔案下載

### 錯誤處理測試

- [ ] 上傳非 PDF 檔案
- [ ] 上傳過大檔案
- [ ] 刪除所有頁面
- [ ] 無效的頁面號碼
- [ ] 無效的尺寸參數
- [ ] 網路錯誤處理

### 使用者體驗測試

- [ ] 載入狀態顯示
- [ ] 錯誤訊息清晰
- [ ] 成功提示顯示
- [ ] 響應式設計
- [ ] 無障礙功能
