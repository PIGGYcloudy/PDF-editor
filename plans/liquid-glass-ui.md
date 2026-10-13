# Liquid Glass 網頁介面

此版本把 Apple 的設計原則轉成 React / Material UI 的網頁體驗；玻璃材質以 CSS 半透明背景、背景模糊、高光邊框與柔和陰影呈現。

## 設計依據

- [Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass) 與 [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)：導覽、狀態與文件工具使用玻璃材質；文件與設定內容使用清楚的實色表面，避免層層透明。
- [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)：另存下載為主要操作；按鈕與頁面圖示至少 44px，包含按下與鍵盤焦點狀態。
- [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)：不阻擋首次使用。空白工作區直接提供上傳入口與簡短的功能說明；完整操作與鍵盤快速鍵可隨時從「使用說明」開啟。
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)：提供跳到工作區的連結、具名控制與展開面板、可由鍵盤關閉的說明對話框、成功狀態朗讀，以及降低透明度設定。尊重減少動態、提高對比、減少透明度與強制色彩的系統偏好。

## 使用體驗

- **不分模式**（[Modality](https://developer.apple.com/design/human-interface-guidelines/modality)）：頁面編輯會先暫存，但不會因此停用其他工具。打開拆分、壓縮、浮水印、轉圖片或另存時，會自動先套用暫存的變更；選取的頁面跟著移到新版本的編號。
- **回饋在視線內**（[Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)）：處理中的提示浮在畫面上方，成功訊息在底部短暫出現，錯誤訊息需要手動關閉，都不推動版面。切換分頁或文件時清除舊訊息。未套用的變更只在頁面區的固定列提示一次，文件列表以圓點標示。
- **復原與重做**（[Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo)）：按鈕標出動作名稱，例如「復原旋轉」「重做壓縮」，並支援 `Ctrl+Y`／`⇧⌘Z`。
- **版面**（[Layout](https://developer.apple.com/design/human-interface-guidelines/layout)）：頁面依可用寬度排欄，手機兩欄、320px 一欄。手機上分頁獨立一列，工具列只留圖示並可橫向捲動，選取工具改為圖示按鈕，讓頁面更早出現在畫面中。
- **停用時說明原因**：合併按鈕無法使用時，旁邊直接寫出還差什麼。上傳的文件預設勾選為合併對象。
- **深色模式**（[Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)）：跟隨系統外觀；頁面縮圖維持白底，代表紙張。
- **文字**（[Writing](https://developer.apple.com/design/human-interface-guidelines/writing)）：介面文字只描述功能與狀態，不使用標語。動作一律稱為「另存」。

降低透明度偏好儲存在 `localStorage`。瀏覽器不允許儲存時，仍可調整目前頁面的顯示。不支援背景模糊的瀏覽器會使用實色表面。

## 部署與驗證

更新既有獨立測試服務（8082），沿用該服務的文件 volumes：

```bash
PDF_FRONTEND_PORT=8082 PDF_BACKEND_PORT=8001 docker compose -p pdf-editor-ux up -d --build frontend
```

前端執行 lint、單元測試、production build 與 Playwright 回歸測試。`frontend/e2e/liquid-glass.spec.ts` 覆蓋選用式說明、鍵盤上傳、焦點恢復、320/390/768px 版面、操作目標大小、系統顯示偏好，以及無法使用偏好儲存時的操作。

2026-10-13 可用性修訂後的驗證結果：前端 lint、型別檢查與 production build 通過，69 項單元測試與 18 項瀏覽器測試（對本機開發伺服器與後端）通過。此次未變更後端。
