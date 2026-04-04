# PDF 編輯器 - 系統架構圖

## 整體系統架構

```mermaid
graph TB
    subgraph 前端層
        A[React 應用程式] --> B[UI 元件]
        B --> C[Custom Hooks]
        C --> D[API 服務]
    end
    
    subgraph 網路層
        D -->|HTTP Requests| E[CORS Middleware]
        E --> F[FastAPI 路由]
    end
    
    subgraph 後端層
        F --> G[業務邏輯服務]
        G --> H[PDF 處理工具]
    end
    
    subgraph 資料層
        H --> I[uploads 目錄]
        H --> J[outputs 目錄]
    end
```

## 前端元件架構

```mermaid
graph TB
    subgraph App
        A[App.tsx] --> B[FileUpload]
        A --> C[PDFManager]
    end
    
    subgraph PDFManager
        C --> D[PDFPreview]
        C --> E[PageReorder]
        C --> F[Toolbar]
    end
    
    subgraph Toolbar
        F --> G[SizeSelector]
        F --> H[Compressor]
        F --> I[Watermark]
        F --> J[Converter]
    end
    
    subgraph PDFPreview
        D --> K[PageThumbnail]
        K --> K2[PageThumbnail]
        K2 --> K3[PageThumbnail]
    end
```

## API 路由架構

```mermaid
graph LR
    subgraph 路由層
        A[main.py] --> B[pdf.py]
        A --> C[convert.py]
    end
    
    subgraph PDF 路由
        B --> D[POST /upload]
        B --> E[POST /delete-pages]
        B --> F[POST /reorder-pages]
        B --> G[POST /resize]
        B --> H[POST /compress]
        B --> I[POST /watermark/text]
        B --> J[POST /watermark/image]
    end
    
    subgraph 轉換路由
        C --> K[POST /to-image]
        C --> L[GET /download]
    end
```

## 服務層架構

```mermaid
graph TB
    subgraph 服務層
        A[pdf_service.py] --> A1[刪除頁面]
        A --> A2[重新排序]
        A --> A3[調整尺寸]
        
        B[compress_service.py] --> B1[圖片壓縮]
        B --> B2[資源優化]
        
        C[watermark_service.py] --> C1[文字浮水印]
        C --> C2[圖片浮水印]
        
        D[convert_service.py] --> D1[PDF 轉 JPG]
        D --> D2[PDF 轉 PNG]
    end
    
    subgraph 工具層
        E[pdf_utils.py] --> E1[讀取 PDF]
        E --> E2[產生縮圖]
        E --> E3[尺寸計算]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
```

## 資料流程 - 檔案上傳與處理

```mermaid
sequenceDiagram
    participant U as 使用者
    participant FE as 前端
    participant BE as 後端
    participant FS as 檔案系統
    
    U->>FE: 拖曳 PDF 檔案
    FE->>FE: 驗證檔案類型
    FE->>BE: POST /api/upload
    BE->>FS: 儲存至 uploads/
    BE-->>FE: 返回檔案 ID
    FE->>BE: GET /api/pdf/{id}/pages
    BE->>FS: 讀取 PDF
    BE-->>FE: 返回頁面資訊
    FE->>FE: 顯示頁面預覽
```

## 資料流程 - 頁面重新排序

```mermaid
sequenceDiagram
    participant U as 使用者
    participant FE as 前端
    participant BE as 後端
    participant FS as 檔案系統
    
    U->>FE: 拖曳頁面排序
    FE->>FE: 更新本地狀態
    FE->>BE: POST /api/pdf/reorder-pages
    BE->>FS: 讀取原始 PDF
    BE->>BE: 重新排列頁面
    BE->>FS: 儲存至 outputs/
    BE-->>FE: 返回新檔案路徑
    FE->>BE: GET /api/pdf/{newId}/pages
    BE-->>FE: 返回新頁面資訊
    FE->>FE: 更新預覽
```

## 資料流程 - 浮水印添加

```mermaid
sequenceDiagram
    participant U as 使用者
    participant FE as 前端
    participant BE as 後端
    participant FS as 檔案系統
    
    U->>FE: 設定浮水印參數
    U->>FE: 點擊添加浮水印
    FE->>BE: POST /api/pdf/watermark/text
    BE->>FS: 讀取 PDF
    BE->>BE: 處理每一頁
    BE->>BE: 添加浮水印圖層
    BE->>FS: 儲存至 outputs/
    BE-->>FE: 返回新檔案路徑
    FE->>FE: 顯示下載按鈕
```

## 資料流程 - PDF 壓縮

```mermaid
sequenceDiagram
    participant U as 使用者
    participant FE as 前端
    participant BE as 後端
    participant FS as 檔案系統
    
    U->>FE: 選擇壓縮品質
    U->>FE: 點擊壓縮
    FE->>BE: POST /api/pdf/compress
    BE->>FS: 讀取 PDF
    BE->>BE: 分析 PDF 內容
    BE->>BE: 降低圖片解析度
    BE->>BE: 移除不必要資源
    BE->>FS: 儲存至 outputs/
    BE-->>FE: 返回壓縮後檔案
    FE->>FE: 顯示壓縮比
```

## 資料流程 - PDF 轉圖片

```mermaid
sequenceDiagram
    participant U as 使用者
    participant FE as 前端
    participant BE as 後端
    participant FS as 檔案系統
    
    U->>FE: 選擇輸出格式 JPG/PNG
    U->>FE: 選擇解析度
    U->>FE: 點擊轉換
    FE->>BE: POST /api/convert/to-image
    BE->>FS: 讀取 PDF
    BE->>BE: 逐頁轉換為圖片
    BE->>FS: 儲存圖片至 outputs/
    BE->>BE: 打包為 ZIP
    BE-->>FE: 返回 ZIP 下載連結
    FE->>FE: 觸發下載
```

## 狀態管理架構

```mermaid
graph TB
    subgraph App State
        A[pdfFiles Array] --> B[currentPdfId]
        B --> C[pages Array]
        C --> D[operations Stack]
    end
    
    subgraph UI State
        E[uploading Boolean]
        F[processing Boolean]
        G[error String]
        H[selectedPages Array]
    end
    
    subgraph Settings State
        I[sizeSettings]
        J[compressSettings]
        K[watermarkSettings]
        L[convertSettings]
    end
    
    A --> E
    C --> F
    D --> G
```

## 常用紙張尺寸參考

```mermaid
graph LR
    subgraph A 系列
        A3[A3: 297x420mm] --> A4[A4: 210x297mm]
        A4 --> A5[A5: 148x210mm]
    end
    
    subgraph B 系列
        B2[B2: 500x707mm] --> B3[B3: 353x500mm]
        B3 --> B4[B4: 250x353mm]
        B4 --> B5[B5: 176x250mm]
    end
    
    subgraph 美式
        Letter[Letter: 216x279mm]
        Legal[Legal: 216x356mm]
    end
```

## 安全性架構

```mermaid
graph TB
    subgraph 輸入驗證
        A[檔案類型檢查] --> B[檔案大小限制]
        B --> C[參數驗證]
    end
    
    subgraph 處理安全
        D[隔離處理環境] --> E[資源限制]
        E --> F[超時控制]
    end
    
    subgraph 輸出安全
        G[隨機檔案名] --> H[定期清理]
        H --> I[存取控制]
    end
    
    A --> D
    D --> G
```
