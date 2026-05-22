> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。

# 視覺規範與功能組件：分析報表中心 (E系統) 
## `E_report_index.html` Specification Document

### 1. 視覺設計與風格 (Visual Identity)
*   **配色方案 (Color Palette)**:
    *   **背景 (Background)**: `#0f172a` (深藍色夜空背景)。
    *   **卡片背景 (Card BG)**: `#1e293b` (深色卡片區塊)。
    *   **主色 (Primary Accent)**: `#ef4444` (紅色)，用於區分 E系統 (A系統為藍色)。
    *   **文字主色 (Text Primary)**: `#f8fafc` (極淺灰色)。
    *   **文字次色 (Text Secondary)**: `#94a3b8` (灰藍色)。
*   **字體設計 (Typography)**:
    *   使用 Google Fonts: `Outfit` 作為主要的現代風格字體。
    *   使用 `Inter` 作為數據與表格輔助字體。
*   **動態特效 (Effects)**:
    *   背景放射狀漸層光暈 (Radial Gradient Glow)。
    *   卡片 Hover 效果：向上位移並顯示紅色頂部飾條。
    *   分頁切換動畫：FadeIn 漸入效果。

### 2. 核心功能組件 (Core Components)

#### A. 月份交易統計表 (Monthly Statistics Table)
*   **位置**: 頁面頂部統計區塊。
*   **顯示欄位**: 月份、購票筆數、購票張數、購票金額、退票筆數、退票張數、退票手續費。
*   **MoM 成長分析**: 自動計算與前一個月的百分比差異，並以箭頭與色塊顯示 (▲ 綠色 / ▼ 紅色)。
*   **最近月份趨勢分析區塊**: 統計表下方自動產生最新月與上月的文字摘要（交易量、收入、退票三行），由 `update_e_index_stats.js` 動態生成，**不得手動寫死在 HTML**，否則下次更新會被覆蓋。
    *   **格式**: 三行文字，依序為 📊 交易量（購票筆數/張數絕對差 + 百分比）、💰 收入（購票金額差額 + 達到金額）、🔻 退票（筆數/張數/手續費百分比）。
    *   **樣式**: 深灰背景 `#252525`、左側 `3px solid #66BB6A` 綠色飾條、`max-width:640px`，`h4` 使用 `var(--accent-color)` 紅色。
*   **自動化更新**: 透過 `update_e_index_stats.js` 定期從 MongoDB 聚合數據並注入 HTML 標記 `<!-- STATS_START -->` 之間。

#### B. 營收趨勢圖 (Revenue Trend Chart)
*   **類型**: Chart.js Line Chart。
*   **數據點**: 近半年月份營收走勢。
*   **視覺**: 紅色線條帶有淡紅色區域填充 (Gradient Fill)，並開啟數據標籤顯示簡化金額 (如 $20.9M)。

#### C. 分頁導覽系統 (Tabbed Navigation)
*   **本月/上月報表 (Tab 1)**: 僅顯示最新兩個月份的分析報告，提供快速存取。
*   **報表比較分析 (Tab 2)**: 預留給跨月份對比報告的區塊。
*   **歷史報表分析 (Tab 3)**: 收納三個月前（含）的所有歷史分析報告，避免首頁過於擁擠。
*   **各節目報表分析 (Tab 4)**: 預留給特定大型活動或專案的專屬報表。

### 3. 資料來源與更新機制 (Data Engine)
*   **資料庫**: MongoDB (Cluster0)。
*   **集合 (Collection)**: `QwareAi / Qware_Ticket_Data_Esys` (E系統專屬資料表)。
*   **腳本工具**:
    *   `generate_e_report_mar_2026.js`: 負責抓取單月數據並生成單一月份的 HTML 報表。
    *   `update_e_index_stats.js`: 負責聚合所有月份數據，重新計算統計表與趨勢圖，並更新 `E_report_index.html`。
*   **排程策略**: 每月一號 08:30 自動執行全量更新。

### 4. 輸出與存取 (Deployment)
*   **靜態網站**: 部署於 GitHub Pages (`https://lard23chen.github.io/report/E_report_index.html`)。
*   **PDF 匯出**: 報表內建 PDF 匯出組件 (html2pdf)，方便團隊進行離線存檔與傳閱。

### ⚠️ 維護注意：HTML 與 Generator 必須同步

`E_report_index.html` 由 `update_e_index_stats.js` 產出（替換 `<!-- STATS_START -->` 至 `<!-- Tabs Navigation -->` 之間的內容）。

**若只修改 HTML 而未同步修改 generator，下次執行更新腳本時 HTML 會被完整覆蓋。**

受影響的功能（歷史上曾被覆蓋過）：
- 最近月份趨勢分析區塊 — 2026/05/08 被更新覆蓋，已修復並同步至 generator（以 `MOM_ANALYSIS_PLACEHOLDER` 動態替換）
- 最近月份趨勢分析區塊 — 2026/05/21 再次遺失：根本原因是 generator 對 `template` 做 `MOM_ANALYSIS_PLACEHOLDER` 替換後，緊接著的 stats block regex 替換又用含有原始 placeholder 的 `statsHtml` 覆蓋整個區塊。**正確做法：在寫入 stats block 前，先對 `statsHtml` 做 `.replace('MOM_ANALYSIS_PLACEHOLDER', momHtml)` 得到 `statsHtmlFinal`，再嵌入 regex 替換的模板字串中。**

---
*Last Updated: 2026/05/21*
