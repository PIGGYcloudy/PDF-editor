# Contributing

感謝你願意協助改善 PDF Editor。Bug 回報、功能建議、文件修正與程式碼貢獻都很歡迎。

## 開始之前

- 請先搜尋現有 Issue，避免重複回報。
- 功能改動較大時，建議先開 Issue 說明使用情境與預期行為。
- 安全問題請依照 [SECURITY.md](SECURITY.md) 私下回報，不要在公開 Issue 揭露細節。

## 本機開發

後端需要 Python 3.11+ 與 Poppler：

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
pytest -q
```

前端需要 Node.js 20.19+ 或 22.12+：

```bash
cd frontend
npm ci
npm run build
```

也可以在專案根目錄執行：

```bash
docker compose up --build
```

## Pull Request

1. 從 `main` 建立功能分支。
2. 保持變更聚焦，並為行為改動新增或更新測試。
3. 確認後端測試與前端 production build 都通過。
4. 在 PR 說明問題、解法、驗證方式，以及任何相容性或隱私影響。

提交 PR 即表示你同意依本專案的 [MIT License](LICENSE) 授權你的貢獻。
