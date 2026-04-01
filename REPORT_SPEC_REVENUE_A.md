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
- **付款方式分析**: 顯示各支付方式（信用卡、現金等）的筆數、張數、金額及佔比。
- **銷售點分析**: 顯示各銷售點（網購、門市等）的佔比。

### 4.4 互動功能 (Interactions)
- **活動深鑽 (Analysis Modal)**: 點擊表格中的節目名稱，彈出 Modal 顯示該活動的票價分佈、銷售點分佈及退票原因分析。

## 5. 輸出規範 (Output Requirements)
- **檔案編碼**: 儲存檔案時必須添加 BOM (`\ufeff`)，以確保 Excel 或瀏覽器讀取中文字元時不會產生亂碼。
- **功能按鈕**: 報表底部固定位置需提供「下載 PDF (列印模式)」與「回首頁」按鈕。
- **錯誤處理**: 必須包含 `window.onerror` 攔截 JavaScript 錯誤並彈出警告，方便除錯。

---
*最後更新日期: 2026/04/01*
