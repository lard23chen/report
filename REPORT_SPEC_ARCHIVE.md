# 報表封存庫 維護規範 (REPORT_SPEC_ARCHIVE.md)

本文件定義歷史報表的封存策略與操作 SOP。

## 1. 為什麼要封存

GitHub Pages 發佈站台**硬上限 1GB**。主站 (`lard23chen/report`) 曾達約 865 MB（86%），導致 Pages 建置間歇卡死（詳見過往經驗）。月報單檔 20–78 MB，若不定期搬出，每月成長約 30–70 MB，一年內必再爆量。

## 2. 封存庫架構

| Repo | Pages 網址 | 收納範圍 |
|------|-----------|---------|
| `lard23chen/report-archive-2025` | https://lard23chen.github.io/report-archive-2025/ | 2025 年（資料年份）已結案報表 |
| `lard23chen/report-archive-2026` | https://lard23chen.github.io/report-archive-2026/ | 2026 年（資料年份）已結案報表 |

- **依報表「資料年份」分庫**，不是封存日期；之後每年新開一個 `report-archive-YYYY`。
- 每庫根目錄有 `index.html`（封存清單頁，手動維護）與 `.nojekyll`（跳過 Jekyll 建置）。
- 非網頁檔案（zip / pptx / xls）放 `files/` 子目錄。
- 本機工作副本在 `D:\2025\AI\report-archive-2025`、`D:\2025\AI\report-archive-2026`。

## 3. 封存條件（全部成立才可搬）

1. 報表對應的月份或活動**已結案**，內容不會再更新。
2. **沒有任何排程或 generator 會再寫入該檔**（查 `.github/workflows/` 與本機排程用的 generate 腳本）。
3. 最近 30 天內沒有新建或功能性修改（避免搬走使用者還在頻繁分享的新報表）。

**永遠不封存**：`report_index.html`、`E_report_index.html`、`HTML_Report_Catalog.html`、每日/每月自動更新的報表、被排程腳本讀取的資料檔（如 `sheet.xlsx`）。

## 4. 封存 SOP

1. 把檔案複製進對應年份的本機封存庫資料夾，更新該庫 `index.html` 清單，commit + push。
2. 等 Pages 部署完成，**先確認新網址可開**（`https://lard23chen.github.io/report-archive-YYYY/檔名`）。
3. 主 repo `git rm` 該檔案。
4. 改寫主站所有引用連結為封存網址，需檢查的頁面：
   - `HTML_Report_Catalog.html`（絕對網址格式）
   - `report_index.html`、`E_report_index.html`（相對路徑格式）
   - `A_BeerFestival_Index.html` 等活動 index 頁（絕對網址格式）
   - 用 `grep` 全站搜檔名確認無漏網
5. 主 repo commit + push，確認主站 Pages 重建成功。

> ⚠️ 主 repo 刪檔後 git 歷史仍保留舊檔（`.git` 不會變小）。Pages 只看工作樹內容，所以站台容量有效下降；若要縮 `.git` 需另做 `git filter-repo` 歷史重寫（破壞性操作，需另行決定）。

## 5. 首次封存紀錄（2026/07/08）

共搬出 19 檔、約 656 MB，主站由約 865 MB 降至約 210 MB：

- **→ report-archive-2025**：A 系統 2025年10/11/12月月報、E 系統 2025年10/11月月報 + 12月 zip、高雄啤酒節 2025、李聖傑 2025 台北、高雄櫻花季 2025
- **→ report-archive-2026**：E 系統 2026年01–05月月報、高雄櫻花季 2026、金唱片 2026、韋禮安 2026、`用 Claude Code 打造系統性程式碼審查.zip`、`2026年啤酒節監控說明_20260512.pptx`
- **保留主站**：`A_BaseballAllStar_2026.html`（新建兩週內）、`E_Qware_Revenue_Report_2026年06月_分析報表.html`（7/6 才更新）、`sheet.xlsx`（費用報表排程讀取）、`中華職棒37年…會員購買明細.xls`（分析頁下載連結）

---
*Last Updated: 2026/07/08*
