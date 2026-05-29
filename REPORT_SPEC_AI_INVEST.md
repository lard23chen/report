# REPORT_SPEC_AI_INVEST.md

## 報表編號：#37 — AI_Invest_Report.html

**產出腳本**：`generate_aiinvest_report.js`  
**最後更新**：2026/05/29（加入股利資料）  
**GitHub Pages**：https://lard23chen.github.io/report/AI_Invest_Report.html

---

## 1. 資料來源

### 1.1 交易記錄（isBuy / isDividend: false）

| 檔案 | 時間範圍 | 筆數 |
|------|---------|------|
| `aiinvest20260529 (2).xlsx` | 2025/06 – 2026/05 | 37 |
| `aiinvest20260529 (3).xlsx` | 2024/06 – 2025/05 | 52 |
| `aiinvest20260529 (4).xlsx` | 2023/05 – 2024/05 | 54 |
| `aiinvest20260529 (5).xlsx` | 2022/06 – 2023/05 | 24 |
| `aiinvest20260529 (6).xlsx` | 2021/06 – 2022/05 | 34 |
| `aiinvest20260529 (7).xlsx` | 2021/03 – 2021/05 | 10 |
| **合計** | **2021/03/08 – 2026/05/26** | **205 筆** |

欄位格式（Row 2 表頭，Row 3 起資料）：

| 欄位 | 說明 |
|------|------|
| A：日期 | Excel serial 或 `YYYY/M/D` 字串 |
| B：名稱 | 股票名稱（中文）+ 代碼，如 `蘋果(AAPL)` |
| C：買賣 | `定額買`/`定額賣`/`定股買`/`定股賣` |
| D：股數 | 數量（含小數） |
| E：均價 | 每股成交價（USD）|
| F：成交金額 | 金額（USD）|
| G：幣別 | USD |
| H：手續費 | Broker fee（USD）|
| I：其他費用 | 稅或雜費（USD）|
| K：淨金額 | 實際收付金額（USD）|

### 1.2 股利記錄（isDividend: true）

| 檔案 | 時間範圍 | 筆數 |
|------|---------|------|
| `美股股利_20260529.xlsx` | 2021/05 – 2026/05 | 240 |

欄位格式：

| 欄位 | 說明 |
|------|------|
| A：發放日 | Excel serial |
| B：代號 | 股票代碼（TLT/BNDW/EWJ/LLY/AAPL）|
| C：全名 | 基金完整名稱 |
| D：每股股利 | USD/股 |
| E：基準股數 | 持有股數 |
| F：發放金額 | 稅前總額（USD）|
| G：稅款 | 預扣所得稅（USD）|
| H：淨額 | 稅後實收（USD）|

**股利分布**：TLT 46 筆、BNDW 184 筆、EWJ 7 筆、LLY 2 筆、AAPL 1 筆

### 1.3 MongoDB 集合

- DB：`AlexLIFE`，Collection：`USA_Stock`
- 總文件數：**445 筆**（205 交易 + 240 股利）
- 關鍵欄位：`isDividend`（boolean）、`isBuy`（boolean）、`net`（股利淨額）
- 索引：`dateObj`, `code+dateObj`, `yearMonth`, `isBuy`, `isDividend`

---

## 2. 標的與顏色

| 代碼 | 名稱 | 顏色 |
|------|------|------|
| AAPL | 蘋果 | `#a8dadc` |
| AMD | 超微半導體 | `#e63946` |
| BNDW | Vanguard Total World Bond ETF | `#457b9d` |
| EWJ | iShares MSCI Japan ETF | `#f4a261` |
| TLT | iShares 20+ Year Treasury Bond ETF | `#2a9d8f` |
| LLY | Eli Lilly | `#ab47bc` |

---

## 3. 報表區塊

### 3.1 頁首概要卡（Summary Cards）

| 卡片 | 說明 |
|------|------|
| 總買入金額 | `buys.amount` 合計 |
| 總賣出金額 | `sells.amount` 合計 |
| 已實現損益 | 扣手續費後 |
| 💰 股利淨收入 | `divDocs.net` 合計；sub 顯示稅前 / 稅款 |
| 交易筆數 | `trades.length`；sub 顯示 買/賣/股利各幾筆 |
| 投資年數 | 年份範圍 |
| 標的數 | 交易標的代碼 |

### 3.2 投資配置比例（Doughnut Chart）

- 以每支標的「總買進金額」為權重
- Chart.js Doughnut
- 顯示百分比 + 金額 tooltip

### 3.3 年度買進/賣出（Bar Chart）

- X 軸：年份
- Y 軸：金額（USD）
- 買進（grouped bar）、賣出（grouped bar）

### 3.4 月度買進趨勢（Bar Chart）

- X 軸：YYYY/MM，最近 24 個月
- Y 軸：金額（USD）

### 3.5 每股損益卡（Stock Cards）

每支標的一張卡，顯示：

| 指標 | 說明 |
|------|------|
| 總買入 | 金額 + 股數 + 買入筆數 |
| 均攤成本 | `totalCost / totalBuyShares`（含手續費）|
| 已賣出 | 金額 + 股數（無則 `—`）|
| 已實現損益 | `(sellAmt - sellFee) - totalCost * sellRatio` |
| sc-footer | 持有中顯示淨股數；若有股利則加 `💰 股利淨收` 金額 |

### 3.6 年度彙總表

| 欄位 | 說明 |
|------|------|
| 年份 | |
| 買進筆數 | |
| 買進金額 | USD |
| 賣出筆數 | |
| 賣出金額 | USD |
| 淨流出 | 買進 - 賣出 |

### 3.7 完整明細表（交易 + 股利）

全部 445 筆（含 240 筆股利），顯示：日期 / 代碼 / 類型 / 股數 / 均價 / 金額 / 手續費（稅） / 淨收付

- **買賣列**：紅色（買進）/ 綠色（賣出）
- **股利列**：金黃色背景（`rgba(251,192,45,0.05)`），欄位顯示稅前金額 + 稅款 + 淨額

**篩選器**：
- 時間：年份 / 月份 下拉選單
- 標的：代碼 Chips（AAPL / AMD / BNDW / EWJ / TLT / LLY）
- 類型：全部 / 買進 / 賣出 / 💰 股利（Chips）

---

## 4. 技術規格

- **Runtime**：Node.js（v16+）
- **套件**：`xlsx`（SheetJS，`npm i xlsx`）
- **Chart.js**：CDN v3.x + chartjs-plugin-datalabels
- **主題**：Dark Indigo（`--bg:#0f1117`、`--accent:#5c6bc0`）
- **字型**：Outfit + Noto Sans TC（Google Fonts）
- **資料 API**：`https://report-theta-nine.vercel.app/api/usa-stock`（Vercel Serverless，`usa_stock_api.js`）
- **輸出**：單一 HTML，資料由 Vercel API 動態讀取，不需本地 server

---

## 5. 執行方式

```bash
cd "D:\2025\AI\MongoDB"
node generate_aiinvest_report.js
```

輸出：`AI_Invest_Report.html`（約 100 KB）

---

## 6. 更新注意事項

- 每次更換 xlsx 資料後重新執行腳本即可更新報表
- xlsx 檔名若有變更，需同步修改 `generate_aiinvest_report.js` 第 7–14 行的 `FILES` 陣列
- HTML 與 generator 必須保持同步（CLAUDE.md 規範）
- 部署至 GitHub Pages：`git add AI_Invest_Report.html && git commit -m "Update AI invest report" && git push origin main`
