# Security Policy

## Supported version

目前只維護 `main` 分支的最新版本。尚未發布正式穩定版之前，不承諾舊 commit 的安全修補。

## Reporting a vulnerability

請優先使用 GitHub repository 的 **Private vulnerability reporting** 私下回報安全問題，並附上：

- 受影響的功能與版本或 commit
- 可重現步驟或最小測試檔
- 可能影響
- 建議修正方式（若有）

請不要把漏洞細節、惡意 PDF 或個人文件放進公開 Issue。如果私人回報功能尚未啟用，可先建立不含敏感細節的 Issue，請維護者提供私人聯絡方式。

本專案會盡力在 7 天內確認收到回報；修正時程會依嚴重程度與影響範圍決定。

## Deployment scope

預設設定供本機或受信任網路使用。若要部署到公開網路，請自行加入身分驗證、速率限制、檔案生命週期管理、惡意檔案隔離與 HTTPS，並限制後端服務的直接存取。
