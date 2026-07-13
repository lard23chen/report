# report_index.html 視覺規範與功能組件說明

> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。


本文件定義「A 系統報表導覽儀表板」(`report_index.html`) 的視覺樣式、組件結構與互動規範。未來進行維護或新增功能時，請依此規範進行。

---

## 1. 基本資訊 (General Info)

- **檔名**：`report_index.html`
- **用途**：A 系統所有分析報表的入口儀表板，提供月份交易統計摘要、趨勢圖及各報表連結
- **資料來源**：靜態 HTML（數字由 Node.js 腳本產生後手動更新），趨勢圖資料硬編碼於 JS 區段
- **排程**：每日 08:00 由 `daily_update.bat` 執行 `update_index_stats.js` 更新統計表/趨勢圖/月份卡片；每月 2 日另由 `generate_monthly_report.js` 產出上月月報（2026/07/13 更正：舊寫法「每月二號 08:30」不符實際）
- **負責人**：陳俊良

---

## 2. 視覺樣式設定 (Visual Styles)

採用**深色科技風 (Dark Tech)** 主題。

### 2.1 CSS 變數 (CSS Variables)

| 變數 | 值 | 用途 |
|------|-----|------|
| `--bg-color` | `#0f172a` | 頁面底色（深藍黑） |
| `--card-bg` | `#1e293b` | 卡片背景 |
| `--text-primary` | `#f8fafc` | 主要文字 |
| `--text-secondary` | `#94a3b8` | 次要文字、說明文字 |
| `--accent-color` | `#3b82f6` | 強調色（藍） |
| `--accent-hover` | `#2563eb` | 按鈕 Hover 狀態 |
| `--success-color` | `#10b981` | 正向指標（綠） |
| `--warning-color` | `#f59e0b` | 警示指標（橙） |
| `--purple-color` | `#8b5cf6` | 特殊標記（紫） |
| `--tab-active-bg` | `rgba(59,130,246,0.2)` | 已選 Tab 背景 |

### 2.2 字體

- **主字體**：`Outfit`（Google Fonts，weights: 300 / 400 / 600 / 700）
- **標題漸層**：`linear-gradient(to right, #60a5fa, #a78bfa)`（藍→紫，-webkit-text-fill-color 方式實現）

### 2.3 背景效果

使用 `position: fixed` 的 `.background-glow` 層：
```css
background:
  radial-gradient(circle at 10% 20%, rgba(59,130,246,0.15) 0%, transparent 40%),
  radial-gradient(circle at 90% 80%, rgba(139,92,246,0.15) 0%, transparent 40%);
```

---

## 3. 頁面結構 (Layout)

```
<header>        ← Logo 左側 + 報表產生日期/時間 右側
<div.container>
  ├── <h1>      ← 頁面主標題（漸層文字）
  ├── <p.subtitle>
  ├── 📊 月份交易統計區塊
  │   ├── 標題 + lastUpdated 時間戳
  │   └── <table> 月份統計表
  ├── 📈 趨勢圖區塊
  │   └── <canvas id="revenueTrendChart">
  ├── <div.tabs>  Tab 導覽列
  └── <div.tab-content> × 6  各 Tab 內容
      ├── tab1: 本月/上月報表
      ├── tab7: 週報報表分析
      ├── tab3: 歷史報表分析
      ├── tab4: 各節目報表分析
      ├── tab5: 會員資料分析
      └── tab6: 流量/費用分析
<footer>
```

---

## 4. 關鍵組件規範 (Components)

### 4.1 Header（頁首）

- 左側：`.logo` — "Qware Analytics"，白色漸層文字
- 右側：兩行文字
  - 第一行：當天日期（粗體，`text-primary`）
  - 第二行：「報表產生時間：HH:MM:SS」（`text-secondary`）
  - 均由 `document.write(new Date().toLocaleString('zh-TW'))` 即時產生

### 4.2 月份交易統計表 (Stats Table)

| 欄位 | 說明 |
|------|------|
| 月份 | YYYY-MM 格式 |
| 購票筆數 | 不重複訂單數（`訂單編號` 前綴 Set 計數） |
| 購票張數 | `狀態 === '正常'` 的記錄筆數 |
| 電子票張數 | `正常` 且 `取票方式 === '未列印'` 的張數，次行顯示占當月購票張數比例（2026/07/13 新增，表頭 `--accent-color` 藍） |
| 紙票張數 | `正常` 且 `取票方式 === '已取'` 的張數，次行顯示占比（2026/07/13 新增，表頭 `--purple-color` 紫） |
| 購票金額 | `正常` 狀態 `售價` 加總 |
| 退票筆數 | 退票訂單不重複計數 |
| 退票張數 | 退票記錄筆數 |
| 退票手續費 | `手續費` 欄位加總 |

> 電子票/紙票判定與週報一致（`取票方式`：未列印=電子票、已取=紙票，兩值已涵蓋全部正常票，占比合計 100%）；此兩欄不附漲降幅徽章、總計列同樣顯示總張數與整體占比。

- **MoM 分析區塊**（表格下方「最近月份趨勢分析」）共四行：📊 交易量、💰 收入、🎫 票種結構（2026/07/13 新增）、🔻/🔺 退票。票種結構行顯示電子票張數/占比/占比增減（百分點 pp）/張數增減%，紙票張數/占比/張數增減%，結尾附趨勢判語（占比差 <0.5pp 顯示「與上月相當」，電子票占比上升顯示「無紙化趨勢向上」，下降顯示「紙票占比回升」）。

- **漲降幅度徽章 (`.change-badge`)**：
  - 上漲：`.change-up`（綠色 `#10b981`，背景 `rgba(16,185,129,0.15)`）
  - 下跌：`.change-down`（紅色 `#ef4444`，背景 `rgba(239,68,68,0.15)`）
  - 格式：`▲ XX.X%` 或 `▼ XX.X%`，基準月顯示 `--`
  - 徽章不使用 `white-space: nowrap`，允許換行完整顯示
- **捲軸**：表格容器使用 `overflow-x: hidden`，不顯示水平捲軸
- **總計列**：加粗，背景 `rgba(255,255,255,0.05)`，上方加粗邊框

> ⚠️ **重要**：數字必須從 MongoDB `Qware_Ticket_Data` 以 `交易時間` 欄位過濾月份（`$regex: "^YYYY-MM"`），不可使用其他日期欄位（`演出時間`、`退票時間` 等），否則會造成跨月重複計算。

> ⚠️ **排除 B 開頭訂單（2026/07/09 起）**：`update_index_stats.js` 聚合 `$match` 階段以 `"訂單編號": { $not: /^B/ }` 排除訂單編號 B 開頭的訂單，月份統計表、總計列、MoM 分析與趨勢圖數字**皆不含 B 訂單**；表格下方註腳已標明。與週報（`REPORT_SPEC_A_WEEKLY_REVENUE.md`）的排除規則一致。

### 4.3 趨勢圖 (`revenueTrendChart`)

- **套件**：`Chart.js` + `chartjs-plugin-datalabels@2.0.0`
- **類型**：`line`，fill: true，tension: 0.4
- **顏色**：`#3b82f6`（線條）、`rgba(59,130,246,0.1)`（填充）
- **DataLabels**：顯示在資料點上方，格式 `NT$ X.XM`（百萬為單位）
- **X 軸**：`YYYY-MM` 月份標籤，無格線
- **Y 軸**：以百萬（M）為單位，始於 0
- **資料來源**：手動維護於 HTML 的 `data: [...]` 陣列，月份順序由舊到新

### 4.4 Tab 導覽列

- 共 6 個 Tab（tab1, tab7, tab3, tab4, tab5, tab6；tab7「週報報表分析」於 2026/07/09 新增，位於 tab1 之後）
- 新增 Tab 需同步三處：`.tabs` 內的 `<button>`、對應的 `<div class="tab-content">`、JS `getTabName()` 的名稱對照表
- **tab7 卡片由 `generate_a_weekly_report.js` 每週四自動插入**（grid 最上方、最新在前，標題與說明帶週期日期），勿手動編輯 tab7 grid 內容；插入邏輯以 `<div id="tab7" class="tab-content">` + `<div class="grid">` 的開頭結構定位，修改此結構需同步改該腳本
- 切換動畫：`fadeIn`（`opacity: 0 → 1` + `translateY(10px → 0)`，0.5s）
- `.tab-btn.active`：藍色文字 + 半透明藍色背景

### 4.5 報表卡片 (`.card`)

- 圓角 `16px`，深色背景，細白邊框
- Hover：上移 5px + 陰影加深 + 頂部漸層彩條顯示
- 圖示色系：
  - 藍（月報）、綠（對比）、橙（專案/演唱會）、紫（分析）
- 底部有 Badge（`Monthly` / `Quarterly` 等）+ 查看報表按鈕

### 4.6 tab3 歷史報表分析排列規則

- **月報卡片依年月由新到舊排列**，最新月份置於左上角
- 非月報類型（如「歷史 IP 地理分析」）置於月報列表之後
- 新增月份卡片時，插入至最上方（tab1 的當月卡片移入 tab3 後，同樣放到最前面）
- **此移入動作自 2026-07 起已自動化**，由 `update_index_stats.js` 於每次更新 Tab1 月份卡片時一併處理，無需手動搬移（詳見 §5.6）

---

## 5. 資料維護注意事項 (Maintenance Notes)

1. **月份統計表與 Tab1 卡片均已全自動**：每月 2 日 `daily_update.bat` 執行時，`update_index_stats.js` 會自動從 MongoDB 聚合最新月份數據，更新統計表、趨勢圖、頁首時間，以及 `本月/上月報表` Tab 中的月份卡片連結。
2. **月報 HTML 自動產生**：每月 2 日 `daily_update.bat` 偵測到日期為 2 時，自動執行 `generate_monthly_report.js` 產生上月完整分析報表。無需手動建立新的 generator 腳本。
3. **新增報表連結**：在對應 Tab 的 `.grid` 中新增 `.card`，確認 `href` 連結正確。
4. **生成時間**：由 `new Date()` 即時產生，無需手動維護。
5. **Tab1 月份卡片定位**：HTML 中以 `<!-- TAB1_MONTH_CARD_START -->` / `<!-- TAB1_MONTH_CARD_END -->` 標記，`update_index_stats.js` 用 regex 替換，勿手動移除這兩行標記。
6. **Tab3 歷史報表卡片（已全自動，2026-07 起）**：月報卡片須依年月**由新到舊**排列，最新月份在左上。非月報型（IP 地理分析等）放在月報列表之後。`update_index_stats.js` 在覆寫 Tab1 月份卡片前，會先讀出被取代的舊卡片（年月 + href），若年月有變化且該 href 尚未出現在檔案中，就自動插入 Tab3 `.grid` 最上方；同月重跑則不會重複插入。（背景：2026-07 曾因這一步是手動流程而漏做，導致 2026年05月 報表卡片消失，詳見 git commit `0f24124`。）

---

## 6. 相關腳本

| 腳本 | 用途 |
|------|------|
| `update_index_stats.js` | **主要維護腳本**：從 MongoDB 聚合所有月份數據，自動更新統計表、趨勢圖、頁首時間、Tab1 月份卡片，並在月份卡片被取代時自動移入 Tab3 歷史列表最上方（§5.6）；每日由 `daily_update.bat` 呼叫 |
| `generate_monthly_report.js` | **通用月報 generator**：自動偵測上月（每月 2 日執行），可手動指定月份：`node generate_monthly_report.js 2026-05`；輸出 `A_Qware_Revenue_Report_YYYY年MM月_分析報表.html` |
| `generate_report_may_2026.js` | 2026 年 5 月報表（已產出，由此腳本產生；後續月份改用 `generate_monthly_report.js`） |
| `update_all_verified.js` | ⚠️ 已知使用錯誤數字，勿使用 |

---

*最後更新日期：2026/07/13（月份統計表新增「電子票張數」「紙票張數」兩欄，含占比）*
*2026/07/09：新增 tab7 週報報表分析、月份統計排除 B 開頭訂單*
