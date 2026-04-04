# PDF 編輯器 - API 規格文件

## 基礎資訊

- **Base URL**: `http://localhost:8000/api`
- **Content-Type**: `application/json` (除檔案上傳外)
- **Authentication**: 無 (本地應用程式)

---

## 端點列表

### 1. 上傳 PDF 檔案

**POST** `/api/upload`

上傳一個或多個 PDF 檔案。

#### Request

- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `files`: `File[]` (required) - PDF 檔案列表

#### Response

```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "uuid-string",
        "name": "document.pdf",
        "size": 1024000,
        "pageCount": 10,
        "uploadedAt": "2024-01-01T12:00:00Z"
      }
    ]
  }
}
```

#### Errors

| 狀態碼 | 描述 |
|--------|------|
| 400 | 無有效檔案或檔案類型不支援 |
| 413 | 檔案超過大小限制 |
| 500 | 伺服器內部錯誤 |

---

### 2. 獲取 PDF 頁面資訊

**GET** `/api/pdf/{pdfId}/pages`

獲取 PDF 的頁面資訊和縮圖。

#### Path Parameters

- `pdfId`: `string` (required) - PDF 檔案 ID

#### Query Parameters

- `thumbnailSize`: `string` (optional) - 縮圖大小，預設 "medium"
  - 選項：`"small"`, `"medium"`, `"large"`

#### Response

```json
{
  "success": true,
  "data": {
    "pdfId": "uuid-string",
    "pageCount": 10,
    "pages": [
      {
        "pageNumber": 1,
        "width": 595,
        "height": 842,
        "thumbnailUrl": "/api/thumbnail/uuid/page/1"
      }
    ]
  }
}
```

---

### 3. 刪除 PDF 頁面

**POST** `/api/pdf/delete-pages`

刪除指定的頁面。

#### Request Body

```json
{
  "pdfId": "uuid-string",
  "pageNumbers": [1, 3, 5]
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| pdfId | string | PDF 檔案 ID |
| pageNumbers | number[] | 要刪除的頁面號碼列表 (1-based) |

#### Response

```json
{
  "success": true,
  "data": {
    "newPdfId": "new-uuid-string",
    "deletedPages": [1, 3, 5],
    "remainingPages": 7
  }
}
```

---

### 4. 重新排序 PDF 頁面

**POST** `/api/pdf/reorder-pages`

重新排列 PDF 頁面的順序。

#### Request Body

```json
{
  "pdfId": "uuid-string",
  "pageOrder": [3, 1, 4, 2, 5]
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| pdfId | string | PDF 檔案 ID |
| pageOrder | number[] | 新的頁面順序 (1-based 頁面號碼) |

#### Response

```json
{
  "success": true,
  "data": {
    "newPdfId": "new-uuid-string",
    "pageCount": 5
  }
}
```

---

### 5. 調整 PDF 頁面尺寸

**POST** `/api/pdf/resize`

調整 PDF 頁面的尺寸。

#### Request Body

```json
{
  "pdfId": "uuid-string",
  "targetSize": {
    "preset": "A4",
    "customWidth": null,
    "customHeight": null
  },
  "pages": "all",
  "maintainAspectRatio": true
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| pdfId | string | PDF 檔案 ID |
| targetSize.preset | string | 預設尺寸：`"A3"`, `"A4"`, `"A5"`, `"B2"`, `"B3"`, `"B4"`, `"B5"`, `"Letter"`, `"Legal"` |
| targetSize.customWidth | number | 自訂寬度 (pt)，使用自訂尺寸時必填 |
| targetSize.customHeight | number | 自訂高度 (pt)，使用自訂尺寸時必填 |
| pages | string | `"all"` 或 `"selected"` |
| selectedPageNumbers | number[] | 當 pages 為 "selected" 時必填 |
| maintainAspectRatio | boolean | 是否保持長寬比 |

#### 預設尺寸參考

| Preset | 寬度 (pt) | 高度 (pt) |
|--------|-----------|-----------|
| A3 | 842 | 1191 |
| A4 | 595 | 842 |
| A5 | 420 | 595 |
| B2 | 1417 | 2004 |
| B3 | 1000 | 1417 |
| B4 | 709 | 1000 |
| B5 | 500 | 709 |
| Letter | 612 | 792 |
| Legal | 612 | 1008 |

#### Response

```json
{
  "success": true,
  "data": {
    "newPdfId": "new-uuid-string",
    "newSize": {
      "width": 595,
      "height": 842
    }
  }
}
```

---

### 6. 壓縮 PDF

**POST** `/api/pdf/compress`

壓縮 PDF 檔案大小。

#### Request Body

```json
{
  "pdfId": "uuid-string",
  "quality": 75,
  "maxImageWidth": 1200,
  "removeEmbeddedFiles": true
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| pdfId | string | PDF 檔案 ID |
| quality | number | 圖片壓縮品質 (1-100)，預設 75 |
| maxImageWidth | number | 圖片最大寬度 (px)，預設 1200 |
| removeEmbeddedFiles | boolean | 是否移除嵌入檔案 |

#### Response

```json
{
  "success": true,
  "data": {
    "newPdfId": "new-uuid-string",
    "originalSize": 5242880,
    "compressedSize": 1572864,
    "compressionRatio": 70.0
  }
}
```

---

### 7. 添加文字浮水印

**POST** `/api/pdf/watermark/text`

添加文字浮水印到 PDF。

#### Request Body

```json
{
  "pdfId": "uuid-string",
  "text": "CONFIDENTIAL",
  "position": "center",
  "fontSize": 48,
  "fontFamily": "Helvetica",
  "color": "#FF0000",
  "opacity": 0.3,
  "rotation": 45,
  "pages": "all"
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| pdfId | string | PDF 檔案 ID |
| text | string | 浮水印文字 |
| position | string | 位置：`"center"`, `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"` |
| fontSize | number | 字體大小 (pt) |
| fontFamily | string | 字體家族 |
| color | string | 顏色 (hex) |
| opacity | number | 透明度 (0-1) |
| rotation | number | 旋轉角度 (度) |
| pages | string | `"all"` 或 `"selected"` |
| selectedPageNumbers | number[] | 當 pages 為 "selected" 時必填 |

#### Response

```json
{
  "success": true,
  "data": {
    "newPdfId": "new-uuid-string"
  }
}
```

---

### 8. 添加圖片浮水印

**POST** `/api/pdf/watermark/image`

添加圖片浮水印到 PDF。

#### Request

- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `pdfId`: `string` (required) - PDF 檔案 ID
  - `image`: `File` (required) - 浮水印圖片
  - `position`: `string` (optional) - 位置，預設 "center"
  - `opacity`: `number` (optional) - 透明度，預設 0.5
  - `imageWidth`: `number` (optional) - 圖片寬度 (pt)
  - `pages`: `string` (optional) - "all" 或 "selected"，預設 "all"
  - `selectedPageNumbers`: `number[]` (optional) - 選定頁面

#### Response

```json
{
  "success": true,
  "data": {
    "newPdfId": "new-uuid-string"
  }
}
```

---

### 9. PDF 轉圖片

**POST** `/api/convert/to-image`

將 PDF 轉換為圖片格式。

#### Request Body

```json
{
  "pdfId": "uuid-string",
  "format": "jpg",
  "dpi": 150,
  "pages": "all"
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| pdfId | string | PDF 檔案 ID |
| format | string | 輸出格式：`"jpg"` 或 `"png"` |
| dpi | number | 解析度 (DPI)：72, 150, 300 |
| pages | string | `"all"` 或 `"selected"` |
| selectedPageNumbers | number[] | 當 pages 為 "selected" 時必填 |

#### Response

```json
{
  "success": true,
  "data": {
    "zipUrl": "/api/download/zip-uuid",
    "imageCount": 10,
    "format": "jpg"
  }
}
```

---

### 10. 下載檔案

**GET** `/api/download/{filename}`

下載處理後的檔案。

#### Path Parameters

- `filename`: `string` (required) - 檔案名稱

#### Response

- **Content-Type**: 依檔案類型而定
- **Content-Disposition**: `attachment; filename="..."`
- **Body**: 檔案二進位資料

---

### 11. 獲取縮圖

**GET** `/api/thumbnail/{pdfId}/page/{pageNumber}`

獲取特定頁面的縮圖。

#### Path Parameters

- `pdfId`: `string` (required) - PDF 檔案 ID
- `pageNumber`: `number` (required) - 頁面號碼 (1-based)

#### Query Parameters

- `size`: `string` (optional) - 縮圖大小，預設 "medium"
  - `"small"`: 100x100
  - `"medium"`: 200x200
  - `"large"`: 400x400

#### Response

- **Content-Type**: `image/png`
- **Body**: 圖片二進位資料

---

### 12. 刪除檔案

**DELETE** `/api/pdf/{pdfId}`

刪除 PDF 檔案及其相關檔案。

#### Path Parameters

- `pdfId`: `string` (required) - PDF 檔案 ID

#### Response

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

## 通用回應格式

### 成功回應

```json
{
  "success": true,
  "data": { ... }
}
```

### 錯誤回應

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

## 錯誤碼列表

| 錯誤碼 | 描述 |
|--------|------|
| `FILE_NOT_FOUND` | 檔案不存在 |
| `INVALID_PAGE_NUMBER` | 無效的頁面號碼 |
| `INVALID_FILE_TYPE` | 無效的檔案類型 |
| `FILE_TOO_LARGE` | 檔案超過大小限制 |
| `PROCESSING_ERROR` | 處理過程中發生錯誤 |
| `INVALID_PARAMETER` | 無效的參數 |
| `CONVERSION_ERROR` | 轉換失敗 |

## CORS 設定

後端已配置 CORS 以允許前端通訊：

```python
allow_origins = ["http://localhost:5173", "http://localhost:3000"]
allow_credentials = True
allow_methods = ["*"]
allow_headers = ["*"]
```

## 速率限制

目前未實施速率限制（本地應用程式）。如需部署至生產環境，建議添加速率限制中間件。
