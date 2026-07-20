# E系統購票流量轉換報表 技術規範說明

本文件定義「E系統購票流量轉換報表」的產出標準，未來更新或重新產出時請遵循本規範。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `E_DMP_Funnel_Report.html` |
| 產生腳本 | `generate_e_dmp_funnel_report.js` |
| 資料來源 | MongoDB `trek-first-party-dmp`（qware-dmp-ver-7 cluster）`event` collection |
| 資料期間 | 2026/01/05 起持續累計（每日排程自動更新，頁首日期區間隨資料延伸） |
| 負責人 | 陳俊良 |
| 主要目的 | 分析 E 系統（tour.ibon.com.tw）同一活動在「節目頁瀏覽（page_view）→ 完成購買（purchase）」兩個消費者行為層的轉換表現，含票券張數與銷售金額 |

## 2. 核心概念

### 消費者旅程（兩階段漏斗）

```
消費者看到活動資訊
    ↓
瀏覽節目介紹頁（DMP event：bu="E", name="page_view"）
    ↓
完成購買（DMP event：bu="E", name="purchase"，含 quantity/price）
```

⚠️ **原始需求為 page_view → add_cart → payment 三階段**，但 DMP event collection 中 bu:"E" 實際只存在 `page_view` 與 `purchase` 兩種事件（2026/07/07 查證，整個 collection 也無任何 `add_cart` / `payment` 事件名稱），經確認後改為兩階段漏斗。未來若 DMP 開始收 E 系統購物車事件，可擴充為三階段。

### 與 D 版報表的差異

| | D 版（`D_GA_Funnel_202606_Report.html`） | E 版（本報表） |
|---|---|---|
| 資料來源 | GA 匯出（QwareAi）+ DMP 兩處 | 單一 DMP event collection |
| 連結鍵 | ActivityId（需 ProductId join） | attribution_id（原生欄位，免 join） |
| 漏斗層數 | PV → Click → Cart → Purchase | PV → Purchase（張數 + 金額） |
| 轉換率可信度 | 資料期間不同，CTR 可 >100% | 同源同期間，轉換率為真實比例 |
| 日期篩選 | PV 範圍（cart/purchase 連動） | 單一範圍，瀏覽/購買/金額同步套用 |

## 3. 資料結構

### 3.1 FUNNEL_DATA 陣列格式（generator 注入）

```js
{
  id:      "6a3b7c8e2638e25bd761e777",  // attribution_id（活動 id，24 hex）
  name:    "2026臺南七股海鮮節…",        // 活動名稱（優先 page_view 的 content_name；purchase 的含「 - 票種」後綴，取用時已去除）
  pv:      76765,    // 總瀏覽量（null = 無 PV 資料）
  qty:     1520,     // 總購買張數（sum of quantity；null = 無購買資料）
  rev:     684000,   // 銷售金額 = Σ(price × quantity)，四捨五入至整數（null = 無購買資料）
  conv:    2.0,      // 轉換率 = qty/pv*100（null = 未匹配）
  pvRank:  2,        // PV 排名（null = 無 PV 資料）
  qtyRank: 5,        // 購買排名（null = 無購買資料）
}
```

### 3.2 SUMMARY 物件格式（generator 注入）

```js
{
  pvTotal: 564980, qtyTotal: 120499, revTotal: 53133784,
  pvActCount: 587,    // 有 PV 的活動數
  purActCount: 361,   // 有購買的活動數
  matchedCount: 358,  // 兩者皆有的活動數
  pvDates: "01/05 – 07/07", purDates: "01/05 – 07/07",
}
```

### 3.3 每日分桶資料（generator 注入，供日期篩選）

| 常數 | 說明 | 結構 |
|------|------|------|
| `PV_BY_DATE` | 每日瀏覽量，keyed by attribution_id → MM/DD | `{"6a3b…": {"01/05": 120, …}}` |
| `PUR_BY_DATE` | 每日購買張數（quantity 加總） | 同上 |
| `REV_BY_DATE` | 每日銷售金額（price×quantity 加總） | 同上 |
| `E_DATES` | 所有有資料日期的排序清單（MM/DD） | `["01/05", …]` |

- 依 `time` 欄位（UTC）以 `+08:00` 時區換算為 `MM/DD` 做每日分桶（`$dateToString` timezone `+08:00`）
- 購買量加總欄位為 `quantity`（不可用文件數 `$sum:1`，單筆 purchase 的 quantity 可能 >1）
- `price` 為 Decimal128，需 `$toDouble` 後與 quantity 相乘
- `FUNNEL_DATA` 的 pv/qty/rev 由對應 BY_DATE 加總而得，保證一致

### 3.4 Section Markers（Generator 注入點）

```
// ── Data Start ──────────────────────────────────────────────────────────────
const FUNNEL_DATA = […];
const SUMMARY = {…};
const PV_BY_DATE = {…};
const PUR_BY_DATE = {…};
const REV_BY_DATE = {…};
const E_DATES = […];
// ── Data End ────────────────────────────────────────────────────────────────
```

另外 `<span id="updateTimeLabel">…</span>` 由 generator 以 regex 整段替換為執行當下時間。

⚠️ **勿修改 marker 字串**，否則 generator 找不到注入點。

## 4. 關鍵組件

### 4.1 Header Tags（動態填入）

頁面載入後由 JS 從 `SUMMARY` / `E_DATES` 動態填入：瀏覽資料期間、購買資料期間、共同活動數、更新時間。

### 4.2 日期區間篩選

單一組 flatpickr 日期範圍（`#dtFrom` / `#dtTo`），套用後瀏覽量、購買量、銷售金額**同步**依相同範圍從三個 BY_DATE 重新加總（`computeFunnel(from, to)`），並重算排名與轉換率，更新漏斗列、泡泡圖、表格。

- from：僅限有實際資料的日期（≤ 昨天）
- to：從第一個資料日到昨天的連續序列（無資料日貢獻 0）

**快速區間按鈕（2026/07/17 新增，與 D 版 funnel 報表同規格）**：filter-actions 內「套用篩選」左側有「1天前」「7天前」兩顆 ghost 按鈕，呼叫 `setQuickRange(days)`（定義於 Date Pickers 區塊末端）：

- 錨點 = `fromAvail` 最後一個元素（**最後一個有資料的日子**，非日曆昨天——每日排程有時差，錨定資料端才不會選到空日）
- 「1天前」：from = to = 錨點（最近一天資料）；「7天前」：from = 錨點往前 6 天（不足時 clamp 到第一個有資料日），to = 錨點
- 設完日期直接呼叫 `applyFunnel()` 套用，不需再按「套用篩選」

### 4.3 漏斗視覺列

三格：瀏覽量 → 購買張數（含轉換率 badge）→ 銷售金額（含平均票價 badge）。隨日期篩選連動（`updateFunnelRow`）。

### 4.4 泡泡圖（Bubble Chart）

- **Chart.js `type:'bubble'`**，僅顯示 pv 與 qty 皆有的共同活動
- **X 軸**：瀏覽量（對數，min 1 – max 150,000）
- **Y 軸**：購買張數（對數，min 1 – max 20,000）
- **泡泡大小**：銷售金額，`bubbleR(rev) = max(4, sqrt(rev/MAX_REV)*26+4)`，`MAX_REV` 由 FUNNEL_DATA 動態計算
- **顏色**：依轉換率分層（`TIER_COLOR`）：綠 ≥50%、藍 20–50%、橘 5–20%、玫紅 <5%
- **參考線**：y=x 虛線（轉換率 100%）、y=0.1x 虛線（轉換率 10%）
- **Tooltip**：活動名稱、瀏覽、購買張數、轉換率、銷售金額
- **Datalabel**：僅泡泡半徑 ≥14 顯示名稱前 8 字，避免小泡泡文字重疊
- **篩選同步**：日期篩選與關鍵字搜尋皆呼叫 `updateScatter()`

### 4.5 完整活動對照表

顯示所有有瀏覽或購買的活動（不設排名上限），欄位由左到右：

| 欄位 | 說明 |
|------|------|
| 瀏覽排名 | pvRank |
| 購買排名 | qtyRank |
| 活動名稱 | 可點擊連結至 `tour.ibon.com.tw/event/{id}`，下方顯示 attribution_id |
| E瀏覽量 | 右對齊；下方小字顯示 PV 資料起始日 |
| E購買量（張） | 右對齊；下方小字顯示購買資料起始日 |
| 銷售金額 | `$` + 千分位 |
| 平均票價 | rev/qty，四捨五入（排序 key = `avgPrice`） |
| 購買/瀏覽轉換率 | 顏色：綠≥30%、橘≥10%、紅<10%；含比例條（封頂 100%） |

**Chips**：全部 ｜ 有瀏覽且有購買 ｜ 僅瀏覽無購買 ｜ 僅購買無瀏覽（E 系統無活動類別對照表，故無類別 chips）。

**關鍵字搜尋**：`#nameSearch`，即時過濾活動名稱或 attribution_id（含泡泡圖同步）。

**排序**：點欄位 header 切換升/降序。

## 5. MongoDB 連線資訊

| 用途 | Cluster URI | DB | Collection | 篩選 |
|------|-------------|-------|------------|------|
| 全部資料 | `qware-dmp-ver-7.f0fpg.mongodb.net` | `trek-first-party-dmp` | `event` | `bu:"E"`, `name:"page_view"` / `"purchase"` |

E 系統 event 常用欄位：`attribution_id`（活動 id）、`content_name`、`category`（`E-…` id，無可讀名稱對照，未使用）、`canonical_url`、`keywords`、`time`；purchase 另有 `order_id`、`price`（Decimal128）、`quantity`、`currency`。

## 6. 更新方式

```bash
node generate_e_dmp_funnel_report.js   # 重新聚合全部資料並注入 HTML
git add E_DMP_Funnel_Report.html generate_e_dmp_funnel_report.js
git commit -m "Update E funnel report"
git push origin main
```

**2026/07/07 起已列入 `daily_update.bat` 每日排程**（每日 08:00，於 `generate_d_ga_funnel_report.js` 之後執行），單一 generator 即完成全部資料，git push 由 bat 統一處理。手動更新時執行上述指令即可。排程細節見 `REPORT_SPEC_SCHEDULED_TASKS.md` §2。

**2026/07/20 新增**：`<head>` 加入 IP 白名單保護（同目錄頁 `HTML_Report_Catalog.html` 機制，`api.ipify.org` 查訪客 IP 比對 9 組授權 IP，不符即整頁換成「存取被拒絕」）。此前本報表沒有此保護，任何人有連結即可看到完整 E 系統轉換漏斗資料。清單為手動維護的靜態內容，`generate_e_dmp_funnel_report.js` 只用 marker 區塊替換資料、不會動到 `<head>`，之後改版該檔案時務必保留此段。

## 7. 相關連結

- 目錄：`HTML_Report_Catalog.html`
- D 版對照報表：`D_GA_Funnel_202606_Report.html`（規範：`REPORT_SPEC_D_GA_FUNNEL_202606.md`）
- **頁首互連（2026/07/09 新增）**：header `hdr-tags` 最後有一顆藍色連結標籤「🔗 A系統購票流量轉換 →」（相對路徑連到 `D_GA_Funnel_202606_Report.html`），對方頁面也有反向連結回本報表。此連結直接寫在 HTML（generator 為 marker 注入式、不會覆蓋），重建頁面模板時需保留。

---
*2026/07/20：`<head>` 補上 IP 白名單保護，之前任何人有連結都能看，見 §6*
*建立日期：2026/07/07｜原需求 page_view → add_cart → payment 三階段，因 DMP 無 E 系統 add_cart/payment 事件，經用戶確認改為 page_view → purchase 兩階段（含張數與金額）*
*2026/07/07：加入 daily_update.bat 每日 08:00 排程，改為自動更新*
*2026/07/17：日期區間新增「1天前」「7天前」快速按鈕（錨定最後有資料日、自動套用篩選），與 D 版 funnel 報表同規格，見 §4.2*
