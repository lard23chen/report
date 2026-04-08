# Railway 專案展示系統 (Railway Project Demo)
## 視覺規範 (Visual Specifications)

### 1. 核心風格 (Theme)
*   **設計語彙**：採用 **Glassmorphism (玻璃擬態)** 效果，強調現代感與透明度。
*   **主色調**：`#42f5b6` (Railway Mint Green) 與深色底色 (`#0a0a0a`) 的對比。
*   **排版**：流動式佈局 (Fluid Layout)，支援各種螢幕尺寸。

### 2. UI 組件 (UI Components)
*   **Hero Section**：動態漸層背景，展示專案核心價值。
*   **功能展示卡片**：帶有懸浮放大效果 (Scale on Hover) 與柔和陰影。
*   **即時狀態燈**：顯示 Railway Server 的存活狀態。

---

## 功能組件 (Functional Components)

### 1. 互動演示 (Live Interaction)
*   **動態元件**：前端使用原生 JavaScript 或 React 實作即時 UI 饋送。
*   **API 串接**：展示從 Railway 後端獲取的模擬數據。

### 2. 技術架構 (Technical Stack)
*   **託管平台**：**Railway.app** (Production Environment)。
*   **後端系統**：Node.js / Express。
*   **資料來源**：`Railway_Prod_DB`。

---

## 操作流程 (Operating Procedures)

### 1. 存取與啟動 (Access & Initialization)
*   **進入頁面**：點擊專屬 URL 進入展示頁面。
*   **自動健康檢查**：系統啟動時會自動呼叫後端 `/health` API，若狀態燈變為**綠色**表示生產環境運行正常。

### 2. 功能操作 (Interaction)
*   **即時數據檢視**：頁面載入後，系統會從 Railway 數據庫抓取最新的 Demo 資料並動態渲染至卡片中。
*   **組件切換**：點擊分頁或按鈕可切換不同的 UI 展示模組，所有切換過程皆有平滑過場動畫。

### 3. 反饋回報 (Feedback)
*   若遇到 API 逾時，頁面會自動顯示「連線重試中」提示，使用者無需手動重新整理。
