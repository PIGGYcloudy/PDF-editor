# 維修計劃 05: PDF Utils 函式命名衝突問題

## 問題描述

在 [`backend/app/utils/pdf_utils.py`](backend/app/utils/pdf_utils.py:27-32) 中存在函式命名混淆問題：

- `get_pdf_page_info(pdf_path, page_number)` - 獲取**單頁**資訊
- `PDFService.get_page_info(pdf_path)` - 獲取**所有頁面**資訊

這兩個函式名稱相似但功能不同，容易造成混淆。

### 當前定義

```python
# pdf_utils.py
def get_pdf_page_info(pdf_path: Path, page_number: int) -> Tuple[int, int]:
    """
    獲取 PDF 單頁的尺寸資訊
    
    Args:
        pdf_path: PDF 檔案路徑
        page_number: 頁面號碼（從 1 開始）
    
    Returns:
        (寬度，高度) 單位為點（points）
    """
    reader = PdfReader(pdf_path)
    page = reader.pages[page_number - 1]
    media_box = page.mediabox
    return (media_box.width, media_box.height)
```

```python
# pdf_service.py
@staticmethod
def get_page_info(pdf_path: Path) -> List[dict]:
    """
    獲取 PDF 所有頁面的資訊
    
    Args:
        pdf_path: PDF 檔案路徑
    
    Returns:
        頁面資訊列表
    """
    reader = PdfReader(pdf_path)
    pages_info = []
    
    for i, page in enumerate(reader.pages):
        media_box = page.mediabox
        pages_info.append({
            "page_number": i + 1,
            "width": media_box.width,
            "height": media_box.height,
        })
    
    return pages_info
```

### 影響範圍

- 代碼可讀性
- 開發者理解成本
- 嚴重程度：**低** - 不影響功能，但影響代碼質量

## 修復方案

### 方案：重命名函式以明確區分

將 `get_pdf_page_info()` 重命名為更明確的名稱：

```python
# pdf_utils.py - 重命名為 get_single_page_size
def get_single_page_size(pdf_path: Path, page_number: int) -> Tuple[int, int]:
    """
    獲取 PDF 單頁的尺寸資訊
    
    Args:
        pdf_path: PDF 檔案路徑
        page_number: 頁面號碼（從 1 開始）
    
    Returns:
        (寬度，高度) 單位為點（points）
    
    Raises:
        IndexError: 當 page_number 超出範圍時
    """
    reader = PdfReader(pdf_path)
    if page_number < 1 or page_number > len(reader.pages):
        raise IndexError(f"Page number {page_number} out of range")
    
    page = reader.pages[page_number - 1]
    media_box = page.mediabox
    return (media_box.width, media_box.height)
```

### 更新所有呼叫點

搜尋並更新所有呼叫 `get_pdf_page_info()` 的地方：

```python
# 在 pdf_service.py 中
from app.utils.pdf_utils import get_single_page_size  # 更新導入

# 更新呼叫
size = get_single_page_size(pdf_path, page_number)
```

## 測試計劃

### 測試環境
- **開發環境**: `.venv/` 虛擬環境
- **測試環境**: Docker 容器
- **分支**: `refactor/pdf-utils-function-naming`

### 測試案例

#### 測試 1: 單頁尺寸獲取
```
輸入：PDF 檔案，page_number = 1
預期：返回正確的 (寬度，高度)
```

#### 測試 2: 邊界檢查
```
輸入：PDF 檔案（3 頁），page_number = 5
預期：拋出 IndexError
```

#### 測試 3: 所有功能測試
```
預期：所有使用 get_single_page_size() 的功能正常工作
```

### Docker 測試步驟

```bash
# 1. 切換到修復分支
git checkout refactor/pdf-utils-function-naming

# 2. 在虛擬環境中測試
cd backend
../.venv/Scripts/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 7999

# 3. 測試所有相關 API
# 確認沒有因為重命名而出現錯誤

# 4. Docker 完整測試
docker-compose down
docker-compose build
docker-compose up -d
```

## 清理工作

此修復不需要移除日誌，因為沒有添加診斷日誌。

## 相關檔案

- [`backend/app/utils/pdf_utils.py`](backend/app/utils/pdf_utils.py)
- [`backend/app/services/pdf_service.py`](backend/app/services/pdf_service.py)
- 所有呼叫 `get_pdf_page_info()` 的檔案

## Git 分支策略

```bash
# 從 main 建立新分支
git checkout main
git pull origin main
git checkout -b refactor/pdf-utils-function-naming

# 進行重命名和更新
# ...

# 提交變更
git add .
git commit -m "refactor: 重命名 pdf_utils 函式以消除命名混淆

- 將 get_pdf_page_info() 重命名為 get_single_page_size()
- 更新所有呼叫點
- 添加邊界檢查"

# 建立 Pull Request 合併到 main
```

## 注意事項

1. **搜尋替換**: 使用 IDE 的全專案搜尋替換功能
2. **導入語句**: 確保更新所有導入語句
3. **後向相容**: 如果需要，可以創建別名保持後向相容
4. **文檔更新**: 更新相關的文檔和註解
