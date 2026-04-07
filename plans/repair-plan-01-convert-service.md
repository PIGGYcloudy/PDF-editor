# 維修計劃 01: Convert Service 頁面索引錯位問題

## 問題描述

在 [`backend/app/services/convert_service.py`](backend/app/services/convert_service.py:25-129) 的 `convert_to_images()` 方法中，當使用者選擇非連續頁面時（例如 `[1, 3, 5]`），會發生頁面索引錯位問題。

### 根本原因

```python
# 當前有問題的邏輯
first_page = min(page_numbers)  # 1
last_page = max(page_numbers)   # 5
# convert_from_path 會轉換頁面 1-5（共 5 頁）
# 但 page_numbers 只有 [1, 3, 5]（共 3 個元素）
# 使用 page_numbers[idx] 命名時會發生索引越界或名稱錯誤
```

### 影響範圍

- API 端點：`POST /api/convert/to-image`
- 前端功能：PDF 轉圖片（選擇部分頁面時）
- 嚴重程度：**高** - 導致功能錯誤

## 修復方案

### 方案 A：逐頁轉換（推薦）

修改為逐頁轉換，確保每個選中的頁面都被正確處理：

```python
def convert_to_images(
    pdf_path: Path,
    page_numbers: List[int] | None = None,
    dpi: int = 150,
    output_format: str = "png"
) -> List[Path]:
    """
    將 PDF 轉換為圖片
    
    Args:
        pdf_path: PDF 檔案路徑
        page_numbers: 要轉換的頁面號碼列表（從 1 開始），None 表示所有頁面
        dpi: 解析度（72, 150, 300）
        output_format: 輸出格式（png, jpg, pdf）
    
    Returns:
        轉換後的圖片檔案路徑列表
    """
    if page_numbers is None:
        # 獲取總頁數
        reader = PdfReader(pdf_path)
        page_numbers = list(range(1, len(reader.pages) + 1))
    
    # 驗證頁面號碼
    validate_page_numbers(page_numbers, len(PdfReader(pdf_path).pages))
    
    output_dir = OUTPUT_DIR / "convert" / pdf_path.stem
    output_dir.mkdir(parents=True, exist_ok=True)
    output_paths = []
    
    # 逐頁轉換，避免索引錯位
    for page_num in page_numbers:
        # 使用 convert_single_page_to_image 轉換單頁
        image_path = convert_single_page_to_image(
            pdf_path=pdf_path,
            page_number=page_num,
            dpi=dpi,
            output_format=output_format,
            output_dir=output_dir
        )
        output_paths.append(image_path)
    
    return output_paths
```

### 優點
- 邏輯清晰，不會有索引錯位問題
- 可以並行處理（未來優化）
- 錯誤處理更精確

### 缺點
- 多次讀取 PDF（性能稍差，但可接受）

## 測試計劃

### 測試環境
- **開發環境**: `.venv/` 虛擬環境
- **測試環境**: Docker 容器
- **分支**: `fix/convert-service-page-index`

### 測試案例

#### 測試 1: 連續頁面轉換
```
輸入：page_numbers = [1, 2, 3]
預期：產生 3 張圖片，命名正確
```

#### 測試 2: 非連續頁面轉換
```
輸入：page_numbers = [1, 3, 5]
預期：產生 3 張圖片，分別對應第 1、3、5 頁
```

#### 測試 3: 單頁轉換
```
輸入：page_numbers = [2]
預期：產生 1 張圖片，對應第 2 頁
```

#### 測試 4: 所有頁面轉換
```
輸入：page_numbers = None
預期：產生所有頁面的圖片
```

### Docker 測試步驟

```bash
# 1. 切換到修復分支
git checkout fix/convert-service-page-index

# 2. 在虛擬環境中測試
cd backend
../.venv/Scripts/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 7999

# 3. 使用 Postman 或 curl 測試 API
curl -X POST http://localhost:7999/api/convert/to-image \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_id": "test-pdf-id",
    "page_numbers": [1, 3, 5],
    "dpi": 150,
    "output_format": "png"
  }'

# 4. Docker 完整測試
docker-compose down
# 更新镜像後
docker-compose up -d
```

## 清理工作

合併前需要移除的日誌：

```python
# 移除以下日誌語句
logger.warning(f"[convert_to_images] ⚠️ 警告：convert_from_path 將轉換頁面範圍：{first_page} 到 {last_page}")
logger.error(f"[convert_to_images] ⚠️ 頁面數量不匹配！這表示 page_numbers 是非連續的，會導致索引錯位")
logger.debug(f"[convert_to_images] 開始轉換，page_numbers={page_numbers}, dpi={dpi}, format={output_format}")
# ... 其他診斷日誌
```

## 相關檔案

- [`backend/app/services/convert_service.py`](backend/app/services/convert_service.py)
- [`backend/app/routers/convert.py`](backend/app/routers/convert.py)
- [`backend/app/utils/pdf_utils.py`](backend/app/utils/pdf_utils.py)

## Git 分支策略

```bash
# 從 main 建立新分支
git checkout main
git pull origin main
git checkout -b fix/convert-service-page-index

# 進行修復和測試
# ...

# 提交變更
git add .
git commit -m "fix: 修復 convert_service 非連續頁面索引錯位問題

- 修改 convert_to_images() 為逐頁轉換
- 避免使用 convert_from_path 導致範圍轉換
- 移除診斷用的日誌語句"

# 建立 Pull Request 合併到 main
```
