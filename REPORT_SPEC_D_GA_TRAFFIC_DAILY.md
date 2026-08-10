# D系統 GA 每日流量報表 技術規範說明

本文件定義「D系統 GA 每日流量報表」(`D_GA_Traffic_Daily_Report.html`) 的產出標準，未來更新或重新產出時請遵循本規範。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `D_GA_Traffic_Daily_Report.html` |
| 產生腳本 | `generate_d_ga_traffic_daily.js` |
| 資料來源 | MongoDB `QwareAi` / `GA_D_PageViewData_Webb_202606` + `GA_D_ClickData_Webb_202606`（純 Google Analytics 資料，**不含** DMP） |
| 負責人 | 陳俊良 |
| 主要目的 | D 系統整體每日 GA 流量趨勢、活動排行、類別分布，與 `D_GA_Funnel_202606_Report.html` 互補——那份報表混了 DMP 購物車/結帳兩層，這份報表刻意只留純 GA 資料 |

## 2. 與 D_GA_Funnel_202606_Report.html 的關係

兩份報表查詢同一組 GA collection（`GA_D_PageViewData_Webb_202606` / `GA_D_ClickData_Webb_202606`），`generate_d_ga_traffic_daily.js` 獨立執行自己的聚合查詢，**不讀取 funnel report 的輸出**，兩支腳本互不依賴，各自可以獨立重跑。

共用的部分只有 `d_system_activity_category_map.js`（ActivityId → 類別的手動對照表，2026/08/10 從 `generate_d_ga_funnel_report.js` 抽出）——兩支 generator 都 `require` 這份檔案，新增或修改活動類別只需要改這一處。

| | D_GA_Funnel_202606_Report.html | D_GA_Traffic_Daily_Report.html |
|---|---|---|
| 資料層 | PV → Click → 購物車 → 結帳（四層） | PV、Click（兩層，純 GA） |
| 視角 | 活動別轉換漏斗（泡泡圖、CTR） | D 系統整體每日趨勢 + 活動排行 + 類別分布 |
| 適合問題 | 「這個活動的瀏覽轉點擊轉購買效果如何」 | 「D 系統整體流量今天/這週怎麼樣、哪個活動/類別最熱門」 |

## 3. 資料結構（generator 注入）

```js
// DAILY_TOTAL：D系統整體每日 PV/Click（所有活動加總）
const DAILY_TOTAL = [
  { date: "06/10", pv: 12345, clicks: 3456 },
  // … 依日期升冪排序
];

// ACTIVITY_RANKING：每活動 PV/Click 總量、排名、佔比、類別
const ACTIVITY_RANKING = [
  { id: "39428", name: "...", cat: "sports", pv: 5000, pvRank: 1, pvShare: 12.3, clicks: 1200, clickRank: 3, clickShare: 8.1 },
  // … 依 pv 由大到小排序
];

// PV_BY_DATE：每活動每日 PV，供前端日期篩選時重新加總
const PV_BY_DATE = { "39428": { "06/10": 500, ... }, ... };

// CLICK_ACT_DAILY：每活動每日 Click，格式與 funnel report 一致
const CLICK_ACT_DAILY = { "39428": [{ date:"06/10", total:120 }, ...], ... };

// DATA_META：頁首標籤與統計用的中繼資料
const DATA_META = {
  pvDateFrom: "06/10", pvDateTo: "08/09",
  clickDateFrom: "05/27", clickDateTo: "08/09",
  totalActivities: 47,
  generatedAt: "2026/08/10 08:00",
};
```

### 3.1 Section Marker

```
// ── Data Start ──────────────────────────────────────────────────────────────
const DAILY_TOTAL = […];
const ACTIVITY_RANKING = […];
const PV_BY_DATE = {…};
const CLICK_ACT_DAILY = {…};
const DATA_META = {…};
// ── Data End ────────────────────────────────────────────────────────────────
```

⚠️ **勿修改 marker 字串**，否則 generator 找不到注入點。

## 4. 關鍵組件

### 4.1 日期區間篩選

單一日期區間（不像 funnel report 分 PV/Click 兩組區間），套用後同時重新計算：整體每日趨勢圖（`computeDaily()`）、活動排行榜（`computeRanking()`）、類別分布圖。錨點＝`DAILY_TOTAL` 最後一筆日期（資料端，非日曆今天），與本專案其他日期篩選報表（F黑名單、Azure每日費用、D_GA_Funnel）一致的錨點設計。

### 4.2 活動排行榜

單一表格同時顯示 PV 與 Click 兩欄（含各自排名 `pvRank`/`clickRank`、佔比 `pvShare`/`clickShare`），透過點擊欄位標題排序（`sortTable()`）達成「PV 排行榜」或「Click 排行榜」的效果，不做成分頁籤——比舊版 `D_GA_PageViewData`/`D_GA_ClickData` 報表各自獨立 TOP10 表格更精簡，避免功能重複的兩份表格。

類別篩選（`setCatFilter()`）用 chip 群組（全部/運動/演唱會/K-pop/動漫/未分類，見 §4.4），沿用 `D_GA_Funnel_202606_Report.html` 已驗證過的類別配色與 badge 樣式（`CAT_COLOR`/`CAT_LABEL`/`CAT_CSS`）。

**`computeRanking()` 的排名重算注意**：篩選日期區間後，若某活動在該區間內 `pv`/`clicks` 為 0（查無資料），對應的 `pvRank`/`clickRank` 必須重設為 `null`（而非沿用未篩選時的排名），否則表格會顯示「— #12」這種矛盾狀態（有排名但無數據）。程式碼比照 `D_GA_Funnel_202606_Report.html` 的 `computeFunnel()` 寫法：`rows.filter(d=>d.pv==null).forEach(d=>{ d.pvRank=null; });`（`clickRank` 同理）。

### 4.3 類別佔比分布

長條圖顯示各類別的 PV 佔比與 Click 佔比（兩個百分比，同一 0-100 座標軸），而非兩個量級差異可能很大的絕對值——避免 PV 動辄上萬、Click 只有數百造成圖表視覺失衡。

### 4.4 未分類類別（'other'，2026/08/10 新增）

`d_system_activity_category_map.js` 的 `CAT_MAP` 是手動維護的對照表，只涵蓋部分活動 ID（實測某次執行查到 86 個不重複活動，其中 39 個不在對照表內，佔比高達 45%）。初版 generator 對查無對照的活動一律 fallback 標成 `'concert'`，結果把當次 PV 排名第一的活動（一場棒球明星賽）誤標成「演唱會」，且讓類別分布圖被扭曲（`concert` 佔比虛高）。

修正後改用誠實的第 5 個類別 `'other'`（前端顯示「未分類」，灰色 badge/chip，`generate_d_ga_traffic_daily.js` 內 `cat: CAT_MAP[id] || 'other'`），類別分布圖與排行榜 chip 篩選都相應新增這個選項。**這是資料誠實度的取捨，不是完整度問題的根治**：若要減少「未分類」的數量，需要業主或熟悉活動內容的人補齊 `d_system_activity_category_map.js` 裡缺少的 ActivityId 對照，不應用程式猜測。

⚠️ `D_GA_Funnel_202606_Report.html`（`generate_d_ga_funnel_report.js`）目前**仍然**用 `CAT_MAP[id] || 'concert'` 的舊 fallback，尚未套用這個修正（該報表的類別分布/篩選功能較次要，經確認後暫不動它，之後如需一併修正請同步套用同樣的 `'other'` 模式）。

### 4.5 IP 白名單保護

比照 `D_GA_Funnel_202606_Report.html` 機制（`api.ipify.org` 查訪客 IP 比對 9 組授權 IP，不符即整頁換成「存取被拒絕」）。清單為手動維護的靜態內容，generator 只用 marker 區塊替換資料、不會動到 `<head>`。

### 4.6 整體每日趨勢圖峰值標籤（2026/08/10 新增）

「整體每日 PV / Click 趨勢」線圖（`trendChart`）在最多 10 個 PV 局部峰值上方固定顯示深色小標籤，寫出當天 PV 最高的**單一活動**名稱（`topActivityForDate(date)` 掃描 `PV_BY_DATE` 找出該日 PV 最大的活動，再從 `ACTIVITY_RANKING` 查名稱；超過 14 字元截斷加「…」）。用意是讓看圖的人不用另外去排行榜表格查，一眼就知道流量高峰是哪些活動帶動的。

- **只標最高點（單一）→ 只標前 10 高點（純數值）→ 只標局部峰值（2026/08/10 定案）**：初版只標全體最高的一天；使用者接著要求「前10個加上去」，改成單純依數值排序取前 10 天，結果發現連續多天都很熱門時（例如 06/23～06/27 同一活動延燒 5 天都擠進前 10），標籤會疊在同一小塊區域看不清楚；改用「局部峰值」（`findLocalPeaks()`：比左右兩個鄰居都高的點）取代單純數值排序前 10，同樣最多 10 個標籤，但因為要求比鄰居高，同一波連續熱門天只會標出真正的高峰那一天，自然分散在時間軸上不重疊
- `findLocalPeaks()` 用嚴格大於（`>`，非 `>=`）比較左右鄰居，這樣一段數值相同的平台（例如報表最前面 GA 資料尚未涵蓋、`pv` 恆為 0 的那幾天）不會被誤判成峰值
- 只有 PV 資料集有標籤；Click 資料集固定 `datalabels:{display:false}`，避免同一天兩個數字重疊
- Y 軸（PV）加了 `suggestedMax: pvMax * 1.25` 預留頭部空間，否則高峰點常常頂到圖表最上緣，標籤會被裁切或蓋住圖例（`legend`）
- 峰值是依「目前篩選範圍內的 daily」重新計算，套用日期篩選後標籤會跟著換成該範圍內的局部峰值與對應活動

## 5. MongoDB 連線資訊

| 用途 | Cluster URI | DB | Collection |
|------|-------------|-------|------------|
| 每活動 PV 總量 + 每日 PV | `MONGODB_URI_QWARE` | `QwareAi` | `GA_D_PageViewData_Webb_202606` |
| 每活動 Click 總量 + 每日 Click | `MONGODB_URI_QWARE` | `QwareAi` | `GA_D_ClickData_Webb_202606` |

## 6. 更新方式

```bash
node generate_d_ga_traffic_daily.js
git add D_GA_Traffic_Daily_Report.html
git commit -m "Update D-system GA daily traffic report"
git push origin main
```

**已排入 `daily_update.bat`**，跟在 `generate_d_ga_funnel_report.js` 之後每日 08:00 自動執行，並隨 `SYNC_FILES` 同步到 NewReport（`origin` + `company` 兩個 remote）。

## 7. 相關連結

- 目錄：`HTML_Report_Catalog.html`
- 姊妹報表：`D_GA_Funnel_202606_Report.html`（`REPORT_SPEC_D_GA_FUNNEL_202606.md`）
- 共用類別對照表：`d_system_activity_category_map.js`

---
*建立日期：2026/08/10｜使用者要求一份「純 GA、不含 DMP」的 D 系統每日流量報表，與既有 funnel report（混了四層含 DMP）區隔開來*
*2026/08/10：首次跑真實資料時發現 86 個活動裡有 39 個（45%）不在 `CAT_MAP` 對照表內，原本 fallback 成 concert 導致排名第一的活動（棒球賽事）被誤標、類別分布失真；改為新增誠實的「未分類」（'other'）類別，詳見 §4.4*
