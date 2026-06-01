# report_index.html 視覺規範與功能組件說明

> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。


本文件定義「A 系統報表導覽儀表板」(`report_index.html`) 的視覺樣式、組件結構與互動規範。未來進行維護或新增功能時，請依此規範進行。

---

## 1. 基本資訊 (General Info)

- **檔名**：`report_index.html`
- **用途**：A 系統所有分析報表的入口儀表板，提供月份交易統計摘要、趨勢圖及各報表連結
- **資料來源**：靜態 HTML（數字由 Node.js 腳本產生後手動更新），趨勢圖資料硬編碼於 JS 區段
- **排程**：每月一號 08:30 更新
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
  └── <div.tab-content> × 5  各 Tab 內容
      ├── tab1: 本月/上月報表
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
| 購票金額 | `正常` 狀態 `售價` 加總 |
| 退票筆數 | 退票訂單不重複計數 |
| 退票張數 | 退票記錄筆數 |
| 退票手續費 | `手續費` 欄位加總 |

- **漲降幅度徽章 (`.change-badge`)**：
  - 上漲：`.change-up`（綠色 `#10b981`，背景 `rgba(16,185,129,0.15)`）
  - 下跌：`.change-down`（紅色 `#ef4444`，背景 `rgba(239,68,68,0.15)`）
  - 格式：`▲ XX.X%` 或 `▼ XX.X%`，基準月顯示 `--`
  - 徽章不使用 `white-space: nowrap`，允許換行完整顯示
- **捲軸**：表格容器使用 `overflow-x: hidden`，不顯示水平捲軸
- **總計列**：加粗，背景 `rgba(255,255,255,0.05)`，上方加粗邊框

> ⚠️ **重要**：數字必須從 MongoDB `Qware_Ticket_Data` 以 `交易時間` 欄位過濾月份（`$regex: "^YYYY-MM"`），不可使用其他日期欄位（`演出時間`、`退票時間` 等），否則會造成跨月重複計算。

### 4.3 趨勢圖 (`revenueTrendChart`)

- **套件**：`Chart.js` + `chartjs-plugin-datalabels@2.0.0`
- **類型**：`line`，fill: true，tension: 0.4
- **顏色**：`#3b82f6`（線條）、`rgba(59,130,246,0.1)`（填充）
- **DataLabels**：顯示在資料點上方，格式 `NT$ X.XM`（百萬為單位）
- **X 軸**：`YYYY-MM` 月份標籤，無格線
- **Y 軸**：以百萬（M）為單位，始於 0
- **資料來源**：手動維護於 HTML 的 `data: [...]` 陣列，月份順序由舊到新

### 4.4 Tab 導覽列

- 共 5 個 Tab（tab1, tab3, tab4, tab5, tab6）
- 切換動畫：`fadeIn`（`opacity: 0 → 1` + `translateY(10px → 0)`，0.5s）
- `.tab-btn.active`：藍色文字 + 半透明藍色背景

### 4.5 報表卡片 (`.card`)

- 圓角 `16px`，深色背景，細白邊框
- Hover：上移 5px + 陰影加深 + 頂部漸層彩條顯示
- 圖示色系：
  - 藍（月報）、綠（對比）、橙（專案/演唱會）、紫（分析）
- 底部有 Badge（`Monthly` / `Quarterly` 等）+ 查看報表按鈕

---

## 5. 資料維護注意事項 (Maintenance Notes)

1. **月份統計表與 Tab1 卡片均已全自動**：每月 1 日 `daily_update.bat` 執行時，`update_index_stats.js` 會自動從 MongoDB 聚合最新月份數據，更新統計表、趨勢圖、頁首時間，以及 `本月/上月報表` Tab 中的月份卡片連結。
2. **月報 HTML 自動產生**：每月 1 日 `daily_update.bat` 偵測到日期為 1 時，自動執行 `generate_monthly_report.js` 產生上月完整分析報表。無需手動建立新的 generator 腳本。
3. **新增報表連結**：在對應 Tab 的 `.grid` 中新增 `.card`，確認 `href` 連結正確。
4. **生成時間**：由 `new Date()` 即時產生，無需手動維護。
5. **Tab1 月份卡片定位**：HTML 中以 `<!-- TAB1_MONTH_CARD_START -->` / `<!-- TAB1_MONTH_CARD_END -->` 標記，`update_index_stats.js` 用 regex 替換，勿手動移除這兩行標記。

---

## 6. 相關腳本

| 腳本 | 用途 |
|------|------|
| `update_index_stats.js` | **主要維護腳本**：從 MongoDB 聚合所有月份數據，自動更新統計表、趨勢圖、頁首時間、Tab1 月份卡片；每日由 `daily_update.bat` 呼叫 |
| `generate_monthly_report.js` | **通用月報 generator**：自動偵測上月（每月 1 日執行），可手動指定月份：`node generate_monthly_report.js 2026-05`；輸出 `A_Qware_Revenue_Report_YYYY年MM月_分析報表.html` |
| `generate_report_may_2026.js` | 2026 年 5 月報表（已產出，由此腳本產生；後續月份改用 `generate_monthly_report.js`） |
| `update_all_verified.js` | ⚠️ 已知使用錯誤數字，勿使用 |

---

*最後更新日期：2026/06/01*
