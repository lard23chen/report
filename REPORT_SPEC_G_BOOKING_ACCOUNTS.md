> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取（內含 USER_ID 等會員活動指紋）。

# 訂票紀錄帳號清單 技術規範說明

本文件定義「訂票紀錄帳號清單」的產出標準，未來更新或重新產出時請遵循本規範。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `G_MEM_Booking_Accounts_Report.html` |
| 產生腳本 | `generate_g_booking_accounts_report.js` |
| 資料來源 | MongoDB `QwareAi`（`MONGODB_URI_QWARE`）`Qware_A_OrderTemp_log_202608` collection |
| 資料範圍 | 全量彙總（collection 本身僅保留近 2 個月資料，見 §2） |
| 負責人 | 陳俊良 |
| 主要目的 | 列出所有在 A 系統訂票暫存 log 裡有紀錄的帳號，依訂票筆數/涉及演出數/首末次訂票時間彙總，預設依訂票筆數由多到少排序，用來快速找出訂票次數異常密集的帳號（搶票機器人/黃牛特徵） |

## 2. 為何是彙總統計，不是逐筆訂單明細

`Qware_A_OrderTemp_log_202608` 是訂票暫存 log（`order_user_id`、`performance_id`、`performance_price_area_id`、`order_seat`、`book_date_time`、`order_user_ip`），實測 1,236,905 筆、無索引（只有 `_id`）、資料期間僅 2026-06-05 ~ 2026-08-04（collection 本身不保留更久的歷史，非本報表刻意限制）。

若逐筆嵌入 124 萬筆訂單明細，檔案會遠超本專案容量管理原則（`CLAUDE.md`）。改用 `$group` 依 `order_user_id` 聚合，只保留每個帳號的統計值：

```js
{ $group: { _id: '$order_user_id', cnt: {$sum:1}, minT: {$min:...}, maxT: {$max:...}, perfSet: {$addToSet:'$performance_id'} } }
```

實測全表僅 **139,781 個相異帳號**（遠少於 124 萬筆原始紀錄），彙總後 JSON **~13.8MB**（本報表最終檔案 ~12.4MB）。這個規模跟 [[f-blacklist-report-large-file]]（`F_MEM_BlackList_Query_Report.html`）比起來小很多，是獨立報表、不會疊加在一起。

**逐筆訂單明細（座位、演出場次等）本報表不提供**，只有彙總統計；如需查特定帳號的完整訂票明細，需另行以 MongoDB 查詢 `Qware_A_OrderTemp_log_202608`（`order_user_id` 篩選）。

### 2.1 前端渲染上限（RENDER_CAP）

139,781 筆若全部塞進 `<table>` DOM，瀏覽器會嚴重卡頓（實測整頁互動幾乎凍結）。前端 `renderTable()` 設有 `RENDER_CAP = 1000`：排序/搜尋後的結果只渲染前 1,000 列，超過時「符合條件」旁會顯示「僅顯示前 1,000 筆，請搜尋 USER_ID 縮小範圍」。這只影響畫面呈現，`BOOKING_DATA`／篩選邏輯仍作用於全部 139,781 筆（例如排序永遠是對全體資料排序，只是只畫出前 1000 名）。

## 3. 資料結構

### 3.1 BOOKING_DATA 陣列格式（generator 注入，短欄位名以縮小檔案）

```js
{
  u: "74265943569584453512",   // order_user_id
  c: 2037,                     // 訂票筆數（$group 的 $sum:1）
  p: 2,                        // 涉及演出數（distinct performance_id 數量）
  a: "2026-06-06 12:06:07",    // 首次訂票時間（台北時間 book_date_time 最小值）
  z: "2026-07-12 13:51:02",    // 最後訂票時間（台北時間 book_date_time 最大值）
}
```

### 3.2 DATA_META 物件格式（generator 注入）

```js
{ total: 139781, totalRecords: 1236905, minDate: "2026-06-05", maxDate: "2026-08-04" }
```

- `total`：相異帳號數；`totalRecords`：原始訂票紀錄總筆數（`$sum` 全體 `c`）
- `minDate`/`maxDate`：所有帳號首/末次訂票時間中的最小/最大日期，用於 header 顯示資料範圍

### 3.3 Section Marker（Generator 注入點）

```
// ── Data Start ──────────────────────────────────────────────────────────────
const BOOKING_DATA = […];
const DATA_META = {…};
// ── Data End ────────────────────────────────────────────────────────────────
```

⚠️ **勿修改 marker 字串**，否則 generator 找不到注入點。`<span id="updateTimeLabel">…</span>` 由 generator 以 regex 整段替換為執行當下時間。

## 4. 關鍵組件

### 4.1 查詢與排序

- `#uidSearch`：USER_ID 部分字串比對，即時篩選（`oninput`）
- 表格 5 欄皆可點 header 排序（`sortTable()`），預設依「訂票筆數」由多到少（`sortKey='c', sortDir='desc'`）——這是刻意的預設值，讓最異常（可能是機器人/黃牛）的帳號直接排在最前面，不需使用者額外操作
- 「訂票筆數」欄位 ≥100 的用玫紅色（`.cnt-hot`）標示，快速肉眼辨識異常密集帳號

### 4.2 IP 白名單保護

比照 F 系統報表機制（`api.ipify.org` 查訪客 IP 比對 9 組授權 IP，不符即整頁換成「存取被拒絕」）。`generate_g_booking_accounts_report.js` 只用 marker 區塊替換資料、不會動到 `<head>`。

## 5. MongoDB 連線資訊

| 用途 | Cluster URI | DB | Collection | 篩選 |
|------|-------------|-------|------------|------|
| 帳號訂票彙總 | `MONGODB_URI_QWARE` | `QwareAi` | `Qware_A_OrderTemp_log_202608` | 無篩選，全表 `$group` 聚合（見 §2） |

主要欄位：`order_user_id`、`performance_id`、`performance_price_area_id`、`order_seat`、`book_date_time`、`order_user_ip`。collection 只有 `_id` 索引，全表僅 124 萬筆且時間跨度短（~2 個月），全表聚合一次约 6～7 秒，屬於一次性成本、可接受。

⚠️ 另有一個大小寫幾乎相同的 collection `QWARE_A_OrderTemp_log_202608`（371 萬筆，全大寫開頭），內容結構相同但筆數不同，**本報表固定使用 `Qware_A_OrderTemp_log_202608`（開頭小寫 Qware）**，是使用者需求裡明確指定的名稱，重跑 generator 前請確認沒有誤植成另一個 collection。

## 6. 更新方式

```bash
node generate_g_booking_accounts_report.js
git add G_MEM_Booking_Accounts_Report.html generate_g_booking_accounts_report.js
git commit -m "Update G booking accounts report"
git push origin main
```

**目前沒有排入任何排程**（不在 `daily_update.bat` 等 4 支 bat 的清單內），純手動報表；如需查最新資料，重新執行上述指令即可。

**同步至 NewReport（使用者實際瀏覽的站台）**：本報表屬於 `newreport-dual-repo-architecture` 定義的「ad-hoc 檔案」，不在任何 bat 的固定同步清單內，更新完 `D:\2025\AI\MongoDB` 後需手動 copy 進 `D:\2025\AI\NewReport` 並 commit + push（`origin`、`company` 兩個 remote 交錯 pull/push，細節見 `REPORT_SPEC_SCHEDULED_TASKS.md` §5.6.3）。

## 7. 相關連結

- 目錄：`HTML_Report_Catalog.html`
- 與 `F_MEM_BlackList_Query_Report.html`（`REPORT_SPEC_F_MEM_BLACKLIST.md`）同屬會員風控查詢系列，資料源相同（`Qware_A_OrderTemp_log_202608`）但用途互補、彼此不互相連結：本報表是**全帳號彙總掃描**（139,781 個帳號，統計值，用來找異常密集帳號）；F 報表 2026/08/05 新增的「訂單紀錄」功能是**查到特定帳號後的個案深挖**（近 7 天逐筆訂單明細：演出/座位/時間/IP，範圍窄很多），詳見 `REPORT_SPEC_F_MEM_BLACKLIST.md` §2.3

---
*建立日期：2026/08/05｜使用者需求為「再查所有帳號有 booking 的紀錄 Qware_A_OrderTemp_log_202608」；詢問後理解為要獨立新建一份「有訂票紀錄的帳號」清單/報表，而非併入 F 報表的既有查詢流程，因此建立本報表。採 `$group` 彙總（非逐筆明細）控制檔案大小，~12.4MB；前端另設 `RENDER_CAP=1000` 避免 14 萬列直接塞進 DOM 卡死頁面（初版沒設上限時實測互動幾乎凍結，加上限後恢復正常）*
*2026/08/05：使用者後續澄清，原本的需求其實是要在 F 報表裡「用電話號碼查出 user_id 後再查其訂單紀錄」，也就是要整合進 F 既有的查詢流程，不是要一份獨立報表——與本報表建立時的理解不同。已在 F 報表新增對應的「訂單紀錄」查詢功能（見上方相關連結），本報表（G）予以保留，作為互補的全帳號彙總視角*
