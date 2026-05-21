# Azure 雲端費用分析報表 技術規範說明

本文件定義「Azure 雲端費用分析報表」的產出標準與設定，未來更新資料或新增欄位時，請遵循此規範。

## 1. 基本資訊 (General Info)

- **報表名稱**：`Azure_Cost_Analysis_Report.html`
- **報表網址**：`https://lard23chen.github.io/report/Azure_Cost_Analysis_Report.html`
- **資料來源**：MongoDB (`QwareAi` / `AzureMonthlyCost`)
- **生成腳本**：`generate_azure_cost_report.js`
- **負責人**：陳俊良
- **主要目的**：追蹤 Qware 平台各系統每月 Azure 雲端費用，提供趨勢分析、系統拆分與年度匯總，供成本控管決策使用。

---

## 2. 資料來源結構 (MongoDB Schema)

Collection：`QwareAi.AzureMonthlyCost`

| 欄位名稱 | 型態 | 說明 |
|---------|------|------|
| `YearMonth` | String | 月份，格式 `YYYY/MM`（如 `2026/03`） |
| `SystemA_Cost` | Number | A 系統費用 |
| `SystemD_Cost` | Number | D 系統費用 |
| `SystemE_Cost` | Number | E 系統費用 |
| `SystemHotel_Cost` | Number | Hotel 系統費用 |
| `Common_Cost` | Number | 共用費用 |
| `PayGateway_Cost` | Number | 支付閘道費用 |
| `iSharingGift_Cost` | Number | iSharingGift 費用 |
| `SystemCloudCard_Cost` | Number | CloudCard 系統費用 |
| `PaymentPortal_Cost` | Number | 支付入口費用（舊欄位，2023 後為 0） |
| `SystemHuiwan_Cost` | Number | 會員系統費用（2026/01 起新增，無資料月份視為 0） |
| `QWARE_Ticket_TotalCost` | Number | 當月總費用（所有系統加總） |
| `RefundForMonth` | Number | 本月退款金額 |

> **注意**：`SystemHuiwan_Cost` 從 2026/01 才開始有資料，顯示環比變化時需檢查前一月是否有該欄位（`undefined` 則不顯示漲跌幅）。

---

## 3. 視覺樣式設定 (Visual Styles)

報表採用 **Azure 深色主題**，呼應 Microsoft Azure 品牌色。

- **配色方案 (CSS Variables)**：
  - 背景色 (`--bg-color`): `#121212`
  - 卡片背景 (`--card-bg`): `#1e1e1e`
  - 主要文字 (`--text-primary`): `#e0e0e0`
  - 次要文字 (`--text-secondary`): `#a0a0a0`
  - 強調色 (`--accent-color`): `#0078D4`（Azure Blue）
  - 次要強調 (`--accent-secondary`): `#50E6FF`
  - A系統色 (`--color-a`): `#FF7043`
  - D系統色 (`--color-d`): `#42A5F5`
  - E系統色 (`--color-e`): `#66BB6A`
  - 總費用色 (`--color-total`): `#FBC02D`
  - 其他/共用色 (`--color-other`): `#AB47BC`
  - 會員系統色: `#F06292`（粉紅）
- **字體**：`Outfit`, `Noto Sans TC`（Google Fonts）

---

## 4. 核心組件 (Components)

### 4.1 頂部統計卡片 (Stats Grid)

最新月份顯示以下 5 張卡片：

| 卡片 | 欄位 | 樣式色 |
|-----|------|-------|
| 最新月份總費用 | `QWARE_Ticket_TotalCost` | `--color-total` 黃 |
| A系統費用 | `SystemA_Cost` | `--color-a` 橘紅 |
| D系統費用 | `SystemD_Cost` | `--color-d` 藍 |
| E系統費用 | `SystemE_Cost` | `--color-e` 綠 |
| 會員系統費用 | `SystemHuiwan_Cost` | `#F06292` 粉紅 |

每張卡片顯示：費用金額 + 佔總費用百分比。總費用卡片額外顯示相較上月漲跌幅（`▲`/`▼`）。

### 4.2 月份篩選器 (Filter)

- 兩個 `<select>` 下拉選單：開始月份 / 結束月份
- 預設顯示最近 12 個月
- 變更時觸發 `updateView()` 同步更新圖表與表格

### 4.3 每月詳細數據表格

欄位順序（左至右）：

| 月份 | A系統 | D系統 | E系統 | 共用 | 會員 | 總費用 |

- 每欄顯示金額 + 環比變化（`▲`/`▼`百分比）
- **會員欄例外**：若前一月無 `SystemHuiwan_Cost` 欄位（`undefined`），不顯示環比（避免 2026/01 出現誤導性的巨幅漲幅）
- 表格底部顯示區間加總列
- 資料以月份倒序（最新在上）顯示

### 4.3.1 最近月份趨勢分析 (MoM Analysis)

位於每月詳細數據表格正下方，由 `generate_azure_cost_report.js` 在 Node.js 層以 `latestDoc` / `prevDoc` 產生，**不得手動寫死在 HTML**（下次執行腳本會整頁覆蓋）。

- **格式**：三行文字摘要：
  - 💰 總費用（▲/▼百分比 + 絕對差 + 當月金額）
  - 🖥️ 各系統（A/D/E 各自 ▲/▼百分比 + 絕對差）
  - 📦 其他（共用 + 會員各自 ▲/▼，若前月無 `SystemHuiwan_Cost` 則略去會員行）
- **顏色語意**：費用**上升**為紅色 `#ef5350`（壞），**下降**為綠色 `#66BB6A`（好），與交易量報表相反
- **樣式**：深灰背景 `#252525`、左側 `3px solid var(--accent-color)` Azure Blue 飾條、`max-width:820px`，h4 使用 `var(--accent-color)`
- **資料來源**：`latestDoc`（最後一筆）與 `prevDoc`（`allDocs` 中前一月）

### 4.4 年度費用匯總表格

欄位：年份、月份數、A系統、D系統、E系統、共用、會員、年度總費用、YoY 變化

- 顯示全部年份（倒序）
- 底部顯示全期總計列
- YoY 計算：`(當年總費用 - 去年總費用) / 去年總費用 × 100%`

### 4.5 圖表 (Charts)

- **每月費用趨勢折線圖**：Chart.js `line`，顯示 A/D/E 三系統趨勢，帶數值標籤（`chartjs-plugin-datalabels`），千位縮寫（如 `1,200k`）
- **系統費用堆疊長條圖**：Chart.js `bar`（stacked），顯示 A/D/E/共用四層，篩選器聯動更新

### 4.6 回首頁按鈕

固定右下角，連結至 `report_index.html`。

---

## 5. 生成流程 (Generation Process)

```
MongoDB (QwareAi.AzureMonthlyCost)
    ↓ find({}).sort({ YearMonth: 1 })
generate_azure_cost_report.js (Node.js)
    ↓ JSON.stringify(allDocs) 注入 HTML
Azure_Cost_Analysis_Report.html
    ↓ git add / commit / push
https://lard23chen.github.io/report/Azure_Cost_Analysis_Report.html
```

執行指令：
```bash
node generate_azure_cost_report.js
```

---

## 6. 新增月份資料流程 (Monthly Update SOP)

1. 確認 MongoDB `AzureMonthlyCost` 已有新月份資料（透過 `check_azure_data.js` 驗證）
2. 執行 `node generate_azure_cost_report.js` 重新生成報表
3. 驗證最新月份已出現在 HTML 的 `allData` 陣列中
4. 更新 `HTML_Report_Catalog.html` 第 18 筆的更新時間
5. `git add` → `git commit` → `git push`

---

## 7. 欄位新增規範 (Adding New Cost Fields)

新增 MongoDB 欄位至報表時，需同步修改 `generate_azure_cost_report.js` 的三個位置：

1. **Stats Grid**：在頂部卡片區加入新卡片 HTML（含 `card::before` CSS 顏色）
2. **每月表格 `<thead>`**：加入新欄 `<th>`
3. **`updateView()` 函數**：加入變數累加、行 HTML 生成、footer 列
4. **`buildYearlyTable()` 函數**：加入 yearMap 欄位累加、tbody/tfoot 列

> **漲跌幅顯示原則**：若新欄位為特定月份才開始存在（如 `SystemHuiwan_Cost` 從 2026/01 起），判斷環比時需使用 `prev && prev.欄位名 !== undefined` 而非 `prev ? prev.欄位名 || 0 : null`，確保第一個月不顯示誤導性漲幅。

---

## 8. Git 管理規範

- 每次更新報表後立即 commit，訊息格式：`Update Azure_Cost_Analysis_Report: <說明>`
- 新增欄位時同步 commit generator 腳本與 HTML 兩個檔案

---

### ⚠️ 維護注意：HTML 與 Generator 必須同步

`Azure_Cost_Analysis_Report.html` 由 `generate_azure_cost_report.js` **完整覆蓋產生**。凡修改 HTML 中任何邏輯，必須同步修改 generator 對應位置。

受影響的功能（歷史上曾被覆蓋過）：
- MoM Analysis 區塊 — 2026/05/21 新增，已同步至 generator（`momSection` 變數直接嵌入模板字串，使用 server-side 已計算的 `latestDoc` / `prevDoc`）

---

*最後更新日期：2026/05/21*
