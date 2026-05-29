# REPORT_SPEC_AI_INVEST.md

## 報表編號：#37 — AI_Invest_Report.html

**產出腳本**：`generate_aiinvest_report.js`  
**最後更新**：2026/05/29  
**GitHub Pages**：https://lard23chen.github.io/report/AI_Invest_Report.html

---

## 1. 資料來源

| 檔案 | 時間範圍 | 筆數 |
|------|---------|------|
| `aiinvest20260529 (2).xlsx` | 2025/06 – 2026/05 | 37 |
| `aiinvest20260529 (3).xlsx` | 2024/06 – 2025/05 | 52 |
| `aiinvest20260529 (4).xlsx` | 2023/05 – 2024/05 | 54 |
| `aiinvest20260529 (5).xlsx` | 2022/06 – 2023/05 | 24 |
| `aiinvest20260529 (6).xlsx` | 2021/06 – 2022/05 | 34 |
| `aiinvest20260529 (7).xlsx` | 2021/03 – 2021/05 | 10 |
| **合計** | **2021/03/08 – 2026/05/26** | **~205 筆** |

### 欄位格式

每個 xlsx 的 Row 3 起為資料（Row 1 空白、Row 2 表頭）：

| 欄位 | 說明 |
|------|------|
| A：日期 | Excel serial 或 `YYYY/M/D` 字串 |
| B：名稱 | 股票名稱（中文）|
| C：代碼 | 股票代碼（AAPL、AMD、BNDW、EWJ、TLT、LLY）|
| D：買賣 | `買進` / `賣出` |
| E：股數 | 數量（含小數） |
| F：均價 | 每股成交價（USD）|
| G：成交金額 | 金額（USD）|
| H：手續費 | Broker fee（USD）|
| I：其他費用 | 稅或其他雜費（USD）|

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

- 🗓 交易總筆數
- 💰 總投入金額（USD，所有買進 amount + fee）
- 🏦 已實現損益（P&L，扣費後）
- 📦 持倉標的數量

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
| 總買進金額 | 含手續費 |
| 總賣出金額 | 扣手續費後 |
| 已實現損益 | `totalSellAmt - totalSellFee - (totalCost * sellRatio)` |
| 平均成本 | `totalCost / totalBuyShares` |
| 淨持倉股數 | `buyShares - sellShares` |

### 3.6 年度彙總表

| 欄位 | 說明 |
|------|------|
| 年份 | |
| 買進筆數 | |
| 買進金額 | USD |
| 賣出筆數 | |
| 賣出金額 | USD |
| 淨流出 | 買進 - 賣出 |

### 3.7 完整交易明細表

全部 205 筆，可欄位排序，顯示：日期 / 代碼 / 買賣 / 股數 / 均價 / 金額 / 手續費 / 其他費 / 合計費用

---

## 4. 技術規格

- **Runtime**：Node.js（v16+）
- **套件**：`xlsx`（SheetJS，`npm i xlsx`）
- **Chart.js**：CDN v3.x + chartjs-plugin-datalabels
- **主題**：Dark Indigo（`--bg:#0f1117`、`--accent:#5c6bc0`）
- **字型**：Outfit + Noto Sans TC（Google Fonts）
- **輸出**：單一 HTML 內嵌所有 JS/CSS，無外部依賴

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
