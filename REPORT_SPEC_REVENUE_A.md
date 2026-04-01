# ibon 營收分析報表 (A系統) 技術規範說明

本文件定義了「A系統營收分析報表」的產出標準與設定，未來產出相同類型的月份或專案報表時，請務必遵循此設定規範。

## 1. 基本資訊 (General Info)
- **報表名稱格式**：`A_Qware_Revenue_Report_YYYY年MM月_分析報表.html`
- **資料來源**：MongoDB (`QwareAi` / `Qware_Ticket_Data`)
- **負責人**：陳俊良
- **主要目的**：分析特定月份或時段的購票營收、退票狀況、支付佔比及銷售點分佈。

## 2. 視覺樣式設定 (Visual Styles)
報表採用 **Pink/Rose** 色系，展現現代感且專業的視覺效果。

- **配色方案 (CSS Variables)**:
  - 背景色 (`--bg-color`): `#fce4ec` (淺粉)
  - 卡片背景 (`--card-bg`): `#ffffff`
  - 主要文字 (`--text-primary`): `#880e4f` (深紫紅)
  - 次要文字 (`--text-secondary`): `#ad1457`
  - 強調色 (`--accent-color`): `#d81b60`
- **字體**: `Inter`, sans-serif (Google Fonts)
- **Logo**: 必須包含 ibon Logo (Base64 或 官方連結 `https://ticket.ibon.com.tw/assets/img/logo.png`)。

## 3. 核心統計邏輯 (Core Logic)
在計算各項指標時，必須遵循以下邏輯：

- **正常交易 (Valid Orders)**: 狀態欄位為 `正常` 的資料。
- **退票交易 (Refunded)**: 狀態欄位為 `已退票` 或 `退票`，或 `手續費` > 0 的資料。
- **總營收 (Total Revenue)**: `正常` 狀態下 `售價` 的加總。
- **訂單筆數 (Distinct Orders)**: `訂單編號` 取底線 (`_`) 前的前綴字串進行不重複計數 (Set)。
- **客單價 (AOV)**: `總營收 / 訂單筆數`。
- **退票金額**: `已退票` 或 `退票` 狀態下 `實退金額` 的加總。
- **退票手續費**: 全體資料中 `手續費` 的加總（此項視為系統實質營收）。

## 4. 關鍵組件與圖表 (Components & Charts)

### 4.1 數據卡片 (Stats Grid)
必須包含以下七個關鍵指標：
1. 總營收 (Total Revenue)
2. 客單價 (AOV)
3. 總交易張數 (Total Tickets)
4. 總訂單筆數 (Distinct Orders)
5. 總退票張數 (Total Refunded Tickets)
6. 總退票金額 (Refunded Amt)
7. 退票手續費 (Refund Fees)

### 4.2 趨勢圖表 (Trend Charts)
- **營收趨勢圖**: 使用 `Chart.js` 的 `line` 類型，呈現每日銷售額。
  - 必須加入 `Annotation` 插件，在銷售高峰（如開賣日 > 600萬）標註銷售最高的節目名稱。
- **退票趨勢圖**: 呈現每日退票金額走勢。

### 4.3 分析表格 (Data Tables)
- **銷售排行 Top 5**: 分別依據「金額」與「張數」進行排行，必須嚴格限制僅顯示前 5 名。
- **退票排行 Top 5**: 依據「退票手續費金額」進行排行，必須嚴格限制僅顯示前 5 名。
- **維度分析完整性**: 「付款方式分析」與「銷售點分析」表格中，除營收與佔比外，**必須包含該維度的「訂單筆數」與「票券張數」**。

### 4.4 互動功能 (Interactions)
- **活動深鑽 (Analysis Modal)**: 
  - 點擊表格中的節目名稱彈出。
  - **必須包含該活動專屬的「每日銷售趨勢圖」** (Chart.js)。
  - 票價分佈表必須按 **票價由高至低** 排序。
  - 需顯示退票原因分析及其產生的手續費。

## 5. 實作注意事項 (Implementation Notes & Pitfalls)
處理大量數據 (如 30 萬筆以上) 時，請務必遵循以下開發原則：

- **後端彙總 (Backend Aggregation)**: 禁止將數十萬筆明細直接注入 HTML。必須在產生階段 (Node.js) 完成所有的 `sum`, `count`, `groupBy` 運算，僅將彙總後的 `summaryData` 注入前端。
- **HTML 結構保留**: 在使用正則或字串替換注入數據時，必須確保 `<body>` 內的 UI 結構 (如 `div.container`, `canvas` 標籤) 完整保留，不可只保留 `<script>`。
- **字串轉義 (Escaping)**: 節目名稱若含有單引號 (`'`)，在注入 `onclick="analyzeEvent('...')"` 時會導致 JS 語法錯誤。必須使用 `.replace(/'/g, "\\'")` 進行轉義。
- **資料型態轉換**: MongoDB 的 `Decimal128` 在輸出時為物件 `{ $numberDecimal: "..." }`，必須先轉換為 `Number` 才能進行運算。
- **圖表清理**: 在 Modal 內重新渲染 Chart.js 時，必須先執行 `chart.destroy()` 釋放記憶體，避免圖表重疊。

## 6. 輸出規範 (Output Requirements)
- **檔案編碼**: 儲存檔案時必須添加 BOM (`\ufeff`)。
- **功能按鈕**: 底部需提供「下載 PDF (列印模式)」與「回首頁」按鈕。
- **錯誤處理**: 必須包含 `window.onerror` 攔截。

---
*最後更新日期: 2026/04/01*

