# A系統購票流量轉換報表 技術規範說明

本文件定義「A系統購票流量轉換報表（2026年6月）」的產出標準，未來更新或重新產出時請遵循本規範。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `D_GA_Funnel_202606_Report.html` |
| 產生腳本 | `generate_d_ga_funnel_report.js` |
| 資料來源 | MongoDB `QwareAi`（for-aws-loadtest cluster）+ `trek-first-party-dmp`（qware-dmp-ver-7 cluster） |
| 瀏覽量資料期間 | 2026/06/10 起持續累計（每日排程自動更新，頁首日期區間隨資料延伸） |
| 點擊量資料期間 | 2026/05/27 起持續累計（每日排程自動更新，頁首日期區間隨資料延伸） |
| DMP 資料期間 | 2025/12/30 起持續累計 |
| 負責人 | 陳俊良 |
| 主要目的 | 分析同一活動在「節目介紹頁瀏覽（PV）→ 場次購票點擊（Click）→ 加入購物車（Cart）→ 結帳（Purchase）」四個消費者行為層的差異 |

## 2. 核心概念

### 消費者旅程

```
消費者看到活動資訊
    ↓
瀏覽節目介紹頁（GA_D_PageViewData 記錄 page_view 事件）
    ↓
點擊場次選購票券（GA_D_ClickData 記錄 click 事件）
    ↓
加入購物車（DMP event：bu="A", name="add_to_cart"）
    ↓
完成結帳（DMP event：bu="A", name="purchase"）
```

### 時間差注意事項

兩份 D 系統資料**涵蓋不同時段**，CTR 可能超過 100%。這並非錯誤，反映開賣旺盛期與持續瀏覽期的時間差。本報表以 **ActivityId** 為連結鍵，分析同一活動在各行為層的**相對關聯性**。

## 3. 資料結構

### 3.1 FUNNEL_DATA 陣列格式（generator 注入）

```js
{
  id:         "39428",          // ActivityId
  name:       "中華職棒37年...",  // 活動名稱（優先使用 PV 名稱）
  cat:        "sports",         // 類別（來自 CAT_MAP）
  pv:         76765,            // 總瀏覽量（null = 無 PV 資料）
  pvRank:     2,                // PV 排名（null = 無 PV 資料）
  clicks:     156203,           // 總點擊量（null = 無點擊資料）
  clickRank:  1,                // 點擊排名（null = 無點擊資料）
  ctr:        203.5,            // 點擊/瀏覽比 = clicks/pv*100（null = 未匹配）
  pvShare:    14.9,             // PV 占總 PV 百分比
  clickShare: 19.3,             // 點擊占總點擊百分比
  loggedIn:   76712,            // 已登入點擊數
  notIn:      79491,            // 未登入點擊數
  perf:       279,              // 場次數
}
```

### 3.2 SUMMARY 物件格式（generator 注入）

```js
{
  pvTotal:       2022310,
  clickTotal:    1599678,
  matchedCount:  39,            // 兩份資料皆有的活動數
  pvOnlyCount:   9,
  clickOnlyCount:9,
  matchedPV:     1999954,
  matchedClicks: 1524846,
  pvDates:       "2026/06/18 – 2026/06/23",  // generator 計算的區間字串
  clickDates:    "2026/05/26 – 06/06",
}
```

### 3.3 靜態資料（Charts 區塊，不被主 generator 覆蓋）

| 常數 | 說明 | 結構 |
|------|------|------|
| `CART_DATA` | A購物車次數（全期間總計），keyed by ActivityId | `{"39428": 301453, ...}` |
| `PURCHASE_DATA` | A結帳次數（全期間總計），keyed by ActivityId | `{"39428": 153363, ...}` |
| `CART_BY_DATE` | 每日 A購物車，keyed by ActivityId → date（2026-07 起新增，供日期篩選用） | `{"39428": {"06/10": 500, ...}}` |
| `PURCHASE_BY_DATE` | 每日 A結帳，keyed by ActivityId → date（2026-07 起新增，供日期篩選用） | `{"39428": {"06/10": 200, ...}}` |
| `PV_BY_DATE` | 每日 PV，keyed by ActivityId → date（2026-07-06 起由主 generator 自動產生） | `{"39428": {"06/10": 500, ...}}` |
| `CLICK_ACT_DAILY` | 每日點擊，keyed by ActivityId（2026-07-06 起由主 generator 自動產生） | `{"39190": [{date:"05/28", total:1519}, ...]}` |

**CART_DATA / PURCHASE_DATA / CART_BY_DATE / PURCHASE_BY_DATE 資料來源（2026-07 起由 `generate_d_ga_funnel_cart_data.js` 自動產生，不再手動查詢貼上）：**
- MongoDB cluster：`qware-dmp-ver-7.f0fpg.mongodb.net`
- DB：`trek-first-party-dmp`，Collection：`event`
- 篩選條件：`bu:"A"`，`name:"add_to_cart"` / `name:"purchase"`
- join key：DMP 的 `attribution_id` ↔ Click collection（`GA_D_ClickData_Webb_202606`）的 `ProductId` → `ActivityId`
- 依 `time` 欄位（UTC）以 `+08:00` 時區換算為 `MM/DD` 做每日分桶（`$dateToString` timezone `+08:00`），加總欄位為 `quantity`（不可用文件數 `$sum:1`，因單筆 purchase 事件的 `quantity` 可能 >1，count 與 qty 加總會不一致）
- 由 `CART_BY_DATE` / `PURCHASE_BY_DATE` 加總即得 `CART_DATA` / `PURCHASE_DATA`，兩者保證一致

### 3.4 Section Markers（Generator 注入點）

```
// ── Data ──────────────────────────────────────────────────────────────────
const FUNNEL_DATA = [...];   ← generator 注入（generate_d_ga_funnel_report.js）
const SUMMARY = {...};       ← generator 注入（generate_d_ga_funnel_report.js）
// ── Charts ─────────────────────────────────────────────────────────────────

// ── CartPurchase Data Start ──────────────────────────────────────────────
const CART_DATA = {...};          ← generator 注入（generate_d_ga_funnel_cart_data.js）
const PURCHASE_DATA = {...};      ← generator 注入
const CART_BY_DATE = {...};       ← generator 注入
const PURCHASE_BY_DATE = {...};   ← generator 注入
// ── CartPurchase Data End ────────────────────────────────────────────────

// ── DailyData Start ──────────────────────────────────────────────────────
const PV_BY_DATE = {...};         ← generator 注入（generate_d_ga_funnel_report.js，2026-07-06 起）
const CLICK_ACT_DAILY = {...};    ← generator 注入
// ── DailyData End ────────────────────────────────────────────────────────
```

另外兩個單行常數 `const PV_DATES = [...];` / `const CL_DATES = [...];`（Date Pickers 區）由 `generate_d_ga_funnel_report.js` 以整行 regex 替換更新，**勿改寫成多行或改名**。

⚠️ **勿修改 marker 字串**，否則 generator 找不到注入點。

### 3.5 日期篩選對 A購物車/A結帳 的影響（2026-07 新增）

`applyFunnel()` 套用 PV 日期篩選時，`computeFunnel()` 會一併依**相同的 PV 日期範圍**（非獨立範圍，見 §5.2）從 `CART_BY_DATE` / `PURCHASE_BY_DATE` 加總出當前範圍的 A購物車 / A結帳，並寫入每筆資料的 `cart` / `purchase` 欄位：

```js
r.cart     = CART_BY_DATE[d.id]     ? sumByDateRange(CART_BY_DATE[d.id], pvFrom, pvTo)     : (CART_DATA[d.id] ?? null);
r.purchase = PURCHASE_BY_DATE[d.id] ? sumByDateRange(PURCHASE_BY_DATE[d.id], pvFrom, pvTo) : (PURCHASE_DATA[d.id] ?? null);
```

- 若某活動沒有 `CART_BY_DATE` / `PURCHASE_BY_DATE` 資料（例如該活動在 A 系統無銷售），則退回使用全期間靜態總計 `CART_DATA` / `PURCHASE_DATA`。
- 表格（`renderTable`）、排序（`getExtra`）、泡泡圖大小（`bubbleR`）與 tooltip 皆改由 `getCart(d)` / `getPurchase(d)` 輔助函式讀值，而非直接讀取 `CART_DATA[d.id]`：
  ```js
  function getCart(d){ return d.cart !== undefined ? d.cart : (CART_DATA[d.id] ?? null); }
  function getPurchase(d){ return d.purchase !== undefined ? d.purchase : (PURCHASE_DATA[d.id] ?? null); }
  ```
  這讓「未篩選（`resetFunnel`，`liveFunnelData=null`）」與「已篩選（`liveFunnelData` 來自 `computeFunnel`）」兩種狀態都能取得正確數字，不需在每個讀取點各自判斷。

## 4. 活動類別（CAT_MAP）

| 類別 key | 標籤 | 顏色 |
|----------|------|------|
| `sports`  | 運動 | 藍 #3b82f6 |
| `concert` | 演唱會 | 紫 #8b5cf6 |
| `kpop`    | K-pop | 玫紅 #f43f5e |
| `anime`   | 動漫/遊戲 | 綠 #10b981 |

## 5. 關鍵組件

### 5.1 Header Tags（動態填入）

三個 tag 在頁面載入後由 JS 從實際資料動態填入，不再硬編碼：

```js
// 來源：PV_DATES[0]/最後一個、CL_DATES[0]/最後一個、SUMMARY.matchedCount
el('hdr-pv-dates').textContent = `📄 瀏覽量資料：${pvFirst} – ${pvLast}`;
el('hdr-cl-dates').textContent = `🖱 點擊量資料：${clFirst} – ${clLast}`;
el('hdr-matched').textContent  = `共同活動 ${SUMMARY.matchedCount} 個`;
```

### 5.2 日期區間篩選（Date Range Filter）

僅顯示 PV 日期篩選器（Click 篩選器為隱藏 input，保留 JS 相容性）。

| 篩選器 | 元件 | enable 白名單 | 說明 |
|--------|------|--------------|------|
| PV 起始日 | `#pvFrom` flatpickr | `pvFromAvail` = PV_DATES 內 ≤ 昨天的日期 | 只能選有實際資料的日期 |
| PV 結束日 | `#pvTo` flatpickr | `pvToAvail` = 從第一個 PV 日到昨天的連續序列 | 無資料日期套用時貢獻 0 |

**日期序列計算（local time，與 mkDateObjs 一致）：**
```js
const _yd = new Date(); _yd.setDate(_yd.getDate()-1); _yd.setHours(0,0,0,0);
const pvFromAvail = pvAvail.filter(d => d <= _yd);
const pvToAvail = [];
for(const d = new Date(pvAvail[0]); d <= _yd; d.setDate(d.getDate()+1))
  pvToAvail.push(new Date(d));
```

⚠️ `PV_DATES` / `CL_DATES` 必須在 Header tags IIFE **之前**定義，否則 `const` 不會 hoist，IIFE 執行時會 throw `ReferenceError`，導致後續 flatpickr 無法初始化。

套用篩選後呼叫 `applyFunnel()`，重新計算各活動 pv/clicks/ctr/pvRank/clickRank/**cart/purchase**，並同步更新泡泡圖與表格。

**快速區間按鈕（2026/07/17 新增）**：filter-actions 內「套用篩選」左側有「1天前」「7天前」兩顆 ghost 按鈕，呼叫 `setQuickRange(days)`（定義於 Date Pickers 區塊末端）：

- 錨點 = `pvFromAvail` 最後一個元素（**最後一個有資料的日子**，非日曆昨天——每日排程有時差，資料截止日可能落後，錨定資料端才不會選到空日）
- 「1天前」：from = to = 錨點（最近一天資料）；「7天前」：from = 錨點往前 6 天（不足時 clamp 到第一個有資料日），to = 錨點
- 設完日期直接呼叫 `applyFunnel()` 套用，不需再按「套用篩選」

**2026/07/14 起：PV 日期區間是四層唯一的時間窗**——`applyFunnel()` 以 `computeFunnel(pvF, pvT, pvF, pvT)` 呼叫，點擊層與 A購物車/A結帳（§3.5）都採用 PV 選定的同一組日期區間。修正前點擊層用隱藏 Click 選擇器的固定預設 `05/27–06/20`：不隨 PV 連動，且上限 06/20 是舊資料時代殘留，套用篩選後點擊數會被截斷。隱藏的 `#clFrom`/`#clTo` flatpickr 與 `resetFunnel()` 內的重設邏輯保留（JS 相容性），但已不影響計算。

### 5.3 泡泡圖（Bubble Chart）

- **Chart.js `type:'bubble'`**
- **X 軸**：瀏覽量（對數，min 500 – max 200,000）
- **Y 軸**：點擊量（對數，min 200 – max 300,000）
- **泡泡大小（r）**：A購物車數量（隨 PV 日期篩選變動，見 §3.5），公式：`bubbleR(cart) = Math.max(5, Math.sqrt(cart/310000)*30+5)`（`bubbleR` 直接接收已解析的 cart 數值，不再自行查表）
- **顏色**：依類別（CAT_COLOR）
- **參考線**：y=x 虛線（點擊/瀏覽比=100%）
- **Tooltip**：活動名稱、PV、點擊量、點擊/瀏覽比、A購物車、A結帳（皆讀取資料點上已附帶的 `cart`/`purchase` 欄位，非即時查 `CART_DATA`）
- **Legend**：類別顏色 + 「泡泡大小 = A購物車數量」說明
- **篩選同步**：套用日期篩選後呼叫 `updateScatter(filteredData)` 更新，每個泡泡的 `cart`/`purchase` 由 `getCart(d)`/`getPurchase(d)` 解析

### 5.4 完整活動對照表

顯示 PV 前 45 名活動，欄位由左到右：

| 欄位 | 說明 |
|------|------|
| PV排名 | pvRank |
| 點擊排名 | clickRank |
| 活動名稱 | 可點擊連結至 `ticket.ibon.com.tw/ActivityInfo/Details/{id}`，下方顯示 ActivityId |
| D瀏覽量 | 數字右對齊；下方小字顯示**PV資料起始日**（`PV_BY_DATE` 最早 key） |
| D點擊量 | 數字右對齊；下方小字顯示**點擊資料起始日**（`CLICK_ACT_DAILY` 最早 date） |
| A購物車 | 來自 `getCart(d)`（隨 PV 日期篩選變動，見 §3.5），數字右對齊 |
| A結帳 | 來自 `getPurchase(d)`（隨 PV 日期篩選變動，見 §3.5），數字右對齊 |
| 點擊/瀏覽比 | 顏色：綠≥100%、橘≥50%、紅<50%；含比例條 |
| 購物車/點擊量比 | cart/clicks×100%（`getCart(d)`/`d.clicks`，皆隨 PV 日期篩選變動）；可 >100%（同 ctr，比例條 `Math.min` 封頂 100%）；顏色：綠≥50%、橘≥30%、紅<30%；含比例條。排序 key = `cartClickRate` |
| 結帳/點擊量比 | purchase/clicks×100%（`getPurchase(d)`/`d.clicks`，皆隨 PV 日期篩選變動）；顏色：綠≥50%、橘≥30%、紅<30%；含比例條。排序 key = `purClickRate` |
| 結帳/購物車比 | purchase/cart×100%；顏色：綠≥50%、橘≥30%、紅<30%；含比例條 |

**關鍵字搜尋**：`#nameSearch` input，即時過濾活動名稱（含泡泡圖同步）。

**排序**：點擊欄位 header 切換升/降序，`getExtra()` 函式處理 cart/purchase/cartRate/**purClickRate/cartClickRate** 的取值邏輯。

### 5.5 已移除組件

下列組件已從報表移除（對應 JS 保留空函式 stub 避免錯誤）：

| 移除組件 | stub 函式 |
|----------|-----------|
| KPI 卡片（6 張） | — |
| 漏斗視覺列 | — |
| 點擊/瀏覽比橫條圖（ctrChart） | `function updateCtr(){}` |
| 類別占比對比圖（catChart） | `function updateCat(){}` |

## 6. MongoDB 連線資訊

| 用途 | Cluster URI | DB | Collection |
|------|-------------|-------|------------|
| PV / Click 資料 | `for-aws-loadtest.f0fpg.mongodb.net` | `QwareAi` | `GA_D_PageViewData_Webb_202606`、`GA_D_ClickData_Webb_202606` |
| DMP 購物車/結帳 | `qware-dmp-ver-7.f0fpg.mongodb.net` | `trek-first-party-dmp` | `event` |

## 7. 更新方式

```bash
node generate_d_ga_funnel_report.js       # 更新 FUNNEL_DATA / SUMMARY / PV_BY_DATE / CLICK_ACT_DAILY / PV_DATES / CL_DATES
node generate_d_ga_funnel_cart_data.js    # 更新 CART_DATA / PURCHASE_DATA / CART_BY_DATE / PURCHASE_BY_DATE（DMP 購物車/結帳，含每日分桶）
git add D_GA_Funnel_202606_Report.html generate_d_ga_funnel_report.js generate_d_ga_funnel_cart_data.js
git commit -m "Update funnel report"
git push origin main
```

⚠️ 兩支 generator 各自用獨立 marker 區塊（`// ── Data ──` / `// ── Charts ──`、`// ── DailyData Start/End ──` 和 `// ── CartPurchase Data Start/End ──`），互不影響，可分開執行。

**2026/07/20 新增**：`<head>` 加入 IP 白名單保護（同目錄頁 `HTML_Report_Catalog.html` 機制，`api.ipify.org` 查訪客 IP 比對 9 組授權 IP，不符即整頁換成「存取被拒絕」）。此前本報表沒有此保護，任何人有連結即可看到完整轉換漏斗資料。清單為手動維護的靜態內容，`generate_d_ga_funnel_report.js` 與 `generate_d_ga_funnel_cart_data.js` 都只用 regex 替換資料常數、不會動到 `<head>`，之後改版任一檔案時務必保留此段。

**2026-07-06 起每日資料全自動**：`PV_BY_DATE` / `CLICK_ACT_DAILY` / `PV_DATES` / `CL_DATES` 已改由 `generate_d_ga_funnel_report.js` 每次執行時從 MongoDB 重新聚合（`$group` by ActivityId + EventDate，EventDate UTC +08:00 換算為 `MM/DD`），頁首日期區間、日期篩選器白名單與每日明細因此跟隨 `daily_update.bat` 每日更新，不再手動維護。

**2026-07-14 起 A購物車/結帳也入排程**：`generate_d_ga_funnel_cart_data.js` 已加入 `daily_update.bat`（緊接主 generator 之後，執行約 95 秒）。先前它不在排程內、上次手動執行停在 07/02 資料，造成日期篩選選 7/3 以後時 A結帳/A購物車兩層無資料（PV/Click 每日更新、Cart/Purchase 停更的落差）；入排程後四層資料同步每日更新。

## 8. 相關連結

- 目錄：`HTML_Report_Catalog.html`
- 瀏覽量報表：`D_GA_PageViewData_Webb_202606_Report.html`
- 點擊量報表：`D_GA_ClickData_Webb_202606_Report.html`
- 規範：`REPORT_SPEC_D_GA_PAGEVIEWDATA_202606.md` / `REPORT_SPEC_D_GA_CLICKDATA_202606.md`
- E 版對照報表：`E_DMP_Funnel_Report.html`（規範：`REPORT_SPEC_E_DMP_FUNNEL.md`）
- **頁首互連（2026/07/09 新增）**：header `hdr-tags` 最後有一顆藍色連結標籤「🔗 E系統購票流量轉換 →」（相對路徑連到 `E_DMP_Funnel_Report.html`），對方頁面也有反向連結回本報表。此連結直接寫在 HTML（generator 為 marker 注入式、不會覆蓋），重建頁面模板時需保留。

---
*2026/07/20：`<head>` 補上 IP 白名單保護，之前任何人有連結都能看，見 §7*
*建立日期：2026/06/22｜最後更新：2026/07/17（PV 日期區間新增「1天前」「7天前」快速按鈕，錨定最後有資料日並自動套用篩選，見 §5.2）*
*2026/07/14：generate_d_ga_funnel_cart_data.js 加入每日排程，A購物車/結帳每日資料不再停更；點擊層改用 PV 日期區間，四層同一時間窗，見 §5.2*
*2026/07/06：PV_BY_DATE / CLICK_ACT_DAILY / PV_DATES / CL_DATES 改由主 generator 自動產生，新增 DailyData marker 區塊；頁首日期區間與日期篩選器隨每日排程自動更新，修正先前總量已含新資料但頁首仍顯示 06/28 的不一致*
*2026/07/02：新增 CART_BY_DATE/PURCHASE_BY_DATE，A購物車/A結帳 改為隨 PV 日期篩選連動；新增 generate_d_ga_funnel_cart_data.js 自動化 DMP 查詢，取代原手動更新流程*
*2026/07/01：移除 header subtitle、排名變化欄位；修正日期選擇器 ReferenceError；pvTo 擴展至昨天*
*2026/07/03：完整活動對照表於 A結帳 右側新增「結帳/點擊量比」欄（purchase/clicks×100%，排序 key purClickRate，隨 PV 日期篩選連動）*
*2026/07/03：再於 A結帳 右側、結帳/點擊量比 左側新增「購物車/點擊量比」欄（cart/clicks×100%，排序 key cartClickRate，隨 PV 日期篩選連動）。欄位順序：A結帳 ｜ 購物車/點擊量比 ｜ 結帳/點擊量比 ｜ 結帳/購物車比*
*2026/07/03：調整欄序，A購物車/A結帳 移至 D點擊量 右側（點擊/瀏覽比 之前）。完整欄序：PV排名 ｜ 點擊排名 ｜ 活動名稱 ｜ D瀏覽量 ｜ D點擊量 ｜ A購物車 ｜ A結帳 ｜ 點擊/瀏覽比 ｜ 購物車/點擊量比 ｜ 結帳/點擊量比 ｜ 結帳/購物車比*
