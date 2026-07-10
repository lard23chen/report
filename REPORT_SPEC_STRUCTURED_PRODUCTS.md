# 結構型商品追蹤系統規範 (Structured Products Tracking System)
## 視覺規範 (Visual Specifications)

### 1. 核心配色與風格 (Theme & Style)
*   **視覺風格**：延續 `Stock_Portfolio.html` 的卡片式版面，總覽卡片 + 圖表 + 追蹤表格 + 歷史紀錄。
*   **狀態燈號配色 (CSS Variables)**：
    *   `--safe`: `#22c55e` (Green) - 安全。
    *   `--warn`: `#e0a72e` (Amber) - 警戒。
    *   `--danger`: `#d64545` (Red) - 高風險。
    *   `--accent`: `#38bdf8` (Sky Blue) - 連結與強調。

### 2. 佈局組件 (Layout Components)
*   **總覽卡片區**：總投入本金、累計已領票息、已下庄總額、年化報酬率。
*   **檔數統計列**：進行中 / 觀察中 / 已 KO / 已到期，各自數量與佔比。
*   **圖表區**：資產配置比例（依標的/發行商/銀行）、近期觀察日時間軸。
*   **產品追蹤總覽表**：逐檔商品，含連結標的、距 KI/KO %、狀態燈號、下次觀察日、到期日。
*   **已出場歷史紀錄表**：已 KO / 已到期商品，含出場日期、原因、損益。

---

## 功能組件 (Functional Components)

### 1. 資料模型 (MongoDB Collections)

#### `Structured_Products`（商品主檔，一檔商品一筆文件）
```json
{
  "_id": "ObjectId",
  "productType": "RCN",
  "isin": "XS3302311140",
  "issuer": "BNP",
  "custodianBank": "UBS",
  "currency": "USD",
  "principalAmount": 200000,
  "couponRate": 9.98,
  "issueDate": "2026-01-11",
  "maturityDate": "2030-06-23",
  "status": "進行中",
  "underlyings": [
    { "ticker": "NVDA", "strikePrice": 129.4357, "koBarrierPct": 65, "kiBarrierPct": null, "lastPrice": null, "lastPriceDate": null },
    { "ticker": "TSMC", "strikePrice": 284.535,  "koBarrierPct": 55, "kiBarrierPct": null, "lastPrice": null, "lastPriceDate": null }
  ],
  "conditions": [
    { "type": "credit", "description": "TSMC credit", "threshold": null }
  ],
  "fixings": [
    { "date": "2026-11-16", "isFinal": false, "result": null }
  ],
  "person": "alex",
  "note": ""
}
```
*   `underlyings`：內嵌陣列，支援 worst-of 多標的一籃子結構。
*   `strikePrice`：申購時的基準價，用於計算目前價格相對障礙價的百分比。
*   `koBarrierPct` / `kiBarrierPct`：以**百分比**儲存（非絕對股價）。

#### `Structured_Products_Events`（事件/現金流紀錄，一筆事件一筆文件）
```json
{
  "_id": "ObjectId",
  "productId": "ref -> Structured_Products._id",
  "date": "2026/07/11",
  "type": "配息",
  "amount": 1663,
  "note": ""
}
```
*   `type`：申購 / 配息 / 提前贖回KO / 到期贖回。

### 2. 風險評分邏輯 (Risk Scoring)

> **重要**：風險主要來自 **KI（下方保護障礙）**，並非 KO。KO（提前贖回）對投資人是正向事件，僅作為「即將提前出場」提示，不計入風險分數。

```js
// 每個 underlying：
currentPct = currentPrice / strikePrice * 100;
distToKI   = currentPct - kiBarrierPct;   // 越小越危險，<=0 代表已跌破
distToKO   = currentPct - koBarrierPct;   // 僅供出場提示

// worst-of：取所有標的中 distToKI 最小者代表該商品風險

proximityScore = clamp((30 - distToKI) / 30 * 100, 0, 100);
daysScore      = clamp((60 - daysToNextFixing) / 60 * 100, 0, 100);
volScore       = clamp((annualizedVol20d - 20) / 40 * 100, 0, 100);
breachedScore  = everClosedBelowKI ? 100 : 0;

riskScore = 0.40*proximityScore + 0.20*daysScore + 0.25*volScore + 0.15*breachedScore;

status = riskScore < 30 ? "安全" : riskScore <= 60 ? "警戒" : "高風險";
```
*   `annualizedVol20d`：近 20 個交易日日報酬標準差 × √252 × 100
*   `everClosedBelowKI`：歷史股價是否曾收盤跌破 KI（MVP 假設美式障礙）

**提前出場提示（獨立於風險分數）**
```js
if (distToKO <= 0 && daysToNextFixing <= 30) {
  hint = "可能於下次觀察日提前贖回(KO)";
}
```

### 3. 進階篩選與統計
*   多重過濾器：狀態（進行中/觀察中/已KO/已到期）、銀行、發行商、標的代號。
*   總覽卡片與表格底部小計同步更新篩選結果。

### 4. 管理員編輯模式 (CRUD Operations)
*   比照 `Stock_Portfolio.html`：進入編輯需輸入管理密碼。
*   支援商品與事件紀錄的新增、修改、刪除。

---

## 技術架構與部署 (Technical Stack & Deployment)

### 1. 部署環境
*   **前端展示**：GitHub Pages（`Structured_Products.html`）。
*   **後端 API**：Vercel Serverless Functions（`structured_products_api.js`）。
*   **即時股價**：沿用 Yahoo Finance chart API（`/v8/finance/chart/SYMBOL`），比照 `stock_api.js` 邏輯。

### 2. 資料庫與持久化
*   **主要存儲**：MongoDB Atlas（沿用同一 cluster，新增 database/collection：`Structured_Products`、`Structured_Products_Events`）。
*   ⚠️ 連線字串一律讀取 Vercel 環境變數，不寫死在程式碼或文件中（詳見帳密外洩修復追蹤）。

### 3. API 端點 (Endpoints)

| 功能 | 方法 | 端點 | 說明 |
| :--- | :--- | :--- | :--- |
| 取得所有商品 | GET | `/api/structured-products` | 支援 `?status=` 篩選 |
| 新增商品 | POST | `/api/structured-products/add` | 新增商品主檔 |
| 修改商品 | POST | `/api/structured-products/update` | 依 `_id` 修改 |
| 刪除商品 | POST | `/api/structured-products/delete` | 依 `_id` 刪除 |
| 取得即時風險狀態 | GET | `/api/structured-products/risk` | 抓即時股價並計算距KI/KO%、風險分數、燈號 |
| 取得事件紀錄 | GET | `/api/structured-products/events?productId=` | 依商品查詢現金流/事件 |
| 新增事件 | POST | `/api/structured-products/events/add` | 新增配息/KO/到期紀錄 |
| 刪除事件 | POST | `/api/structured-products/events/delete` | 刪除事件 |

---

## 待確認 / 未來階段
*   PDF 對帳單（UBS/HSBC/玉山/星展）自動解析匯入。
*   贖回通知 email 自動歸檔為 `Structured_Products_Events`。
*   多幣別（USD/JPY/TWD）換算報表幣別。
*   European vs American 障礙判定邏輯（目前 MVP 假設美式）。
