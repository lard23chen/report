# D系統 GA 每日流量報表 設計文件

## 背景

`D_GA_Funnel_202606_Report.html` 目前把 D 系統的四層消費者行為（PV 瀏覽 → Click 點擊 → 加入購物車 → 結帳）疊在同一個轉換漏斗頁面。其中 PV/Click 兩層資料源自 Google Analytics（MongoDB collection `GA_D_PageViewData_Webb_202606` / `GA_D_ClickData_Webb_202606`），且自 2026/07/06 起已由 `generate_d_ga_funnel_report.js` 每日自動聚合出 `PV_BY_DATE` / `CLICK_ACT_DAILY`（按 ActivityId 分桶）；購物車/結帳兩層則來自 DMP（`trek-first-party-dmp`），不是 GA 資料。

使用者只想看純 GA 流量（不含 DMP 購物車/結帳），且希望有整體每日趨勢、活動排行、類別分布——這些是舊版一次性快照報表（`D_GA_PageViewData_Webb_202606_Report.html`、`D_GA_ClickData_Webb_202606_Report.html`）有、但 funnel report 沒有的視角（funnel report 只到活動別，沒有「D 系統整體」的每日加總）。

## 決策

做一份全新獨立報表，不修改 funnel report 既有邏輯（避免影響現有每日自動化排程），只抽出其中一份手動維護的共用資料（`CAT_MAP`）成獨立檔案供兩邊 require，降低未來分岔風險。

## 新增檔案

| 檔案 | 用途 |
|------|------|
| `d_system_activity_category_map.js` | 抽出 `generate_d_ga_funnel_report.js` 現有的 `CAT_MAP`（43 個 ActivityId → 類別的手動對照表）成獨立 module，`module.exports = { CAT_MAP }`。`generate_d_ga_funnel_report.js` 改成 `require` 這份檔案，取代原本內嵌的物件字面量；新 generator 也 require 同一份。這是本次唯一觸碰既有排程檔案的地方，且只是資料搬移、不改查詢/輸出邏輯。 |
| `generate_d_ga_traffic_daily.js` | 新 generator。查詢邏輯抄 `generate_d_ga_funnel_report.js` 現成的兩段聚合：①每活動 PV/Click 總量（`$group by ActivityId`）②每活動每日 PV/Click（`$group by {ActivityId, EventDate}`，EventDate 轉台北時間 `MM/DD`）。在既有邏輯之上，多做一步：把所有活動的每日 PV/Click 加總成 `DAILY_TOTAL`（D 系統整體，非單一活動）。 |
| `D_GA_Traffic_Daily_Report.html` | 新報表頁面。`<head>` 沿用 `D_GA_Funnel_202606_Report.html` 現有的 IP 白名單 gate（同一份 `ALLOWED` IP 清單，複製過來，不指向共用檔案——維持每份報表各自獨立完整的 HTML，與專案現有慣例一致）。 |

## 資料結構（generator 注入）

```js
// DAILY_TOTAL：D系統整體每日 PV/Click（本報表新增的總覽層，funnel report 沒有）
const DAILY_TOTAL = [
  { date: "06/10", pv: 12345, clicks: 3456 },
  // … 依日期升冪排序
];

// ACTIVITY_RANKING：沿用 funnel report 的 merged 資料邏輯（pv/clicks 總量＋排名＋類別）
const ACTIVITY_RANKING = [
  { id: "39428", name: "...", cat: "sports", pv: 5000, pvRank: 1, clicks: 1200, clickRank: 3 },
  // …
];

// PV_BY_DATE / CLICK_ACT_DAILY：與 funnel report 同格式（ActivityId → date → 數量），
// 供前端日期篩選時重新加總 DAILY_TOTAL / ACTIVITY_RANKING / 類別分布
const PV_BY_DATE = { "39428": { "06/10": 500, ... }, ... };
const CLICK_ACT_DAILY = { "39428": [{ date:"06/10", total:120 }, ...], ... };

// CATEGORY_MAP：從共用檔案帶入，供前端類別分布圖表使用（key 對照 ACTIVITY_RANKING.cat）
```

## 頁面組件（由上到下）

1. **Header**：標題「D系統 GA 每日流量報表」+ 資料期間標示（PV/Click 各自的日期範圍，比照 funnel report）
2. **日期區間篩選器**：flatpickr 雙欄位，錨點＝資料最後一天（非日曆今天，沿用 funnel report /F黑名單報表已驗證過的錨點設計），套用後連動下面三塊
3. **整體每日 PV/Click 趨勢圖**：折線圖，兩條線（PV、Click），Chart.js
4. **活動排行榜**：PV TOP10 / Click TOP10 兩個表格或可切換 tab，仿舊版 `D_GA_PageViewData`/`D_GA_ClickData` 報表的排行呈現
5. **類別分布**：依 `CATEGORY_MAP` 分組加總 PV/Click，長條圖或圓餅圖 + 佔比表格

前端篩選邏輯：套用日期區間時，用 `PV_BY_DATE`/`CLICK_ACT_DAILY` 在瀏覽器端重新加總出該區間的 `DAILY_TOTAL`、`ACTIVITY_RANKING`、類別分布，不重新整頁請求（與 funnel report 的 `applyFunnel()` 模式一致）。

## 串接既有系統

- **`daily_update.bat`**：在 `generate_d_ga_funnel_report.js` 之後新增 `node generate_d_ga_traffic_daily.js` 一行，隨每日 08:00 排程自動更新
- **`HTML_Report_Catalog.html`**：D系統分類區塊新增一列，規範文檔連結指向 `REPORT_SPEC_D_GA_TRAFFIC_DAILY.md`
- **`report_index.html`**：「流量分析」tab（tab6）新增一張卡片，連結 `D_GA_Traffic_Daily_Report.html`（同步套用 [[report-index-manual-cards-source-of-truth]] 教訓——先加進 `D:\2025\AI\MongoDB` 這份來源檔，再手動同步到 NewReport 兩個 remote，不要只改 NewReport）
- **`REPORT_SPEC_D_GA_TRAFFIC_DAILY.md`**：新規範文檔，記錄資料結構、查詢邏輯、與 funnel report 的關係（共用 CAT_MAP 檔案、資料源相同但用途不同——這份是「D系統整體流量總覽」，funnel report 是「活動別四層轉換分析」）

## 不做的事（YAGNI）

- 不動 `generate_d_ga_funnel_report.js` 的查詢/輸出邏輯，只把 `CAT_MAP` 抽出來
- 不做即時 API 查詢，資料嵌入頁面（比照 funnel report 與其他 D 系統報表慣例）
- 不合併 DMP 購物車/結帳資料——這份報表定位就是「純 GA」，混入 DMP 會失去這次拆分的意義
