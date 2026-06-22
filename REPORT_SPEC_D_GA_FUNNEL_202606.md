# D系統 瀏覽→點擊轉換分析報表 技術規範說明

本文件定義「D系統瀏覽→點擊轉換分析報表（2026年6月）」的產出標準，未來更新或重新產出時請遵循本規範。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `D_GA_Funnel_202606_Report.html` |
| 產生腳本 | `generate_d_ga_funnel_report.js` |
| 資料來源 | MongoDB `QwareAi` / `GA_D_PageViewData_Webb_202606` + `GA_D_ClickData_Webb_202606` |
| 瀏覽量資料期間 | 2026/06/10 – 06/20（持續更新） |
| 點擊量資料期間 | 2026/05/26 – 06/06（持續更新） |
| 負責人 | 陳俊良 |
| 主要目的 | 分析同一活動在「節目介紹頁瀏覽（PageView）→ 場次點擊（ClickData）」兩個消費者行為層的差異，找出高轉換與低轉換活動 |

## 2. 核心概念

### 消費者旅程假設

```
消費者看到活動資訊
    ↓
瀏覽節目介紹頁（GA_D_PageViewData 記錄 page_view 事件）
    ↓
點擊場次選購票券（GA_D_ClickData 記錄 click 事件）
    ↓
完成購票
```

### 時間差注意事項

兩份資料**涵蓋不同時段**（PV: 06/10–06/20，Click: 05/26–06/06），因此「點擊/瀏覽比（CTR）」可能超過 100%。這並非錯誤，而是反映：
- ClickData 記錄的是開賣期間的點擊（購買行為旺盛）
- PageView 記錄的是開賣後持續的瀏覽（潛在消費者持續關注）

本報表以 **ActivityId** 為連結鍵，分析同一活動在兩個行為層的**相對關聯性**。

## 3. 資料結構

### 3.1 FUNNEL_DATA 陣列格式

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
  loggedIn:   76712,            // 已登入點擊數（來自 ClickData）
  notIn:      79491,            // 未登入點擊數
  perf:       279,              // 場次數
}
```

### 3.2 SUMMARY 物件格式

```js
{
  pvTotal:      516544,          // 所有 PV 活動合計瀏覽量
  clickTotal:   810590,          // 所有點擊活動合計點擊量
  matchedCount: 27,              // 同時出現在兩份資料的活動數
  pvOnlyCount:  8,               // 僅有 PV 資料的活動數
  clickOnlyCount:12,             // 僅有點擊資料的活動數
  matchedPV:    489597,          // 共同活動合計 PV
  matchedClicks:654308,          // 共同活動合計點擊
  pvDates:      "2026/06/10...", // PV 資料期間字串
  clickDates:   "2026/05/26...", // 點擊資料期間字串
}
```

## 4. 活動類別（CAT_MAP）

| 類別 key | 標籤 | 顏色 |
|----------|------|------|
| `sports`  | 運動 | 藍 #3b82f6 |
| `concert` | 演唱會 | 紫 #8b5cf6 |
| `kpop`    | K-pop | 玫紅 #f43f5e |
| `anime`   | 動漫/遊戲 | 綠 #10b981 |

`generate_d_ga_funnel_report.js` 維護完整的 `CAT_MAP`，新增活動時需手動補上。

## 5. 關鍵組件與圖表

### 5.1 KPI 卡片（6 張）

| 卡片 | 說明 |
|------|------|
| 總瀏覽量（PV） | 所有 PV 活動合計 |
| 總點擊量 | 所有點擊活動合計 |
| 共同活動數 | 兩份資料皆有的活動數 |
| 最高點擊/瀏覽比 | CTR 最高活動名稱與比值 |
| 高瀏覽低轉換 | CTR 最低活動（高瀏覽但少點擊）|
| 匹配整體點擊/瀏覽比 | matchedClicks / matchedPV × 100% |

### 5.2 漏斗視覺列（Funnel Row）

4步驟水平卡片：總 PV → 共同活動 → 總點擊 → 整體比值

### 5.3 散點圖（Scatter Chart）

- 對數雙軸（X = PV，Y = 點擊量）
- 每點代表一個共同活動，顏色依類別
- 加入 y=x 虛線作為「點擊/瀏覽比=100%」參考線
- 線上方 = 點擊量超過瀏覽量（強購買意圖）

### 5.4 點擊/瀏覽比橫條圖（CTR Bar）

- 共同活動依 CTR 降序排列
- 顏色依類別，值 ≥ 200% 才顯示數字標籤

### 5.5 類別占比對比圖（Category Comparison）

- X 軸：4 個類別
- 2 組 bar：瀏覽占比 vs 點擊占比
- 用於快速識別哪個類別在兩個層面的份額差異

### 5.6 完整活動對照表

- 篩選 chips：全部 / 兩者皆有 / 僅瀏覽 / 僅點擊 / 各類別
- 可排序欄位：PV排名、名稱、類別、瀏覽量、點擊量、CTR、點擊排名、排名變化
- 排名變化 = pvRank - clickRank（▲正 = 點擊排名優於瀏覽排名）

## 5.7 日期區間篩選（Date Range Filter）

報表頂部提供兩組 Flatpickr 日期選擇器：

| 篩選器 | 可選範圍 | 對應資料 |
|--------|---------|---------|
| PV 日期區間 | 06/10 – 06/20 | `PV_BY_DATE[actId][date]` |
| 點擊日期區間 | 05/27 – 06/20 | `CLICK_ACT_DAILY[actId][]` |

點擊「套用篩選」後呼叫 `applyFunnel()`，依選定日期區間重新計算：
- 各活動 pv / clicks（加總該區間有的日期）
- ctr（重新計算比值）
- pvRank / clickRank（依新數值重新排序）
- pvShare / clickShare（依新合計重新計算）

並同步更新：KPI 卡片、漏斗視覺列、散點圖、CTR 橫條圖、類別比較圖、完整表格。

「重置」按鈕還原到全期間數據。

### 靜態每日資料（非 generator 自動更新）

`PV_BY_DATE` 和 `CLICK_ACT_DAILY` 目前為靜態資料，嵌入在 HTML Charts 區塊（`// ── Charts ──` 之後），**不會被 generator 覆蓋**。若需更新，需手動從 `D_GA_PageViewData_Webb_202606_Report.html`（`DATA` 陣列的 `pvByDate`）和 `D_GA_ClickData_Webb_202606_Report.html`（`ACT_DAILY`）同步。

## 6. Section Markers（Generator 注入點）

```
// ── Data ──────────────────────────────────────────────────────────────────
const FUNNEL_DATA = [...];   ← generator 注入
const SUMMARY = {...};       ← generator 注入
// ── Charts ─────────────────────────────────────────────────────────────────
```

⚠️ **勿修改 marker 字串**，否則 generator 找不到注入點。

## 7. 更新方式

```bash
node generate_d_ga_funnel_report.js
git add D_GA_Funnel_202606_Report.html generate_d_ga_funnel_report.js
git commit -m "Update funnel report"
git push origin main
```

更新頻率：手動執行，或配合 PV / Click 兩份報表同步更新。

## 8. 關鍵洞察（初版基準）

| 洞察 | 數值 |
|------|------|
| 匹配整體 CTR | 133.6% |
| K-pop 類別 CTR 中位數 | 約 188–945%（粉絲購買力強） |
| 動漫/遊戲類別 CTR 中位數 | 約 7–18%（瀏覽偏探索型）|
| 排名躍升最多 | ONE PACT (PV#27 → 點擊#17), Girl Rules (PV#17 → 點擊#8) |
| 排名下滑最多 | Square Enix (PV#18 → 點擊#32, -14) |

## 9. 相關連結

- 目錄：`HTML_Report_Catalog.html`
- 瀏覽量報表：`D_GA_PageViewData_Webb_202606_Report.html`
- 點擊量報表：`D_GA_ClickData_Webb_202606_Report.html`
- 規範：`REPORT_SPEC_D_GA_PAGEVIEWDATA_202606.md` / `REPORT_SPEC_D_GA_CLICKDATA_202606.md`

---
*建立日期：2026/06/22*
