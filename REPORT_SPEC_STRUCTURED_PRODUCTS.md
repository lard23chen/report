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
  "isin": "XS3402098852",
  "issuer": "BARC",
  "custodianBank": "UBS",
  "currency": "USD",
  "principalAmount": 200000,
  "couponRate": 9.98,
  "issueDate": "2026-06-24",
  "maturityDate": null,
  "status": "進行中",
  "underlyings": [
    { "ticker": "NVDA", "strikePrice": 129.4357, "koBarrierPct": 65, "kiBarrierPct": 84.63, "lastPrice": null, "lastPriceDate": null },
    { "ticker": "TSM",  "strikePrice": 284.535,  "koBarrierPct": 55, "kiBarrierPct": 84.63, "lastPrice": null, "lastPriceDate": null }
  ],
  "conditions": [],
  "fixings": [
    { "date": "2027-01-11", "isFinal": false, "result": null }
  ],
  "person": "alex",
  "note": ""
}
```
*   `productType`：`RCN` / `DCN` / `FCN` / `CDRAN`（信用/利率連結型）/ `SN`（一般結構型票券，用於標的細節不明的商品）。
*   `underlyings`：內嵌陣列，支援 worst-of 多標的一籃子結構。**可為空陣列 `[]`**——用於 CDRAN（無股權標的，靠 `conditions` 描述觸發條件）或標的細節尚未取得的 SN/FCN（見下方「資料完整度」說明）。
*   `strikePrice`：申購時的基準價，用於計算目前價格相對障礙價的百分比。
*   `koBarrierPct` / `kiBarrierPct`：以**百分比**儲存（非絕對股價）。
*   `conditions`：CDRAN 等非股權連結商品的觸發條件陣列，例如：
    ```json
    "conditions": [
      { "type": "rate", "description": "10yr CMS < 4.70%", "threshold": 4.70 },
      { "type": "credit", "description": "Bank of America credit event", "threshold": null },
      { "type": "fx", "description": "USD/TWD > 27.3", "threshold": 27.3 }
    ]
    ```
*   `maturityDate`：**僅在真正到期日已知時才填寫**（例如已到期/已KO的歷史紀錄，或原始申購確認書有明載）。多數銀行對帳單只印「下次觀察/贖回日」，不可誤當成到期日——這種情況請把日期放進 `fixings[]`，`maturityDate` 留 `null`。

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

**無股權標的商品（`underlyings` 為空陣列）**

CDRAN（信用/利率連結）以及標的細節尚未取得的 SN/FCN，不套用上述股權 KI/KO 模型，`/risk` 端點直接回傳：
```js
{ riskScore: null, status: "不適用", hint: null, worstUnderlying: null, underlyings: [], conditions: [...] }
```
前端以灰色「不適用」標籤顯示，避免誤判為「安全」。

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

## 資料完整度現況 (Data Completeness)

截至 2026-07-10，資料庫共 27 檔商品，分三個完整度層級：

| 完整度 | 帳戶來源 | 檔數 | 說明 |
| :--- | :--- | :--- | :--- |
| 完整（有 strike/KI/KO，可算風險分數） | UBS/CAKE | 8 檔進行中 RCN/DCN | 依理專手寫表格核對，可正常顯示安全/警戒/高風險 |
| 僅條件式（無股權標的） | UBS/CAKE | 3 檔 CDRAN | 用 `conditions` 記錄信用/利率/匯率觸發條件，風險狀態「不適用」 |
| 僅基本資料（金額/到期日/發行商） | HSBC 7 檔、玉山 3 檔 FCN、星展 3 檔 SN | 13 檔 | `underlyings`/`conditions` 皆為空，`note` 欄位記錄資料來源與缺漏項目，待原始申購確認書補齊標的/strike/障礙價後可升級為完整資料 |
| 歷史（已出場） | UBS/CAKE | 3 檔已到期/已KO | 由贖回通知信匯入，`underlyings` 僅有標的代號無 strike（風險計算不適用於已出場商品） |

## FCN 獨立分析頁（2026/07/16 新增）

*   **檔案**：`FCN_Analysis.html`（GitHub Pages），總覽頁 header 有「📈 FCN 獨立分析」按鈕互連。
*   **性質**：純前端骨架頁，即時 fetch 本系統 API（products 過濾 `productType === 'FCN'` + 逐檔 events），**無 generator、無排程**；資料庫補資料後頁面自動變豐富。
*   **區塊**：①統計卡（檔數/分幣別投入面額/最近到期/已收配息）②存續期間與到期時間軸（HTML/CSS 橫條 + 今日標線 + 季刻度，hover tooltip）③商品明細表（票息/標的缺漏顯示「待補」徽章）④配息現金流（有事件時列現金流表並可計年化配息率；無事件顯示補登指引）⑤資料完整度缺口清單（逐檔列缺票息率/標的/障礙價/配息事件，補齊自動消失）。
*   **背景**：建立當下 FCN 僅 3 檔（皆玉山證券，NATIXIS/SG/MS），只有申購日/面額/到期日——經確認採「先建骨架頁」策略，待原始申購確認書補齊後升級為完整收益率/風險分析。

## 待確認 / 未來階段
*   HSBC/玉山/星展 13 檔補齊標的名稱、strike price、KI/KO 障礙價（需原始申購確認書，目前對帳單不含此資訊）。
*   PDF 對帳單（UBS/HSBC/玉山/星展）自動解析匯入。
*   贖回通知 email 自動歸檔為 `Structured_Products_Events`。
*   多幣別（USD/JPY/TWD）換算報表幣別。
*   European vs American 障礙判定邏輯（目前 MVP 假設美式）。
*   CDRAN 的信用/利率/匯率條件目前僅存文字描述，尚未接上即時 10yr CMS 利率或信用事件資料源做自動風險評分。
