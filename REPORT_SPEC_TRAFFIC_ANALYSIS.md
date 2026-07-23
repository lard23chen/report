# 流量分析報表 通用技術規範說明

> ⚠️ **存取限制** — 本規範對應的報表已設有 IP 白名單，僅限授權網路存取。


本文件定義所有流量相關報表的共通規範。
目前涵蓋：GA 系統趨勢、DMP Top10、deca joins 流量明細、統一獅 GA 即時分析。

---

## 1. 報表總覽

| 報表 | 腳本 | 資料集合 | 排程 |
|------|------|---------|------|
| A_GA_Traffic_Analysis_Report.html | generate_ga_report.js | GA_MonthlyStats | 每日 08:00 / 15:00；每月 10 日由 daily_update.bat 額外執行 |
| A_DMP_PageView_Report_AllTime_Top10.html | generate_alltime_top10_v3.js | DMP event (trek-first-party-dmp) | 手動 |
| A_DecaJoins_Traffic_Analysis.html | generate_deca_traffic_report.js | Qware_A_Traffic_session_data | 手動 |
| A_UniformLions_GA_Analysis_20260309.html | generate_lions_ga_report.js | QwareTrafficSession / QwareTrafficGAReadTime | 手動 |

---

## 2. GA 系統月度流量分析（A_GA_Traffic_Analysis_Report）

### 資料來源
- DB：`QwareAi` / `GA_MonthlyStats`
- MongoDB 查詢以 `ID` 升序取回，**取回後再依 `YearMonth` 字串升序重新排序**

> ⚠️ 維護注意：`ID` 欄位值不保證與 `YearMonth` 時間順序一致（例如補登月份可能取得較小的 ID）。若只靠 `sort({ ID: 1 })` 會導致新月份插到陣列頭部，圖表時間軸錯亂、資料表順序錯誤、分析區間 header 顯示異常（如 `2026/04 ~ 2026/03`）。2026/05 已確認此問題並修正為 `chartData.sort((a, b) => a.month.localeCompare(b.month))`。

### 資料結構
| 欄位 | 說明 |
|------|------|
| YearMonth | YYYY-MM 格式 |
| A_Total | A 系統當月總 sessions |
| A_Mobile | A 系統手機 sessions |
| D_Total | D 系統總 sessions |
| D_Mobile | D 系統手機 sessions |
| E_Total | E 系統總 sessions |
| E_Mobile | E 系統手機 sessions |

### 視覺樣式（深色 + 青綠強調）

| CSS 變數 | 值 |
|---|---|
| `--bg-color` | `#121212` |
| `--card-bg` | `#1e1e1e` |
| `--accent-color` | `#4DB6AC`（青綠） |
| A 系統色 | `#FF7043`（橘） |
| D 系統色 | `#42A5F5`（藍） |
| E 系統色 | `#66BB6A`（綠） |

### 關鍵組件
1. **KPI 卡片**：A/D/E 各系統總流量 + 手機佔比
2. **每月詳細數據表**：新到舊排列，每列含各系統流量 + MoM 箭頭 + Mobile 佔比
3. **最近月份趨勢分析 (MoM Analysis)**：數據表正下方，由 `generate_ga_report.js` 動態產生，**不得手動寫死在 HTML**（下次執行腳本會整頁覆蓋）。
    *   **格式**：二行文字摘要：📊 流量（三系統各自 ▲/▼ 百分比 + 絕對差）、📱 Mobile 佔比（各系統當月佔比 + 與上月 pp 差）
    *   **樣式**：深灰背景 `#252525`、左側 `3px solid var(--accent-color)` 青綠飾條、`max-width:780px`，h4 使用 `var(--accent-color)` 青綠色
    *   **資料來源**：`chartData` 升序排列後，取最後兩筆（`chartData[length-1]` = 當月、`chartData[length-2]` = 上月）
4. **趨勢折線圖**：多系統月度流量疊加（Chart.js）
5. **手機佔比長條圖**：各系統手機 vs 桌機比例

---

## 3. DMP 歷史 Top 10 活動（A_DMP_PageView_Report_AllTime_Top10）

### 資料來源
- DB：`trek-first-party-dmp` / `event`（獨立 MongoDB 叢集，9M+ docs / ~7GB）
- 連線字串：`讀取 .env 的 MONGODB_URI_DMP（勿寫入文檔）`
- 篩選條件：`name='page_view'`、`bu='D'`、`canonical_url` regex `ticket.ibon.com.tw`
- 索引現況：`content_name` **沒有索引**（`content_name: {$in:[...]}` 這類查詢一律 COLLSCAN 全表掃描）；`name_1_time_-1` 有索引，`{name, time:{$gt:X}}` 可以走 IXSCAN（實測 30 天窗口只需掃 ~76K/9M docs，約 4 秒）——這是 2026/07/23 改成增量架構的關鍵前提

### 核心邏輯（2026/07/23 改為增量架構）

舊版每次執行都對整個 collection 重新聚合 monthly/daily/device/hourly/不重複訪客 5 個維度，每個查詢因為要用沒有索引的 `content_name` 篩選，各要 7-9 分鐘，全部跑完約 40 分鐘。新版把「已處理進度」與「Top10 節目的完整明細」都序列化後內嵌在主報表 HTML 裡（沿用 `generate_ga_events_report.js` 的 `generatedAt` + `/*SD_START*/…/*SD_END*/` 寫法），下次執行時讀回來，只查新資料：

1. **讀狀態**：從既有 `A_DMP_PageView_Report_AllTime_Top10.html` 解析 `generatedAt`（=上次執行時間戳，作為下次查詢的 `time:{$gt:...}` 起點）與內嵌 JSON（`allProgramViews` 全部 382+ 節目的瀏覽量整數表、`top10Detail` 目前 Top10 節目的完整明細）。
2. **無狀態**（本規範上線後第一次執行，或檔案毀損）→ 走全量 bootstrap（等同舊版邏輯，約 40 分鐘一次性成本），結束時把結果序列化存回 HTML。
3. **有狀態** → 只查 `time > lastProcessedTime` 的新資料（走 `name_1_time_-1` 索引，量小、秒級到低分鐘級）：
   - 依 `content_name` 分組拿到這段新資料的 views 增量，加進 `allProgramViews`（含從沒見過的新節目）。
   - 重新排序 `allProgramViews` 取新的 Top10。
   - 舊 Top10 名單裡本來就有追蹤明細的節目 → 把新資料的 monthly/daily/device/hourly/不重複訪客/節目ID 增量併入既有明細（Map 累加、HLL sketch 併入、Set 聯集）。
   - **新面孔擠進 Top10**（原本沒追蹤過明細）→ 針對「這一個」`content_name` 額外跑一次全表歷史掃描補齊完整明細（無法避免，因為沒有 content_name 索引；但只發生在該節目、且只在真的擠進榜單時才觸發，預期很少見）。
   - 掉出 Top10 的節目：只留整數總數在 `allProgramViews`（供之後若重新衝回榜單時判斷排名用），明細直接捨棄。
4. **不重複訪客改用 HyperLogLog 估算**（2026/07/23）：改前是把 `attribution_id`/`fp_id` 完整清單存進頁面，光排名第 1 的節目就有 69,094 個不重複訪客、完整清單要 2-3MB，10 個節目累計恐達 5-8MB，且只會隨時間增長不會變小——與本站控制 GitHub Pages 1GB 上限的既有目標衝突（見 `REPORT_SPEC_ARCHIVE.md`）。改用自製 HyperLogLog（`generate_alltime_top10_v3.js` 內自帶實作，未額外裝 npm 套件，p=14 / 16384 個 register，固定 ~16KB／節目，不隨訪客數增長）：
   - 誤差實測 <1%（單組估算樣本 100~300,000 均落在 ±1% 內，遠優於原先評估的 ~2%）。
   - 可合併（月增量的新訪客直接 `hllAdd` 進舊 sketch），完全符合增量更新需求。
   - 頁面上的「不重複訪客」數字因此標註為「（估算）」。

### 關鍵組件
1. 總覽 KPI（總瀏覽量、活動數）
2. Top 10 排行橫條圖
3. 各活動詳細卡片（每日趨勢、裝置佔比、不重複訪客為 HLL 估算值）
4. **資料起訖時間**（2026/07/23 新增）：header 副標下方顯示「資料起訖：YYYY-MM-DD ~ YYYY-MM-DD」；`dataDateStart` 只在 bootstrap 時查一次（之後不變），`dataDateEnd` 每次增量執行時從新資料的最大日期更新，換算 `Asia/Taipei` 時區

### ⚠️ 資料來源實為滾動 6 個月視窗（2026/07/23 發現）

`trek-first-party-dmp.event` 的 `time` 欄位有 TTL 索引 `expireAfterSeconds: 15768000`（≈182.5 天），MongoDB 會自動刪除超過半年的舊文件——`dataDateStart` 目前落在 2026-01-21（bootstrap 執行當下往回推剛好約 183 天）並非巧合。這代表這份報表雖然標題寫「歷史累積／All-Time」，實際上資料庫本身**只保留滾動 6 個月視窗**，舊版每次全表重跑其實都只反映「當下還沒被 TTL 清掉」的那 6 個月，並非真正的全部歷史。

改成增量架構後，`allProgramViews`／`top10Detail` 會持續累加保存，**不會因為 TTL 把來源文件刪掉就跟著減少**——換句話說，這次改動意外地讓這份報表第一次名符其實地做到「歷史累積」，比舊版全表重跑更接近標題所宣稱的效果。唯一的限制：一個節目若先被擠出 Top10（明細被捨棄，只留整數總數）、之後來源文件又因 TTL 到期被刪除，未來即使它重新衝回 Top10，也無法再用「一次性全表補齊」救回完整明細（因為原始文件已經不在了）——但它的歷史瀏覽量整數本身不受影響，永遠保留。

### 每月自動排程（2026/07/23 新增）

| 項目 | 說明 |
|------|------|
| BAT | `update_dmp_alltime_top10.bat` |
| 排程 | `Qware_DMP_AllTime_Top10_Monthly`：每月 1 日 10:00（`StartWhenAvailable`），刻意避開 08:00 daily/GA 群聚時段 |
| 重複執行保護 | 比對 `dmp_alltime_top10_log.txt` 本月是否已有 `Update finished.` |
| 失敗告警 | 產出或 git push 失敗 → `send_line_notify.ps1 -Template dmp_top10 -Status FAIL` |
| 詳細規範 | 見 `REPORT_SPEC_SCHEDULED_TASKS.md` §6（新增小節） |

> 手動重跑：直接 `node generate_alltime_top10_v3.js` 即可（會自動判斷走增量或 bootstrap，不需要額外參數）。

---

## 4. deca joins 場次流量明細（A_DecaJoins_Traffic_Analysis）

### 資料來源
- DB：`QwareAi` / `Qware_A_Traffic_session_data`
- 篩選：`節目名稱 === 'deca joins 2026 world tour － 在這裡停一下'`

### 場次對照表

| 場次代碼 | 場次名稱 |
|---------|--------|
| B0AQY9PL | 台北站 (5/1) |
| B0ARAQUY | 台北站 (5/2) |
| B0ARARJH | 台北站 (5/3) |
| B0ARASAV | 台中站 (5/8) |
| B0ARATMZ | 高雄站 (5/10) |

### 關鍵組件
1. 各場次總流量摘要卡片
2. 多場次每日折線圖（日期 X 軸）
3. 場次流量明細表（日期 × 場次矩陣）

---

## 5. 統一獅開賣首日 GA 即時分析（A_UniformLions_GA_Analysis）

### 資料來源
- DB：`QwareAi` / `QwareTrafficSession` + `QwareTrafficGAReadTime`
- ActivityID：`39455`
- 時間範圍：`2026-03-09 18:00–18:30`

### 核心邏輯
- 以分鐘為單位（18:00, 18:01, … 18:30）彙整
- `SessionCount` 取各分鐘最大值
- `ActiveUsersDCount` / `ActiveUsersACount`：D/A 系統即時活躍用戶

### 關鍵組件
1. 逐分鐘折線圖（Session + Active Users D/A）
2. 開賣高峰時間點標註

---

## 6. 更新方式

### ⚠️ 維護注意：HTML 與 Generator 必須同步

`A_GA_Traffic_Analysis_Report.html` 由 `generate_ga_report.js` **完整覆蓋產生**（整頁重新生成，非局部替換）。

**凡修改 HTML 中的任何邏輯，必須同步修改 `generate_ga_report.js` 對應位置，否則下次排程執行將整頁覆蓋，修改遺失。**

受影響的功能（歷史上曾被覆蓋過）：
- 最近月份趨勢分析區塊 — 2026/05/21 新增，已同步至 generator（直接嵌入 `momSection` 變數至模板字串）

---

```bash
# GA 月度（固定排程）
node generate_ga_report.js

# 其餘（手動）
node generate_alltime_top10_v3.js
node generate_deca_traffic_report.js
node generate_lions_ga_report.js

git add <report>.html
git commit -m "Update traffic report"
git push origin main
```
