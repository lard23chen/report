# A系統購票流量轉換報表 技術規範說明

本文件定義「A系統購票流量轉換報表（2026年6月）」的產出標準，未來更新或重新產出時請遵循本規範。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `D_GA_Funnel_202606_Report.html` |
| 產生腳本 | `generate_d_ga_funnel_report.js` |
| 資料來源 | MongoDB `QwareAi`（for-aws-loadtest cluster）+ `trek-first-party-dmp`（qware-dmp-ver-7 cluster） |
| 瀏覽量資料期間 | 2026/06/10 – 06/28（持續更新） |
| 點擊量資料期間 | 2026/05/27 – 06/28（持續更新） |
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

### 3.3 靜態資料（Charts 區塊，不被 generator 覆蓋）

| 常數 | 說明 | 結構 |
|------|------|------|
| `CART_DATA` | A購物車次數，keyed by ActivityId | `{"39428": 301453, ...}` |
| `PURCHASE_DATA` | A結帳次數，keyed by ActivityId | `{"39428": 153363, ...}` |
| `PV_BY_DATE` | 每日 PV，keyed by ActivityId → date | `{"39428": {"06/10": 500, ...}}` |
| `CLICK_ACT_DAILY` | 每日點擊，keyed by ActivityId | `{"39190": [{date:"05/28", total:1519}, ...]}` |

**CART_DATA / PURCHASE_DATA 資料來源：**
- MongoDB cluster：`qware-dmp-ver-7.f0fpg.mongodb.net`
- DB：`trek-first-party-dmp`，Collection：`event`
- 篩選條件：`bu:"A"`，`name:"add_to_cart"` / `name:"purchase"`
- join key：DMP 的 `attribution_id` ↔ Click collection 的 `ProductId`

### 3.4 Section Markers（Generator 注入點）

```
// ── Data ──────────────────────────────────────────────────────────────────
const FUNNEL_DATA = [...];   ← generator 注入
const SUMMARY = {...};       ← generator 注入
// ── Charts ─────────────────────────────────────────────────────────────────
```

⚠️ **勿修改 marker 字串**，否則 generator 找不到注入點。

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

套用篩選後呼叫 `applyFunnel()`，重新計算各活動 pv/clicks/ctr/pvRank/clickRank，並同步更新泡泡圖與表格。

### 5.3 泡泡圖（Bubble Chart）

- **Chart.js `type:'bubble'`**
- **X 軸**：瀏覽量（對數，min 500 – max 200,000）
- **Y 軸**：點擊量（對數，min 200 – max 300,000）
- **泡泡大小（r）**：A購物車數量，公式：`Math.max(5, Math.sqrt(cart/310000)*30+5)`
- **顏色**：依類別（CAT_COLOR）
- **參考線**：y=x 虛線（點擊/瀏覽比=100%）
- **Tooltip**：活動名稱、PV、點擊量、點擊/瀏覽比、A購物車、A結帳
- **Legend**：類別顏色 + 「泡泡大小 = A購物車數量」說明
- **篩選同步**：套用日期篩選後呼叫 `updateScatter(filteredData)` 更新

### 5.4 完整活動對照表

顯示 PV 前 45 名活動，欄位由左到右：

| 欄位 | 說明 |
|------|------|
| PV排名 | pvRank |
| 點擊排名 | clickRank |
| 活動名稱 | 可點擊連結至 `ticket.ibon.com.tw/ActivityInfo/Details/{id}`，下方顯示 ActivityId |
| D瀏覽量 | 數字右對齊；下方小字顯示**PV資料起始日**（`PV_BY_DATE` 最早 key） |
| D點擊量 | 數字右對齊；下方小字顯示**點擊資料起始日**（`CLICK_ACT_DAILY` 最早 date） |
| 點擊/瀏覽比 | 顏色：綠≥100%、橘≥50%、紅<50%；含比例條 |
| A購物車 | 來自 CART_DATA，數字右對齊 |
| A結帳 | 來自 PURCHASE_DATA，數字右對齊 |
| 結帳/購物車比 | purchase/cart×100%；顏色：綠≥50%、橘≥30%、紅<30%；含比例條 |

**關鍵字搜尋**：`#nameSearch` input，即時過濾活動名稱（含泡泡圖同步）。

**排序**：點擊欄位 header 切換升/降序，`getExtra()` 函式處理 cart/purchase/cartRate 的取值邏輯。

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
node generate_d_ga_funnel_report.js
git add D_GA_Funnel_202606_Report.html generate_d_ga_funnel_report.js
git commit -m "Update funnel report"
git push origin main
```

CART_DATA / PURCHASE_DATA 為靜態資料，需另行從 DMP cluster 查詢後手動更新 Charts 區塊。

## 8. 相關連結

- 目錄：`HTML_Report_Catalog.html`
- 瀏覽量報表：`D_GA_PageViewData_Webb_202606_Report.html`
- 點擊量報表：`D_GA_ClickData_Webb_202606_Report.html`
- 規範：`REPORT_SPEC_D_GA_PAGEVIEWDATA_202606.md` / `REPORT_SPEC_D_GA_CLICKDATA_202606.md`

---
*建立日期：2026/06/22｜最後更新：2026/07/01（移除 header subtitle、排名變化欄位；修正日期選擇器 ReferenceError；pvTo 擴展至昨天）*
