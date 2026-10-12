# Liquid Glass 網頁介面

此版本把 Apple 的設計原則轉成 React / Material UI 的網頁體驗；玻璃材質以 CSS 半透明背景、背景模糊、高光邊框與柔和陰影呈現。

## 設計依據

- [Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass) 與 [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)：導覽、狀態與文件工具使用玻璃材質；文件與設定內容使用清楚的實色表面，避免層層透明。
- [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)：另存下載為主要操作；按鈕與頁面圖示至少 44px，包含按下與鍵盤焦點狀態。
- [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)：不阻擋首次使用。空白工作區直接提供上傳入口、三步說明；完整操作與鍵盤提示可隨時從「使用說明」開啟。
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)：提供跳到工作區的連結、具名控制與展開面板、可由鍵盤關閉的說明對話框、成功狀態朗讀，以及降低透明度設定。尊重減少動態、提高對比、減少透明度與強制色彩的系統偏好。

## 使用體驗

頁面旋轉與刪除按鈕直接可見，並放在縮圖上方，避免遮住文件內容；手機版採單欄預覽以容納觸控操作。未套用變更的提示與套用按鈕會保留在捲動視線內；另存按鈕會說明是否需要先套用。檔案暫存與下載的差異在上傳前及工作區內都有提示。

降低透明度偏好儲存在 `localStorage`。瀏覽器不允許儲存時，仍可調整目前頁面的顯示。不支援背景模糊的瀏覽器會使用實色表面。

## 部署與驗證

更新既有獨立測試服務（8082），沿用該服務的文件 volumes：

```bash
PDF_FRONTEND_PORT=8082 PDF_BACKEND_PORT=8001 docker compose -p pdf-editor-ux up -d --build frontend
```

前端執行 lint、單元測試、production build 與 Playwright 回歸測試。`frontend/e2e/liquid-glass.spec.ts` 覆蓋選用式說明、鍵盤上傳、焦點恢復、320/390/768px 版面、操作目標大小、系統顯示偏好，以及無法使用偏好儲存時的操作。

2026-10-13 驗證結果：前後端 lint 通過、production build 通過、前端 65 項與後端 65 項測試通過、部署版本的 18 項瀏覽器測試通過。8082 的建置資產與部署產物一致，區網頁面回應 HTTP 200，後端健康檢查正常。
