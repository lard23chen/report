> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取（內含 EMAIL / USER_ID 等會員 PII）。

# 會員黑名單標記查詢報表 技術規範說明

本文件定義「會員黑名單標記查詢報表」的產出標準，未來更新或重新產出時請遵循本規範。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `F_MEM_BlackList_Query_Report.html` |
| 產生腳本 | `generate_f_mem_blacklist_query.js` |
| 資料來源 | MongoDB `QwareAi`（`MONGODB_URI_QWARE`）`Qware_MEM_BlackList_202608` collection |
| 資料範圍 | **僅嵌入近 30 天內** `UPDATE_TIME` 且 `MEMO0='Y'` 的資料（見 §2 為何限制範圍） |
| 負責人 | 陳俊良 |
| 主要目的 | 查詢近期被標記為黑名單（`MEMO0='Y'`）的會員帳號，依「異動日期（UPDATE_TIME）」區間與 `USER_ID` 篩選 |

## 2. 為何限制天數範圍（不嵌入全量資料）

`Qware_MEM_BlackList_202608` 總表逾 375 萬筆，其中 `MEMO0='Y'` 有 85,485 筆（2026/08/04 查證）。若整份嵌入靜態頁面，檔案會膨脹到 **~15MB**，是本專案現有報表最大檔案（~500KB 等級）的 30 倍，且每次重新產出都會讓 git repo 再增加 15MB，不符合 `CLAUDE.md` 的容量管理原則。

2026/08/04 與使用者確認後改為：只嵌入最近 `WINDOW_DAYS` 天的 `MEMO0='Y'` 資料，初版為 90 天。當日稍後使用者要求查詢日期改用 `UPDATE_TIME`（而非 `CREATE_TIME`）——因為 `UPDATE_TIME` 恆 ≥ `CREATE_TIME`，同樣 90 天窗篩到的筆數明顯變多（58,622 筆、~10.8MB），使用者接著把窗口縮短為 **30 天**：實測 15,651 筆、檔案 ~2.9MB。**查更早期資料需另行以 MongoDB 查詢，本報表查不到**（頁面 header 有 warning 提示此限制）。

若未來需要查更久遠的歷史資料，選項包括：調大 `generate_f_mem_blacklist_query.js` 裡的 `WINDOW_DAYS` 常數（會讓檔案線性變大，見上面 90 天 vs 30 天的實測對照）、或改用真正的後端 API 即時查詢。

## 3. 資料結構

### 3.1 BLACKLIST_DATA 陣列格式（generator 注入，短欄位名以縮小檔案）

```js
{
  uid:    "32395977337438732472",   // USER_ID
  email:  "0.brick_chipset@icloud.com", // EMAIL（已 trim 前後空白，原始資料常有前導空格）
  mobile: "852",                    // MOBILE_head（國碼，非完整手機號碼）
  ct:     "2026-04-13 14:09:29",    // CREATE_TIME，已轉換為台北時間（+08:00）字串 "YYYY-MM-DD HH:mm:ss"
  ut:     "2026-06-22 09:21:19",    // UPDATE_TIME，同上格式
  cu:     "定期掃描異常帳號",         // CREATE_USER（可能是數字 ID 或掃描系統代稱）
  uu:     "775995263",              // UPDATE_USER
}
```

### 3.2 DATA_META 物件格式（generator 注入）

```js
{ total: 15651, minDate: "2026-07-05", maxDate: "2026-08-03" }
```

- `minDate` / `maxDate`：本次嵌入資料中實際存在的 `UPDATE_TIME` 日期範圍（依台北時間），用於 flatpickr 的 `minDate`/`maxDate` 限制與「N天前」按鈕的錨點
- **錨點設計與 E 系統月報/漏斗報表相同**：quick range 以 `maxDate`（資料集裡最後一天）為錨點，而非日曆今天，避免 generator 執行當下資料還沒同步到今天時選到空日

### 3.3 Section Marker（Generator 注入點）

```
// ── Data Start ──────────────────────────────────────────────────────────────
const BLACKLIST_DATA = […];
const DATA_META = {…};
// ── Data End ────────────────────────────────────────────────────────────────
```

⚠️ **勿修改 marker 字串**，否則 generator 找不到注入點。`<span id="updateTimeLabel">…</span>` 由 generator 以 regex 整段替換為執行當下時間。

## 4. 關鍵組件

### 4.1 查詢條件

| 條件 | 說明 |
|------|------|
| 日期區間 | 依 `UPDATE_TIME`（最後異動時間，非 `CREATE_TIME`）篩選，flatpickr 雙欄位 `#dtFrom`/`#dtTo`，`dateFormat:'Y-m-d'` |
| USER_ID | 文字輸入框 `#uidSearch`，**部分字串比對**（`includes`，非完全相符），即時篩選（`oninput`） |

兩條件為 AND 關係，同時套用於 `applyFilter()`。

### 4.2 預設檢視（2026/08/04 與使用者確認）

頁面載入時自動呼叫 `setQuickRange(3)`，預設顯示「近 3 天」（以 `DATA_META.maxDate` 為錨點）的 `MEMO0='Y'` 資料，不需使用者手動操作。「1天前」「7天前」按鈕提供快速切換，「重置」會清空 USER_ID 搜尋並回到預設 3 天檢視。

### 4.3 結果表格

欄位：USER_ID、EMAIL、MOBILE_head、CREATE_TIME、UPDATE_TIME、CREATE_USER、UPDATE_USER（CREATE_TIME 欄位仍保留顯示與可排序，只是不作為查詢/預設排序依據）。點欄位 header 可排序（`sortTable()`），預設依 UPDATE_TIME 由新到舊。表格上方顯示「符合條件：N 筆」。

### 4.4 IP 白名單保護

比照 E 系統報表機制（`api.ipify.org` 查訪客 IP 比對 9 組授權 IP，不符即整頁換成「存取被拒絕」）。本報表因含 EMAIL / USER_ID 等會員 PII，**建立時就內建此保護**，不是事後補上。清單為手動維護的靜態內容，`generate_f_mem_blacklist_query.js` 只用 marker 區塊替換資料、不會動到 `<head>`。

## 5. MongoDB 連線資訊

| 用途 | Cluster URI | DB | Collection | 篩選 |
|------|-------------|-------|------------|------|
| 近 30 天黑名單資料 | `MONGODB_URI_QWARE` | `QwareAi` | `Qware_MEM_BlackList_202608` | `MEMO0:"Y"`, `UPDATE_TIME >= now - 30天` |

主要欄位：`USER_ID`、`EMAIL`、`MOBILE_head`、`CREATE_TIME`、`UPDATE_TIME`、`CREATE_USER`、`UPDATE_USER`、`MEMO0`（`Y`/`N`/`4`/`null`，只有 `Y` 才是本報表要查的黑名單標記）。collection 只有 `_id` 索引，全表 375 萬筆，`find()` 前務必先用 `MEMO0`+`UPDATE_TIME` 縮小範圍，避免全表掃描。

## 6. 更新方式

```bash
node generate_f_mem_blacklist_query.js
git add F_MEM_BlackList_Query_Report.html generate_f_mem_blacklist_query.js
git commit -m "Update F blacklist query report"
git push origin main
```

**目前沒有排入任何排程**（不在 `daily_update.bat` 等 4 支 bat 的清單內），純手動報表；如需查最新資料，重新執行上述指令即可（30 天滾動窗會自動往前移）。

**同步至 NewReport（使用者實際瀏覽的站台）**：本報表屬於 `newreport-dual-repo-architecture` 定義的「ad-hoc 檔案」，不在任何 bat 的固定同步清單內，更新完 `D:\2025\AI\MongoDB` 後需手動 copy 進 `D:\2025\AI\NewReport` 並 commit + push（`origin`、`company` 兩個 remote 交錯 pull/push，細節見 `REPORT_SPEC_SCHEDULED_TASKS.md` §5.6.3）。

## 7. 相關連結

- 目錄：`HTML_Report_Catalog.html`

---
*建立日期：2026/08/04｜使用者需求為「用日期 + USER_ID 查詢 MEMO0='Y' 的黑名單資料」；因全量 85,485 筆嵌入會產生 ~15MB 異常檔案，與使用者確認後改為只嵌入近 90 天，預設檢視為近 3 天*
*2026/08/04：使用者要求日期查詢欄位改用 `UPDATE_TIME`（原為 `CREATE_TIME`），同步修改 generator 查詢條件/排序與頁面篩選邏輯；因 `UPDATE_TIME` 恆 ≥ `CREATE_TIME`，同樣 90 天窗篩到的筆數從 25,272 增至 58,622，檔案從 ~4.6MB 增至 ~10.8MB*
*2026/08/04：使用者要求把 `WINDOW_DAYS` 從 90 縮短為 30，筆數降到 15,651、檔案降到 ~2.9MB*
