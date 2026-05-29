# REPORT_SPEC_AI_INVEST.md

## 報表編號：#37 — 美股投資分析報告

**HTML 檔名**：`AI_Invest_Report.html`  
**產出腳本**：`generate_aiinvest_report.js`  
**最後更新**：2026/05/29  
**GitHub Pages**：https://lard23chen.github.io/report/AI_Invest_Report.html  
**目錄入口**：`ALEX_Life_Catalog.html`（#37）

---

## 1. 資料來源

### 1.1 交易記錄（`isDividend: false`）

| 檔案 | 時間範圍 | 筆數 |
|------|---------|------|
| `aiinvest20260529 (2).xlsx` | 2025/06 – 2026/05 | 37 |
| `aiinvest20260529 (3).xlsx` | 2024/06 – 2025/05 | 52 |
| `aiinvest20260529 (4).xlsx` | 2023/05 – 2024/05 | 54 |
| `aiinvest20260529 (5).xlsx` | 2022/06 – 2023/05 | 24 |
| `aiinvest20260529 (6).xlsx` | 2021/06 – 2022/05 | 34 |
| `aiinvest20260529 (7).xlsx` | 2021/03 – 2021/05 | 10 |
| **合計** | **2021/03/08 – 2026/05/26** | **205 筆** |

**欄位格式**（Row 2 表頭，Row 3 起資料）：

| 欄位 | 說明 |
|------|------|
| A：日期 | Excel serial 或 `YYYY/M/D` 字串 |
| B：名稱 | 股票名稱（中文），含代碼，如 `蘋果(AAPL)` |
| C：買賣 | `定額買` / `定額賣` / `定股買` / `定股賣` |
| D：股數 | 數量（含小數） |
| E：均價 | 每股成交價（USD） |
| F：成交金額 | 金額（USD） |
| G：幣別 | USD |
| H：手續費 | Broker fee（USD） |
| I：其他費用 | 稅或雜費（USD） |
| K：淨金額 | 實際收付金額（USD） |

---

### 1.2 股利記錄（`isDividend: true`）

| 檔案 | 時間範圍 | 筆數 |
|------|---------|------|
| `美股股利_20260529.xlsx` | 2021/05 – 2026/05 | 240 |

**股利分布**：BNDW 184 筆、TLT 46 筆、EWJ 7 筆、LLY 2 筆、AAPL 1 筆

**欄位格式**：

| 欄位 | 說明 |
|------|------|
| A：發放日 | Excel serial |
| B：代號 | 股票代碼（TLT / BNDW / EWJ / LLY / AAPL） |
| C：全名 | 基金完整名稱 |
| D：每股股利 | USD/股 |
| E：基準股數 | 持有股數 |
| F：發放金額 | 稅前總額（USD） |
| G：稅款 | 預扣所得稅（USD） |
| H：淨額 | 稅後實收（USD） |

---

### 1.3 MongoDB 集合

| 項目 | 值 |
|------|-----|
| URI | `mongodb+srv://lard23:...@cluster0.m7ujsnq.mongodb.net/` |
| DB | `AlexLIFE` |
| Collection | `USA_Stock` |
| 總文件數 | **445 筆**（205 交易 + 240 股利） |
| 索引 | `dateObj`, `{code,dateObj}`, `yearMonth`, `isBuy`, `isDividend` |

**文件關鍵欄位**：

| 欄位 | 型別 | 說明 |
|------|------|------|
| `date` | String | `YYYY/MM/DD` |
| `dateObj` | Date | 排序用 |
| `year` / `month` | Number | 篩選用 |
| `yearMonth` | String | `YYYY/MM` |
| `code` | String | 股票代碼 |
| `name` | String | 中文簡稱 |
| `action` | String | 定額買/定額賣/… 或 現金股利 |
| `isBuy` | Boolean | 買進為 true |
| `isDividend` | Boolean | 股利記錄為 true |
| `shares` | Number | 股數（股利為持有股數） |
| `price` | Number | 均價（股利為每股股利） |
| `amount` | Number | 成交金額（股利為稅前金額） |
| `totalFee` | Number | 手續費合計（股利為稅款） |
| `net` | Number | 淨收付（股利為稅後淨額） |

---

## 2. 標的與顏色

| 代碼 | 中文名 | 顏色 |
|------|--------|------|
| AAPL | 蘋果 | `#a8dadc` |
| AMD | 超微半導體 | `#e63946` |
| BNDW | 全球債券ETF | `#457b9d` |
| EWJ | 日本ETF | `#f4a261` |
| TLT | 長期美債ETF | `#2a9d8f` |
| LLY | 禮來 | `#ab47bc` |

---

## 3. API 端點

| 項目 | 值 |
|------|-----|
| URL | `https://report-theta-nine.vercel.app/api/usa-stock` |
| 實作檔 | `usa_stock_api.js` |
| 方法 | `GET` |
| 回傳 | `{ ok, count, data[] }` |
| 排序 | `dateObj ASC` |
| CORS | 全域允許 |

`vercel.json` 已加入 build + route：
```json
{ "src": "usa_stock_api.js", "use": "@vercel/node" }
{ "src": "/api/usa-stock", "dest": "usa_stock_api.js" }
```

---

## 4. 報表頁面結構

報表為純靜態 HTML，開啟時從 Vercel API 動態讀取資料，所有運算在瀏覽器端完成。

### 頁面區塊順序

| 順序 | 區塊 | 說明 |
|------|------|------|
| 1 | 📈 投資總覽 | 7 張統計卡 |
| 2 | 🗂️ 各標的分析 | 每支標的一張損益卡 |
| 3 | 📋 完整交易明細 | 篩選器 + 全明細表（含股利） |
| 4 | 📊 圖表分析 | 配置餅圖、年度柱狀、月度趨勢 |
| 5 | 📅 年度彙總 | 各年度買賣金額彙總表 |

---

### 4.1 投資總覽（Stats Cards）

| 卡片標題 | 數值來源 |
|----------|---------|
| 總買入金額 | `buys.reduce(amount)` |
| 總賣出金額 | `sells.reduce(amount)` |
| 已實現損益 | `(sellAmt-sellFee) - totalCost * sellRatio` |
| 💰 股利淨收入 | `divDocs.reduce(net)`；sub 顯示稅前/稅款 |
| 交易筆數 | `trades.length`；sub：`N 買 / N 賣 ｜ 股利 N 筆` |
| 投資年數 | 年份 range |
| 標的數 | 交易標的代碼列表 |

---

### 4.2 各標的分析（Stock Cards）

每支標的一張卡（依 AAPL / AMD / BNDW / EWJ / TLT / LLY 排序）：

| 格子 | 說明 |
|------|------|
| 總買入 | 金額 + 股數 + 筆數 |
| 均攤成本 | `totalCost / buyShares`（含手續費） |
| 已賣出 | 金額 + 股數（無則 `—`） |
| 已實現損益 | 扣費後 P&L |
| sc-footer | 持有股數；若有股利則加 `💰 股利淨收 + $N` |

---

### 4.3 完整交易明細（Detail Table）

**篩選器列**：
- ⏱ 時間：年份 select + 月份 select
- 📌 標的：Chips（全部 / AAPL / AMD / BNDW / EWJ / TLT / LLY）
- 🔄 類型：Chips（全部 / 買進 / 賣出 / 💰 股利）
- ✕ 清除 按鈕

**`applyFilters()` 邏輯**：
```javascript
if(_fAction==='buy')  f = f.filter(d => d.isBuy);
if(_fAction==='sell') f = f.filter(d => !d.isBuy && !d.isDividend);
if(_fAction==='div')  f = f.filter(d => d.isDividend);
```

**`renderDetailTbody()` 差異**：
- `isDividend === true`：金黃背景列，顯示持有股數/每股股利/稅前/稅款/淨額
- 一般交易列：買進紅、賣出綠，顯示股數/均價/金額/手續費/淨收付

---

### 4.4 圖表分析（Charts）

| 圖表 | 類型 | 資料 |
|------|------|------|
| 各標的投入比重 | Doughnut | 各標的 `buyAmt` |
| 各年度買賣金額 | Grouped Bar | `yearMap` 買入/賣出（僅交易，不含股利） |
| 每月買入趨勢 | Bar | 最近 24 個月 `monthMap` |

> Chart.js v3 + chartjs-plugin-datalabels@2.0.0（CDN）

---

### 4.5 年度彙總（Year Table）

依年份彙總交易（不含股利）：買入筆數/金額、賣出筆數/金額、手續費、淨流出。

---

## 5. 技術規格

| 項目 | 值 |
|------|-----|
| Runtime（產出） | Node.js v16+ |
| 套件 | `xlsx`（SheetJS）、`mongodb` |
| 前端 Chart | Chart.js CDN v3 + chartjs-plugin-datalabels |
| 主題 | Dark Indigo（`--bg:#0f1117`、`--accent:#5c6bc0`） |
| 字型 | Outfit + Noto Sans TC（Google Fonts） |
| 資料讀取 | Vercel Serverless API，瀏覽器 fetch |

---

## 6. 執行方式

```bash
cd "D:\2025\AI\MongoDB"
node generate_aiinvest_report.js
```

執行後：
1. 清除 `USA_Stock` collection 舊資料
2. 插入 445 筆（205 交易 + 240 股利）
3. 建立索引
4. 產出 `AI_Invest_Report.html`

---

## 7. 同步規範（CLAUDE.md）

- **HTML 與 generator 必須保持同步**：直接修改 HTML 後，必須同步更新 `generate_aiinvest_report.js` 的 `generateHtml()` 模板，否則下次執行 generator 會覆蓋手動修改
- 兩檔案任何改動後執行 `git add ... && git commit && git push`

---

## 8. 部署流程

```bash
git add AI_Invest_Report.html generate_aiinvest_report.js
git commit -m "Update AI invest report: ..."
git push origin main
```

GitHub Pages 部署後約 1–2 分鐘生效：  
https://lard23chen.github.io/report/AI_Invest_Report.html
