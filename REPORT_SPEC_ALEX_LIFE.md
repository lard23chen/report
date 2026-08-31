# ALEX 生活管理獨立站台 (alexlife) 技術規範文檔

本文件定義獨立公開 GitHub Pages Repo (`lard23chen/alexlife`) 之架構、報表清單與維護規範。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| **GitHub Repo** | `https://github.com/lard23chen/alexlife` |
| **Pages 入口** | `https://lard23chen.github.io/alexlife/ALEX_Life_Catalog.html` |
| **用途** | ALEX 個人生活、投資、保險、旅遊與個人知識庫報表之獨立託管站台 |
| **檔案體積** | ~7 MB（精簡無大檔，解決原 `report` 倉庫 >100MB 導致 Pages Build 超時與 404 問題） |
| **存取控管** | 公開 GitHub Pages + 網頁客戶端密碼鎖（`sessionStorage` 認證） |

---

## 2. 納入報表與頁面清單 (15+ 筆)

| 編號 | 類別 | 檔名 (相對路徑) | 說明 | 資料來源 / API | 專屬規範文檔 |
|------|------|----------------|------|---------------|-------------|
| 26 | 投資 | `Stock_Portfolio.html` | 台股/美股個股交易記錄與持股損益估算 (CRUD) | Vercel API / MongoDB (`AlexLIFE.Stock_Portfolio`) | `REPORT_SPEC_STOCK_PORTFOLIO.md` |
| 27 | 旅遊 | `Travel_Tickets_2026.html` | 2026 旅遊票券統計與行程管理 (CRUD) | MongoDB (`TravelTicketsDB`) | `REPORT_SPEC_TRAVEL_2026.md` |
| 28 | 營運 | `Team_Resources.html` | 團隊資源索引與常用連結管理 (CRUD) | Google Apps Script API | `REPORT_SPEC_TEAM_RESOURCES.md` |
| 29 | 保險 | `A_Insurance_Report.html` | 保單資產管理系統 (CRUD) | Express API / MongoDB (`AlexLIFE.Insurance`) | `REPORT_SPEC_INSURANCE.md` |
| 30 | 旅遊 | *(外部)* `Streamlit App` | 旅遊即時記帳助手 | Streamlit Cloud + MongoDB | `REPORT_SPEC_TRAVEL_EXPENSE_APP.md` |
| 36 | IG | `IG_Post_Planner.html` | 個人 IG 貼文計畫與月曆 | LocalStorage | `REPORT_SPEC_IG_PLANNER.md` |
| 49 | IG | `IG_Anon_Planner.html` | 匠名 IG 內容計畫 | LocalStorage | `REPORT_SPEC_IG_ANON_PLANNER.md` |
| 50 | IG | `IG_Anon_Setup_Guide.html` | 匠名 IG 自動發布前置指南 | LocalStorage | `REPORT_SPEC_IG_ANON_PLANNER.md` |
| 37 | 投資 | `AI_Invest_Report.html` | 美股定期投資分析報告 | MongoDB (`AlexLIFE.USA_Stock`) | `REPORT_SPEC_AI_INVEST.md` |
| 38 | 投資 | `Structured_Products.html` | 結構型商品追蹤看板 (CRUD) | Vercel API / MongoDB (`AlexLIFE.Structured_Products`) | `REPORT_SPEC_STRUCTURED_PRODUCTS.md` |
| 39 | 投資 | `FCN_Analysis.html` | FCN 固定配息票券獨立分析 | Vercel API | `REPORT_SPEC_STRUCTURED_PRODUCTS.md` |
| 48 | 資產 | *(外部)* `Claude Artifact` | 🔒 個人資產配置分析 (私有) | Claude.ai Artifact | `REPORT_SPEC_ALEX_ASSET.md` |
| 51 | 筆記 | `AIclass.html` | AI 講義：數據自動化與網頁部署 | 靜態 HTML + `aiclass_assets/` | `REPORT_SPEC_AI_LECTURE.md` |
| 51-2 | 筆記 | `AI講義_Alex_20260724.html` | AI 講義：簡報圖文版 | 靜態 HTML + `ai_lecture_20260724_assets/` | `REPORT_SPEC_AI_LECTURE.md` |
| 52-54 | 客服 | *(外部)* `Railway Apps` | 票券客服 Demo 與 Admin | Railway App | `REPORT_SPEC_RAILWAY_DEMO.md` |
| 55 | 住宿 | `hotel.html` | 國旅住宿記錄分析 | Google Sheets 快照 | `REPORT_SPEC_HOTEL.md` |
| 56 | 組織 | `AlexAnalyze_OrgChart.html` | 公司組織架構圖 | 純 HTML (Google OrgChart) | - |
| 輔助 | 投資 | `FCN_RCN_看板_系統分析.html` | 結構型商品系統分析文件 | 靜態 HTML | - |
| 輔助 | 索引 | `Category_Index.html` | 舊版分類索引頁 | 靜態 HTML | - |

---

## 3. 超連結與導覽架構規範

1. **內部連結一律相對路徑化**：
   - 目錄與報表間、報表與報表間（如 `Structured_Products.html` ↔ `FCN_RCN_看板_系統分析.html`）之超連結，一律採用相對檔名 `XXX.html`。
   - 禁止在 HTML 中寫死 `https://lard23chen.github.io/report/XXX.html` 或 `https://lard23chen.github.io/alexlife/XXX.html`，確保站台遷移時無需二次修改程式。

2. **跨站台主目錄指引**：
   - `ALEX_Life_Catalog.html` 頂部「← 回主目錄」按鈕保持指向商用主報表目錄：`https://lard23chen.github.io/report/HTML_Report_Catalog.html`。

3. **靜態資源相對路徑**：
   - 圖片資源目錄（`aiclass_assets/`、`ai_lecture_20260724_assets/`）採用相對路徑引用。
   - 根目錄包含 `.nojekyll` 檔案，防止 GitHub Pages 忽略特定檔名。

---

## 4. 雲端 API 與資料庫連動

- **無縫換站**：所有動態 CRUD 報表（股票、結構型商品、保險、團隊資源）均呼叫遠端 Vercel Serverless API (`https://report-theta-nine.vercel.app/api/...`) 或 AppScript API，不依賴 HTML 託管之網域。
- **資料庫**：MongoDB Atlas 數據庫 `AlexLIFE` 及 `TravelTicketsDB` 等集中管理，資料寫入與讀取不受前端 GitHub Pages 網址改變影響。

---

## 5. 變更紀錄

- **2026/08/31**：創立本規範文檔。完成 `alexlife` 獨立 Repo 之建置、相對路徑改版與首刷 GitHub Pages 部署。

---
*Last Updated: 2026/08/31*
