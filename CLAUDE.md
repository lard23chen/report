# 專案開發規範 (CLAUDE.md)

## 開發前必做

1. **查 HTML_Report_Catalog.html 總目錄**，找到對應程式的規範文檔連結
2. **讀對應的 `REPORT_SPEC_XXX.md`**，了解既有規範後再動工

## 開發後必做

1. **補寫規範文檔**：有新增功能或行為變更，主動寫進對應的 `REPORT_SPEC_XXX.md`，不等用戶要求
2. **git commit & push**：每次任務完成後主動執行，不需等用戶要求
   - commit message 用英文，描述修改內容與原因
   - 格式：`git add <相關檔案> && git commit -m "..." && git push origin main`

## 報表開發注意事項

- **HTML 與 generator 腳本必須同步**：修改 HTML 中的 JS 邏輯，必須同步修改對應的 `generate_xxx.js`，否則下次自動更新會覆蓋手動修改
- 新增報表時，同步在 `HTML_Report_Catalog.html` 加入對應列，並建立 `REPORT_SPEC_XXX.md`

## 專案結構

| 檔案 | 說明 |
|------|------|
| `HTML_Report_Catalog.html` | 報表總目錄，含所有報表連結與規範文檔 |
| `REPORT_SPEC_XXX.md` | 各報表的技術規範文檔 |
| `generate_xxx.js` | 報表產出腳本（與 HTML 必須同步） |
| `server.js` | Express 本地 server（port 3000），含 `/api/prompt-log` 等 API |
| `public/` | server.js 靜態檔案目錄 |

## 容量與封存

- GitHub Pages 站台上限 1GB，主站需維持在此之下；已結案的歷史報表依 `REPORT_SPEC_ARCHIVE.md` 的 SOP 搬到 `report-archive-YYYY` 封存庫（本機副本在 `D:\2025\AI\report-archive-*`），並改寫主站連結。
