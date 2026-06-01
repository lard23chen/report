> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。

# 股票投資組合管理系統 (Stock Portfolio Management System)
## 視覺規範 (Visual Specifications)

### 1. 核心配色與風格 (Theme & Style)
*   **視覺風格**：深色模式 (Dark Mode)，採用 **Slate & Slate-Blue** 作為背景，搭配鮮明的狀態色彩。
*   **字體規範**：數字使用等寬字體感 (Sans-serif)，代號使用 `monospace` 以增強辨識度。
*   **配色方案 (CSS Variables)**：
    *   `--accent`: `#38bdf8` (Sky Blue) - 用於連結、人員標籤及主要強調。
    *   `--buy`: `#f87171` (Red) - **買入**標籤與支出金額（符合台股習慣）。
    *   `--sell`: `#22c55e` (Green) - **賣出**標籤與收入金額。
    *   `--div`: `#c084fc` (Purple) - 股利 (Dividend) 標籤。

### 2. 佈局組件 (Layout Components)
*   **人員切換頁籤 (Person Tabs)**：置於頂部，提供「全部、Alex、Mark」的快速切換。
*   **核心指標 (Stats Grid)**：六欄式卡片，顯示總筆數、淨現金流、估算市值及含持股總損益。
*   **持股摘要 (Summary Table)**：依「代號 × 人員」加總，包含買入均價、現持股數及損益估算。
*   **交易明細 (Transaction Table)**：包含日期、類型、股數、成交價及自動計算之交易成本。

---

## 功能組件 (Functional Components)

### 1. 數據連動與損益運算 (Dynamic Calculations)
*   **即時股價獲取**：整合台證所 (TWSE) API，可一鍵更新當前持股的最新市場價格。
*   **自動化交易成本**：
    *   **買入**：`交易成本 = 支出 - 成交金額`。
    *   **賣出**：`交易成本 = 成交金額 - 收入`。
*   **損益估算**：結合 `LocalStorage` 存儲的即時股價與 `MongoDB` 的持有成本，進行即時損益 (P/L) 計算。

### 2. 進階篩選與統計 (Advanced Filtering)
*   **多重過濾器**：支援人員、年份、股票代號、名稱及交易類型（買/賣/股利）的交叉篩選。
*   **篩選小計 (Footer Totals)**：表格底部自動加總當前篩選結果的總支出與總收入。

### 3. 管理員編輯模式 (CRUD Operations)
*   **安全驗證**：進入編輯模式需輸入 10 位數管理密碼。
*   **完整維護**：支援交易記錄的新增、修改與刪除，操作後自動與 MongoDB 雲端同步。

---

## 技術架構與部署 (Technical Stack & Deployment)

### 1. 部署環境 (Deployment)
*   **前端展示**：GitHub Pages (Static Hosting)。
*   **後端 API**：Vercel Serverless Functions（`stock_api.js`）。
*   **即時數據**：Yahoo Finance chart API（`/v8/finance/chart/SYMBOL`）。
    *   ⚠️ 舊版使用 `mis.twse.com.tw`，但從 Vercel 美國伺服器呼叫時 `z`（即時成交價）永遠為 `-`，只能取到昨收（`y`），已改用 Yahoo Finance。
    *   上市股票（1x, 2x, 5x, 6x, 8x, 9x, 00xx...）→ `{CODE}.TW`；上櫃（3x, 4x）→ `{CODE}.TWO`；若主要後綴 404，自動 fallback 至另一後綴（處理如 `00679B` 等上櫃 ETF）。

### 2. 資料庫與持久化 (Databases)
*   **主要存儲**：MongoDB Atlas (`AlexLIFE.Stock_Portfolio`)。
*   **股價快取**：LocalStorage (用於暫存最新的股價數據，減少 API 呼叫次數)。

---

## 操作流程 (Operating Procedures)

### 1. 日常檢視
1.  進入頁面後，點擊「🔄 取得今日股價」以獲取最新市場動態。
2.  點擊人員頁籤（如 Alex）查看個人資產配置。
3.  使用搜尋框或下拉選單過濾特定股票（如 2330）。

### 2. 帳務維護 (管理員)
1.  點擊右下角「✏️ 編輯」並輸入密碼。
2.  點擊「＋ 新增」錄入新成交的交易單（系統會自動計算支出/收入預設值）。
3.  若資料有誤，點擊行尾「編輯」進行修正並儲存。
