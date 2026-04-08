# Railway 管理後台系統 (Railway Admin Dashboard)
## 視覺規範 (Visual Specifications)

### 1. 管理介面風格 (Admin Style)
*   **專業儀表板 (Enterprise Dashboard)**：左側固定導航欄，右側內容區塊。
*   **字體**：`Outfit` (數字與標題) + `Noto Sans TC` (中文說明)。
*   **配色**：`#1e293b` (深藍灰背景) 搭配綠色 (#22c55e) 或紅色 (#ef4444) 的狀態標籤。

### 2. 數據組件 (Data Components)
*   **數值卡片 (Metric Cards)**：顯示總交易量、存活連接數與日均處理量。
*   **資料表 (Data Tables)**：支援多欄位排序 (Sorting) 與篩選功能 (Filtering)。
*   **分頁控制**：整合於表格底部的快速分頁跳轉。

---

## 功能組件 (Functional Components)

### 1. 管理員功能 (Admin Features)
*   **身份驗證 (Authentication)**：透過 Railway Server 進行 JWT 或 Session 權限控管。
*   **CRUD 管理**：直接操作 `Railway_Prod_DB` 的完整介面。
*   **即時日誌檢視 (Live Log)**：查看生產環境的即時 API 呼叫日誌。

### 2. 技術架構 (Technical Stack)
*   **環境部署**：**Railway.app**。
*   **API 核心**：Express.js 搭配 MongoDB Driver。
*   **安全性**：啟用生產環境下的 SSL 強制與 Rate Limiting。
