# 自動排程程式 技術規範說明

本文件定義 Qware 報表系統中所有自動化排程的設定、執行邏輯與維護規範，涵蓋兩套機制：

1. **雲端 Claude Code Routines**（2026/07/20 一度轉為主力，2026/07/22 已全數停用，見 §0）
2. **本地 Windows 工作排程器**（Task Scheduler；2026/07/22 起恢復為唯一主力，見 §1～§5）

> **現況（2026/07/22）**：雲端 routine 實驗已結束，5 個 routine 全部 `enabled: false`（保留設定、未刪除，可隨時 `RemoteTrigger update` 重新啟用）。所有報表更新恢復由本地 Windows 排程 + BAT 負責，詳見 §1。同日也修復了本地排程本身的重複觸發問題（`Qware_Daily_Report_Update` 已停用，只留 `_Final`），見 §1 備注與 §6.3 追記。

---

## 0. 雲端 Routines（2026/07/20～07/22，已全數停用）

### 0.1 遷移背景

- 本地排程的 `git push` 自 2026/07/18 起持續失敗（`could not read Username for 'https://github.com': terminal prompts disabled`——排程 session 拿不到 Git Credential Manager 憑證，且 §6.3 的認證不互動防護讓它直接失敗而非掛死），8 個 commit 積在本地、GitHub Pages 停更兩天，2026/07/20 人工推上後發現。
- 雲端其實早已存在 daily / GA 兩個 routine（2026/03～04 建立），但 prompt 沒有提供 `MONGODB_URI_QWARE` 等環境變數（`.env` 不在版控內，雲端 checkout 拿不到），**從建立以來每次執行都在 MongoDB 連線步驟失敗，從未成功推過 commit**——git 歷史中所有 auto-update commit 都是本地格式可資佐證。
- 雲端執行環境由平台管理 GitHub 認證，從根本繞開本地憑證問題；DB 為 MongoDB Atlas（`for-aws-loadtest.f0fpg.mongodb.net` / `qware-dmp-ver-7.f0fpg.mongodb.net`），雲端可直連（Azure 費用月報 routine 已採同一模式）。

### 0.2 Routine 總覽

管理介面：https://claude.ai/code/routines （cron 一律為 UTC，下表已換算台北時間）

| Routine 名稱 | ID | 排程（台北） | cron (UTC) | 對應本地 BAT | 動作摘要 |
|---|---|---|---|---|---|
| `A_Qware_Revenue_Report_Daily` | `trig_01R1A81agyceiAcPC3A2YoVU` | 每日 09:00 | `0 1 * * *` | `daily_update.bat` | 8 支日報腳本 + 每月 2 號 monthly / 10 號 GA 條件任務 + push + LINE(daily) |
| `GA_Events_Traffic_Report_0800_1400` | `trig_01EYHDHBUybeGd1VJrSFHzWC` | 每日 08:00、14:00 | `0 0,6 * * *` | `update_ga_report.bat` | generate_ga_events_report.js + push + LINE(ga)；下午時段為 14:00（本地舊制為 15:00） |
| `A_Qware_Revenue_Report_Weekly` | `trig_01Dita12Gv75Tj5aTC2a6fV1` | 每週四 08:30 | `30 0 * * 4` | `weekly_update.bat` | generate_a_weekly_report.js + 選擇性 git add（同本地）+ push |
| `Travel_Expense_Shopping_Report_Daily` | `trig_012LmxVeLKcMNRU3jkCEQo73` | 每日 06:00 | `0 22 * * *` | `travel/auto_update.bat` | 下載 Google Sheets CSV ×2 + 參考網頁 → 兩支報表 + push + LINE(travel) |
| `Azure Cost Report Monthly Update` | `trig_015BVnunn5oAJHC5KJgGbc4L` | 每月 16 號 15:00 | `0 7 16 * *` | —（原生雲端） | 見 `REPORT_SPEC_AZURE_COST.md` |

### 0.3 Prompt 設計要點（新增/修改 routine 時遵循）

1. **環境變數**：`.env` 不在版控內，雲端拿不到；MongoDB 連線字串必須在 prompt 內以 `export MONGODB_URI_QWARE='...'` 提供（比照 Azure routine）。daily 另需 `MONGODB_URI_DMP`（cart_data 與 e_dmp_funnel 兩支腳本用）。
2. **時區**：雲端環境非台北時區，凡日期判斷（每月 2 號/10 號）與 commit message 時間戳一律用 `TZ='Asia/Taipei' date ...`。
3. **commit message**：沿用本地格式並加 `(cloud)` 後綴（如 `Auto Update Daily Reports: 2026/07/20 09:00:00 (cloud)`），方便從 git 歷史區分執行來源。
4. **push 防護**：push 前先 `git pull --rebase origin main`；無檔案變更則跳過 commit/push。
5. **LINE 通知**：雲端無法跑 `send_line_notify.ps1`，改在 prompt 內用 `curl -X POST` 直打 API（endpoint/token 同 ps1），訊息註明「（雲端排程）」。
6. **失敗處理**：MongoDB/CSV 連線失敗重試上限 2 次；失敗時發 LINE 說明，並在回報註明可能需把雲端 IP 加入 Atlas Network Access 白名單。
7. **機密**：連線字串與 LINE token 只放 routine prompt，嚴禁寫入任何會 commit 的檔案。

### 0.4 驗證結果與停用（2026/07/22）

- 2026/07/20～07/22 期間多次手動觸發 daily / GA routine 驗證，`last_fired_at` 顯示排程確實有依 cron 觸發，但 git 歷史中**從未出現任何帶 `(cloud)` 後綴的 commit**——即使已補上 §0.3 環境變數、遠早於本地排程時段觸發（如 GA routine 08:08 台北 vs 本地 08:43），仍無法排除是「MongoDB Atlas 連線失敗」還是「無資料變更所以正確跳過 commit」，因為雲端 session 的執行過程無法從本地或 API 直接查看，只能到 https://claude.ai/code 逐一開啟 session 記錄核對。
- 研判最可能原因：MongoDB Atlas Network Access 白名單未涵蓋雲端執行環境的（非固定）出口 IP，導致連線逾時；此問題本次未實際驗證解決（白名單需使用者自行到 Atlas 加入 `0.0.0.0/0` 後才能確認）。
- 2026/07/22：使用者決定放棄雲端 routine 路線，改為**全部恢復本地排程**（本地雖有本次修好的併發競爭問題，見 §6.3 追記，但至少報表資料本身是正確產生的，只是 git 層面偶發遺失，相對雲端「完全不確定是否連得上 DB」更可控）。5 個 routine（daily / GA / weekly / travel / Azure 月報）已全數 `enabled: false`。
- **API 不支援刪除 routine**，僅能停用；如需徹底移除，需使用者自行到 https://claude.ai/code/routines 操作。
- 本地排程（§1 總覽表全部 + HKCU Run 機碼 `QwareDailyReport`，見 §6.2）維持原樣繼續執行，不需改動。

---

## 1. 排程總覽（本地 Windows，2026/07/22 起恢復為唯一主力）

| 排程名稱 | BAT 檔 | 觸發時間 | 最後執行 | 狀態 |
|---------|--------|---------|---------|------|
| `Qware_Daily_Report_Update` | `daily_update.bat` | 每日 08:00 | — | **Disabled（2026/07/22）** |
| `Qware_Daily_Report_Update_Final` | `daily_update.bat` | 每日 08:00 | 2026/07/22 08:42（成功，git 記錄） | Ready |
| `Qware_Monthly_Report_Update` | `daily_update.bat` | 每月 2 日 08:30 | 2026/07/02 08:42（成功，git 記錄） | Ready |
| `Update_GA_Report_0800` | `update_ga_report.bat` | 每日 08:00 | 2026/07/06 15:00（成功，git 記錄） | Ready |
| `Update_GA_Report_1500` | `update_ga_report.bat` | 每日 15:00 | 同上 | Ready |
| `TravelExpenseUpdate` | `travel/auto_update.bat` | 每日 06:00 | 2026/07/23 08:08（失敗，Result=1，見 §6.3 追記；已人工補跑） | **Disabled（2026/07/23）** |
| `Qware_Weekly_Report_Update` | `weekly_update.bat` | 每週四 08:30 | 2026/07/09 10:21（建立時手動驗證成功，git `fe5673f`） | Ready |
| `Qware_DMP_AllTime_Top10_Monthly` | `update_dmp_alltime_top10.bat` | 每月 1 日 10:00 | 2026/07/23（建立時手動驗證，見 §5.5） | Ready |
| `QwareDailyReport`（HKCU Run） | `daily_update.bat` | 每次使用者登入 | — | 常駐 |

> **備注**：`Qware_Daily_Report_Update` 與 `Qware_Daily_Report_Update_Final` 原本執行相同的 BAT、觸發時間也相同（皆 08:00），設計上是「兩者並存確保至少一個成功觸發」的備援措施——但 2026/07/22 發現這個備援設計本身就是 §6.3 追記事故的根源（兩者同時觸發、同時各自產出報表、同時搶 git，其中一份報表被另一支排程的 autostash 誤吞）。已停用原始版 `Qware_Daily_Report_Update`，只保留設定較完整的 `_Final`（有 `WorkingDirectory`、`StartWhenAvailable=True` 可補跑、`ExecutionTimeLimit=1H` 較短），從根本消除同時觸發的可能。
> 因帳號非系統管理員，無法將排程設定為「不論是否登入都執行」，改以 HKCU Run 機碼作為登入補跑機制。
> **2026/07/20～07/22**：曾短暫規劃由雲端 routines 接手（§0），但雲端連線狀況無法確認、且本地已能正常產出報表，2026/07/22 決定放棄雲端路線，本表任務與 HKCU Run 機碼維持原樣繼續運作，不停用。
> **2026/07/23**：`TravelExpenseUpdate` 已停用（使用者要求）；`travel/auto_update.bat` 與對應報表本身未刪除，僅排程停止觸發。已同步從 `HTML_Report_Catalog.html` 移除對應列（原 S4），並在 `Scheduled_Tasks_Dashboard.html` 標示為已停用。

---

## 2. daily_update.bat

### 2.1 基本資訊

| 項目 | 說明 |
|------|------|
| 路徑 | `D:\2025\AI\MongoDB\daily_update.bat` |
| 對應排程 | `Qware_Daily_Report_Update`（每日 08:00）、`Qware_Daily_Report_Update_Final`（每日 08:00）、`Qware_Monthly_Report_Update`（每月 2 日 08:30） |
| 執行目錄 | `D:\2025\AI\MongoDB` |
| Node 執行檔 | `D:\nodejs\node.exe` |

### 2.2 執行步驟

```bat
# 0. 重複執行保護（2026/06/10 新增）
if daily_log.txt 已有今日 "Update Completed" → exit /b 0（寫入 "Already completed today, skipping."）

node generate_a_daily_report.js                    → A_Qware_Revenue_Report_Daily.html
node generate_d_ga_funnel_report.js                → D_GA_Funnel_202606_Report.html
node generate_d_ga_funnel_cart_data.js             → D_GA_Funnel_202606_Report.html（A購物車/結帳每日資料，2026/07/14 加入排程）
node generate_e_dmp_funnel_report.js               → E_DMP_Funnel_Report.html
node update_index_stats.js                         → report_index.html（統計表 + Tab1 月份卡片）
if 今日為2日:  node generate_monthly_report.js     → A_Qware_Revenue_Report_YYYY年MM月_分析報表.html
if 今日為10日: node generate_ga_report.js          → A_GA_Traffic_Analysis_Report.html
# 每個 node script 之後檢查 errorlevel，失敗只記進 FAILED_STEPS 變數、不中斷（2026/07/23 新增）
# —— 維持既有 best-effort 精神：其他成功產出的報表仍照常 commit/push，不因單一 script 出錯而全部卡住
git add . && git commit -m "Auto Update Daily Reports: ..."
git pull --rebase --autostash origin main（失敗則 git rebase --abort）
git push origin main（git 輸出寫入 git_sync.log，見 §6.3；失敗也記入 FAILED_STEPS）
if FAILED_STEPS 非空: powershell send_line_notify.ps1 -Template "daily" -Status "FAIL" -Detail "<失敗的 script 清單>"
else:                 powershell send_line_notify.ps1 -Template "daily"  → LINE 完成通知
```

> ⚠️ 結尾的 `git add .` 會把**當下工作區所有未提交變更**一起 commit 進去。若在排程觸發時段（08:00 前後、登入補跑、15:00 GA 排程）有進行中的手動修改，可能被自動 commit 收走（2026/07/06 曾發生，見 git `f0e940e`）。
> **失敗告警（2026/07/23 新增）**：與 §4（travel）不同，daily 的每個 node script 出錯只記錄到 `FAILED_STEPS` 變數（用 `;` 分隔的 script 檔名清單），流程照樣往下跑完所有步驟並 push——這是刻意保留的既有行為，因為多支獨立 script 之間沒有依賴關係，某一支失敗（例如 MongoDB 逾時）不該連累其他已成功的報表沒推上去。最後只有一個判斷點：`FAILED_STEPS` 非空（含任何 script 或 git push 失敗）就發 `-Status FAIL` 告警並列出失敗清單，否則照常發送成功通知；不會同一次執行收到兩則通知。
> **停止每日自動更新（2026/07/23，使用者要求）**：`generate_kaohsiung_beer_festival_report.js`（`A_KaohsiungBeerFestival_2026.html`）、`generate_d_ga_clickdata_report.js`（`D_GA_ClickData_Webb_202606_Report.html`）、`generate_d_ga_pageview_report.js`（`D_GA_PageViewData_Webb_202606_Report.html`）三支 script 已從 `daily_update.bat` 移除。三支 script 檔案與對應 HTML 報表本身**都沒有刪除**，只是不再排入每日排程；如需更新改為手動執行對應 script。已確認 `generate_d_ga_funnel_report.js`／`generate_d_ga_funnel_cart_data.js`（仍保留在每日排程內）是直接查詢 MongoDB `GA_D_ClickData_Webb_202606`／`GA_D_PageViewData_Webb_202606` collection，不依賴這三支被移除 script 產出的 HTML，故移除後不影響 D 系統轉換漏斗報表的每日更新。

### 2.3 產出報表

| 腳本 | 產出 HTML | 資料來源 | 說明 |
|------|----------|---------|------|
| `generate_a_daily_report.js` | `A_Qware_Revenue_Report_Daily.html` | MongoDB `Qware_A_Ticket_data_Daily` | A 系統每日營業快訊 |
| `generate_d_ga_funnel_report.js` | `D_GA_Funnel_202606_Report.html` | MongoDB `QwareAi.GA_D_PageViewData_Webb_202606` + `GA_D_ClickData_Webb_202606` | 瀏覽→點擊轉換漏斗；2026/07/06 起含每日明細與日期陣列（PV_BY_DATE / CLICK_ACT_DAILY / PV_DATES / CL_DATES）全自動更新 |
| `generate_d_ga_funnel_cart_data.js` | `D_GA_Funnel_202606_Report.html` | MongoDB DMP `trek-first-party-dmp.event`（bu:"A"）+ `GA_D_ClickData_Webb_202606`（join key） | A購物車/結帳每日資料（CART/PURCHASE_BY_DATE）；**2026/07/14 起加入每日排程**（先前需手動執行，曾造成日期選 7/3 後購物車/結帳無資料；執行約 95 秒） |
| `generate_e_dmp_funnel_report.js` | `E_DMP_Funnel_Report.html` | MongoDB `trek-first-party-dmp.event`（bu:"E"） | E 系統瀏覽→購買轉換漏斗（張數/金額/轉換率）；單一腳本重新聚合全部資料並注入 Data marker 區塊；2026/07/07 起加入排程 |
| `update_index_stats.js` | `report_index.html` | MongoDB `Qware_Ticket_Data` | 月份統計表、趨勢圖、Tab1 本月報表卡片；每日執行 |
| `generate_monthly_report.js` | `A_Qware_Revenue_Report_YYYY年MM月_分析報表.html` | MongoDB `Qware_Ticket_Data` | 上月完整分析報表；**僅每月 2 日執行**（bat 內有日期判斷） |

> **2026/07/23 移除（使用者要求）**：`generate_kaohsiung_beer_festival_report.js`（`A_KaohsiungBeerFestival_2026.html`）、`generate_d_ga_clickdata_report.js`（`D_GA_ClickData_Webb_202606_Report.html`）、`generate_d_ga_pageview_report.js`（`D_GA_PageViewData_Webb_202606_Report.html`）不再是 daily_update.bat 的一部分。script 檔案與已產出的 HTML 都保留在原位，只是停止每日自動觸發；如需更新請直接 `node <script名>` 手動執行。

### 2.4 Log 輸出

執行過程與時間戳記寫入 `daily_log.txt`：

| 訊息 | 說明 |
|------|------|
| `[date time] Starting Daily Report Update...` | 正常開始 |
| `[date time] Update Completed.` | 全流程完成（作為重複執行判斷依據） |
| `[date time] Already completed today, skipping.` | 今日已完成，略過（HKCU Run 補跑時觸發） |

---

## 3. update_ga_report.bat

### 3.1 基本資訊

| 項目 | 說明 |
|------|------|
| 路徑 | `D:\2025\AI\MongoDB\update_ga_report.bat` |
| 對應排程 | `Update_GA_Report_0800`（每日 08:00）、`Update_GA_Report_1500`（每日 15:00） |
| 執行目錄 | `D:\2025\AI\MongoDB` |

### 3.2 執行步驟

```bat
node generate_ga_events_report.js    → A_GA_Events_Traffic_Report.html    # 失敗 goto :fail_generate（2026/07/23 新增）
git add . && git commit -m "Auto-update GA Traffic Reports: ..."
git pull --rebase --autostash origin main（失敗則 git rebase --abort）
git push origin main（git 輸出寫入 git_sync.log，見 §6.3）              # 失敗 goto :fail_push（2026/07/23 新增）
powershell send_line_notify.ps1 -Template "ga"  → LINE 完成通知
# :fail_generate / :fail_push：powershell send_line_notify.ps1 -Template "ga" -Status "FAIL" -Detail "..."，exit /b 1
```

> **失敗告警（2026/07/23 新增）**：延續 travel/weekly 的「單一報表 script，出錯即中斷＋告警」模式。此 bat 本來就沒有專屬 log 檔（不像 daily/weekly/travel 各有 `*_log.txt`），這次也沒有新增——沿用原樣只靠 LINE 通知與 `git_sync.log`。**沒有加重複執行保護**：GA 一天觸發兩次（08:00／15:00）是刻意設計（見 §3.4，抓不同時間點的數據），加上「今日已完成跳過」會讓 15:00 那次被誤判跳過，因此與 daily/weekly/travel 不同，這裡維持每次觸發都執行。

| 腳本 | 產出 HTML | 資料來源 | 說明 |
|------|----------|---------|------|
| `generate_ga_events_report.js` | `A_GA_Events_Traffic_Report.html` | MongoDB `Qware_A_Traffic_session_data` | GA 事件流量深度分析（每分鐘 Session / 訂單 / 張數） |

### 3.4 雙時段設計

- **08:00**：取得前一天結算後的完整數據
- **15:00**：取得當日上午到下午的即時更新數據

---

## 4. travel/auto_update.bat（排程已於 2026/07/23 停用）

### 4.1 基本資訊

| 項目 | 說明 |
|------|------|
| 路徑 | `D:\2025\AI\MongoDB\travel\auto_update.bat` |
| 對應排程 | `TravelExpenseUpdate`（每日 06:00，**已停用**） |
| 執行目錄 | `D:\2025\AI\MongoDB\travel` |
| Log 檔 | `travel\update_log.txt` |

### 4.2 執行步驟

```bat
# 0. 重複執行保護（2026/07/23 新增，比照 daily/weekly_update.bat）
if update_log.txt 已有今日日期 + "Update finished." → exit /b 0（寫入 "Already completed today, skipping."）

# 1. 下載主要花費 CSV（Google Sheets → new_analysis_data.csv）→ 失敗 goto :fail_download
# 2. node generate_expense_report.js → expense_report.html → 失敗 goto :fail_generate
# 3. 下載購物 CSV（Google Sheets GID:1320702581 → new_data_gid_1320702581.csv）→ 失敗 goto :fail_download
# 4. 下載參考網頁（→ reference_site.html）→ 失敗 goto :fail_download
# 5. node generate_shopping_report.js → shopping HTML → 失敗 goto :fail_generate
# 6. git add . && git commit → git pull --rebase --autostash → git push origin main（見 §6.3）→ push 失敗 goto :fail_push
# 7. 寫入 "%DATE% %TIME% - Update finished."（含時間戳，供步驟 0 比對）→ LINE 成功通知
#    任一 :fail_* 分支：寫入對應錯誤訊息 + LINE 失敗告警（send_line_notify.ps1 -Status FAIL -Detail "..."）+ exit /b 1
```

> **2026/07/23 新增背景**：07/23 發生 `TravelExpenseUpdate` 排程中途無聲中止（見 §6.3 追記），事後才由使用者發現並人工補跑。原本的 bat 沒有任何一步驟做 errorlevel 檢查，也沒有失敗告警，只要中途出錯（CSV 下載失敗、node script 出錯、git push 失敗）都會靜默結束，且因為 `Update finished.` 沒有時間戳可比對，就算加了保護也難以判斷「今天到底跑完了沒」。這次一併補上：① 每個關鍵步驟後檢查 `errorlevel`，失敗立即 `goto` 到對應失敗分支並發 LINE 告警＋`exit /b 1`；② `Update finished.` 改為含日期時間戳寫法，讓開頭的「今日已完成」比對可用；③ `send_line_notify.ps1` 新增 `-Status FAIL -Detail "..."` 參數（預設 `OK`，不影響 daily/ga/weekly 既有呼叫方式），失敗訊息格式為「⚠ 旅遊記帳 + 購物清單報表更新失敗」+ 原因 + 執行時間。
> **已知限制**：這套機制能攔到的是「指令回傳非 0」這類明確失敗；07/23 事故本質是整個 cmd 行程在跑到 push 前就被中止（無殘留鎖、無掛住行程，事後也查不出確切原因），若同類「行程整個消失」再次發生，本次補的 errorlevel 檢查仍然攔不到——只能靠「今日已完成」保護在下次觸發（如有）時避免用舊資料誤判為已完成，或使用者察覺報表沒更新後人工介入。

### 4.3 產出報表

| 腳本 | 產出 HTML | 資料來源 | 說明 |
|------|----------|---------|------|
| `generate_expense_report.js` | `travel/expense_report.html` | Google Sheets（旅遊花費，ID: `1pZCR_...`） | 旅遊花費日記帳分析 |
| `generate_shopping_report.js` | `travel/shopping_report.html` | Google Sheets（購物清單，GID: `1320702581`） | 購物消費明細報表 |

### 4.4 Google Sheets 來源

| 用途 | Sheets ID | Export 方式 |
|------|----------|------------|
| 旅遊花費 | `1pZCR_nVgyhwYldCRxfum4AsC-vxSFdjnkqAotzeV1CI` | `export?format=csv&gid=0` |
| 購物消費 | `1fgJbzRvnn-4VUbn6PIMh2PyDpxkNPJo8MbuEj4pNt1M` | `export?format=csv&gid=1320702581` |

---

## 5. weekly_update.bat

### 5.1 基本資訊

| 項目 | 說明 |
|------|------|
| 路徑 | `D:\2025\AI\MongoDB\weekly_update.bat` |
| 對應排程 | `Qware_Weekly_Report_Update`（每週四 08:30，設有 `StartWhenAvailable` 錯過補跑） |
| 執行目錄 | `D:\2025\AI\MongoDB` |
| Log 檔 | `weekly_log.txt` |
| 建立日期 | 2026/07/09 |

### 5.2 執行步驟

```bat
# 0. 重複執行保護：weekly_log.txt 已有今日 "Weekly Update Completed" → skip
node generate_a_weekly_report.js                    # 失敗 goto :fail_generate（2026/07/23 新增）
#   → A_Qware_Revenue_Report_Weekly_YYYYMMDD-YYYYMMDD.html（上週四~本週三，排除B開頭訂單，每週獨立檔案）
#   → 自動在 report_index.html tab7 插入本週卡片（最新在最上方）
#   → 自動更新 HTML_Report_Catalog.html 週報列連結與時間戳
git add A_Qware_Revenue_Report_Weekly_*.html report_index.html HTML_Report_Catalog.html weekly_log.txt
git commit -m "Auto Update Weekly Report: ..."
git pull --rebase --autostash origin main（失敗則 git rebase --abort）
git push origin main（git 輸出寫入 git_sync.log，見 §6.3）→ 失敗 goto :fail_push（2026/07/23 新增）
# :fail_generate / :fail_push 都會 log 錯誤並發 LINE 告警（send_line_notify.ps1 -Status FAIL -Detail "..."），exit /b 1
```

> **失敗告警（2026/07/23 新增）**：只有單一報表 script，沿用與 travel 相同的「出錯就中斷＋告警」設計（不像 daily 是多支獨立 script 的 best-effort 模式）。**注意**：weekly 原本就沒有成功時的 LINE 通知（只有 daily/GA/travel 有），這次只補上失敗告警，沒有新增成功通知，避免改變既有的通知行為。

> 與 `daily_update.bat` 不同，此 BAT 的 `git add` **只加入週報 HTML 與 log**（非 `git add .`），避免把工作區其他未提交變更一起收走（§2.2 已知問題）。
> 總目錄 `HTML_Report_Catalog.html` 的「⏰ 自動排程程式」區有對應的 **S3 列**（2026/07/13 加入）；`generate_a_weekly_report.js` 的 `updateCatalogRow()` 會同時自動更新週報列（編號 45）與 S3 列的最新檔名連結和執行時間戳（run-time regex 使用 `/g`，S3 列說明文字刻意寫「每週四早上 8:30」以避開該 regex 的「每週四 08:30」樣式）。
> 重複執行保護的日期比對使用 `findstr /c:"%TODAY%"`（不含 `[` 前綴），因 `%date%` 格式在互動 shell 與排程器下可能不同（`週四 2026/07/09` vs `2026/07/09 週四`）。

### 5.3 執行時間設計

- **每週四 08:30**：此時「上週四～本週三」一整週資料已完整；資料來源 `Qware_A_Ticket_data_Daily` 為滾動集合（約保留 8 天），週四執行可趕在週初資料被清掉前取得完整一週。
- 錯過時段（電腦關機/鎖定）由 `StartWhenAvailable` 於下次開機可用時補跑；BAT 內重複執行保護避免同日重跑。

---

## 5.5 update_dmp_alltime_top10.bat（2026/07/23 新增）

### 5.5.1 基本資訊

| 項目 | 說明 |
|------|------|
| 路徑 | `D:\2025\AI\MongoDB\update_dmp_alltime_top10.bat` |
| 對應排程 | `Qware_DMP_AllTime_Top10_Monthly`（每月 1 日 10:00，`StartWhenAvailable`） |
| 執行目錄 | `D:\2025\AI\MongoDB` |
| Log 檔 | `dmp_alltime_top10_log.txt` |
| 對應報表 | `A_DMP_PageView_Report_AllTime_Top10.html`（規範見 `REPORT_SPEC_TRAFFIC_ANALYSIS.md` §3） |

> **排程時間刻意選在 10:00**：現有 08:00 有 daily/GA 群聚，過去發生過同時起跑互搶 git 的事故（見 §6.3）；weekly 08:30 也在附近。10:00 與其他排程完全錯開，不需要額外靠 git 互斥鎖以外的保護。

### 5.5.2 執行步驟

```bat
# 0. 重複執行保護：dmp_alltime_top10_log.txt 已有本月（YYYY/MM）"Update finished." → skip
node generate_alltime_top10_v3.js                   # 失敗 goto :fail_generate
#   自動判斷：主報表 HTML 內有無 generatedAt/SD_START 狀態標記
#     無 → 全量 bootstrap（首次執行，約 40 分鐘一次性成本）
#     有 → 只查 time > 上次執行時間的新資料，通常秒級到低分鐘級（見 TRAFFIC_ANALYSIS.md §3 核心邏輯）
#   → A_DMP_PageView_Report_AllTime_Top10.html + dmp_details_alltime/*.html（10 份明細頁）
git add A_DMP_PageView_Report_AllTime_Top10.html dmp_details_alltime\*.html dmp_alltime_top10_log.txt
git commit -m "Auto-update DMP AllTime Top10 report: ..."
git pull --rebase --autostash origin main（失敗則 git rebase --abort）
git push origin main（git 輸出寫入 git_sync.log，見 §6.3）→ 失敗 goto :fail_push
# :fail_generate / :fail_push：log 錯誤 + send_line_notify.ps1 -Template dmp_top10 -Status FAIL -Detail "..."，exit /b 1
# 成功：send_line_notify.ps1 -Template dmp_top10（無 -Status，預設 OK）
```

> 與 `weekly_update.bat` 相同，`git add` **只加入報表本身相關檔案**（非 `git add .`），避免收走工作區其他未提交變更。
> 重複執行保護用 `findstr /c:"%THISMONTH%"`（`YYYY/MM`，不含日）比對，邏輯上等同 daily/weekly 的當日保護，只是週期改成當月——即使 `StartWhenAvailable` 在同一個月內因補跑觸發第二次，也會直接略過（增量架構本身也支援安全重跑，這層保護只是省一次不必要的 DB 連線）。

### 5.5.3 不重複訪客估算（HyperLogLog）

明細頁「不重複訪客」欄位改標註「（估算）」，實作與取捨見 `REPORT_SPEC_TRAFFIC_ANALYSIS.md` §3——簡言之：完整訪客 ID 清單會讓報表 HTML 隨時間不斷長大（估算可達 5-8MB 以上且只增不減），改用固定大小（~16KB／節目）的 HyperLogLog sketch，誤差實測 <1%。

---

## 6. 維護注意事項

### 6.1 常見錯誤碼

| 錯誤碼 | 代號 | 常見原因 | 處理方式 |
|--------|------|---------|---------|
| `2147946720`（`0x800710E0`） | `ERROR_REQUEST_REFUSED` | **同一排程的前一執行個體仍在執行**（事件 322，新啟動被拒；2026/07/13 實際案例為 git push 掛死 17 小時）、Node.js 路徑錯誤、MongoDB 逾時 | 查事件檢視器 `TaskScheduler/Operational`；找出掛住的 git/cmd 程序砍掉（需 admin，排程為最高權限執行）；查 `daily_log.txt` |
| `-2147020576`（`0x80070520`） | `ERROR_NO_SUCH_LOGON_SESSION` | 排程觸發時電腦已鎖定（Interactive only 限制） | 登入後由 HKCU Run 機碼自動補跑；或手動執行 BAT |
| `255`（`0x800700FF`，秒殺且 log 零輸出） | — | **BAT 檔行尾被存成 LF-only**，cmd 解析錯亂（把 `::` 註解當程式碼解析，如 2026/07/15 的 `needs was unexpected at this time`）；常見於以非 Windows 工具編輯 bat 之後 | 檢查行尾（`bareLF` 應為 0），轉回 CRLF；`.gitattributes` 已強制 `*.bat eol=crlf`；手動跑 `cmd /c xxx.bat` 可立即重現錯誤訊息 |

**排查步驟：**
1. 查看 `daily_log.txt` 確認 Node.js 輸出與完成時間戳
2. 確認 `Qware_Daily_Report_Update_Final` 是否成功（Result: 0）
3. 手動執行 BAT 確認錯誤訊息

### 6.2 登入補跑機制（HKCU Run）

因帳號為非系統管理員，無法將排程 Logon Mode 改為「不論是否登入都執行」，改採以下替代方案：

- **位置**：`HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run\QwareDailyReport`
- **值**：`cmd /c "D:\2025\AI\MongoDB\daily_update.bat" > nul 2>&1`
- **效果**：每次使用者登入時觸發；BAT 內的重複執行保護確保當天已完成時自動略過

移除或查看此設定：
```powershell
# 查看
Get-ItemProperty "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "QwareDailyReport"
# 移除
Remove-ItemProperty "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "QwareDailyReport"
```

### 6.3 Git 同步防護（2026/07/13 新增）

**背景（2026/07/13 事故）**：遠端 main 被其他機器推入新 commit 後，四支 BAT 的 `git push` 因 non-fast-forward 連續失敗（7/11～7/12 共 4 個 commit 推不上去，GitHub Pages 停在 7/10）。同時 git push / git-credential-manager 在排程 session 中等待認證輸入而**掛死超過 17 小時**，造成：
1. 掛住的執行個體讓 `Update_GA_Report_0800` 被排程器拒絕啟動（事件 322，錯誤碼 `0x800710E0`）
2. 掛死的 GCM 程序繼承了 `daily_log.txt` 的重導向 handle 並鎖住檔案，導致隔天 daily_update.bat 所有 `>> daily_log.txt` 指令重導向失敗而被 cmd 跳過——**整個 BAT 7 秒空跑完、回傳 0、報表完全沒更新**

**四支 BAT（daily / ga / weekly / travel）統一加入的防護**：

| 防護 | 作法 | 目的 |
|------|------|------|
| 認證不互動 | `set GIT_TERMINAL_PROMPT=0`、`set GCM_INTERACTIVE=never` | git 需要認證時直接失敗，不再無限等待輸入而掛死 |
| push 前先 rebase | commit 後執行 `git pull --rebase --autostash origin main`，失敗則 `git rebase --abort` | 遠端有其他機器的 commit 時自動接上，避免 non-fast-forward 被拒 |
| git 輸出隔離 | pull/push 輸出改導向 `git_sync.log`（已加入 `.gitignore`） | 即使 git 程序掛死鎖住 log，也不會鎖到 `daily_log.txt` 等主 log 而癱瘓整個報表流程 |

> 掛死程序的清理需系統管理員權限（排程以「最高權限」執行）：`schtasks /End /TN <排程名>` 結束執行個體後，再以提權 `taskkill /F /PID <pid>` 清掉殘留的 git / git-credential-manager。找出鎖檔案的程序可用 Restart Manager API（rstrtmgr.dll）。

**Git 互斥鎖（2026/07/14 新增）**：電腦晚開機時，多個排程會被 StartWhenAvailable 擠在同一時刻補跑（2026/07/14 三個排程同時 08:14:14 啟動），造成 git 操作互踩——實際事故：GA 排程的 `pull --rebase --autostash` 把 daily 排程剛產生、還沒 commit 的報表收進 autostash，接著 rebase 因另一實例的 `index.lock` 衝突當掉，autostash 沒有還原，**三份報表的當日更新遺失**（每日快訊/啤酒節/ClickData），且殘留 `.git/rebase-merge` 目錄會害後續 rebase 全部失敗。
> 對策：四支 BAT 的 git 區段（add→commit→pull→push）前後加上 `md`/`rd` 目錄原子鎖 `D:\2025\AI\MongoDB\.git_bat_lock`——搶不到鎖每 5 秒重試、最多等 10 分鐘後放行（避免殘鎖造成永久死鎖）。等待用 `ping -n 6 127.0.0.1`（`timeout` 在無 stdin 的排程環境會失敗）。
> 事後復原：殘留的 rebase 狀態先 `git rebase --abort`、仍在則刪 `.git\rebase-merge`；遺失的報表**重新執行 generator 補產**（autostash 可能抓到寫入一半的殘缺檔，勿直接 `stash apply`）。

**追記（2026/07/22 事故）**：`Qware_Daily_Report_Update` 與 `Qware_Daily_Report_Update_Final` 觸發時間差僅 0.07 秒（幾乎同時），兩個實例各自跑完整個 `generate_a_daily_report.js` 產出新報表；夾在中間執行的 GA 排程 git 區段（有互斥鎖保護，但鎖只包住 git 區段本身，不包住報表產出階段）跑 `git pull --rebase --autostash` 時，把某一個 daily 實例當下還沒 commit 的新版 `A_Qware_Revenue_Report_Daily.html` autostash 走，之後未見對應「Applied autostash」紀錄（`git_sync.log` 只到 push 成功就結束）。結果：兩個 daily 實例與 GA 排程的 commit 都顯示成功、daily_log.txt 也顯示「Update Completed」，但網站上的日報內容實際卡在 2026/07/21 08:08 版本，**兩天都沒發現**，直到使用者反映報表沒更新才發現。已於 07/22 手動重跑 `generate_a_daily_report.js` 並 commit 修復（`bd3f330`）。
> **與 07/14 事故的差異**：互斥鎖只 serialize 了「git add→commit→pull→push」這段，沒有涵蓋「報表產出」階段；兩個 daily 實例的報表產出本身沒有互斥、各自任意時間點完成，因此鎖再怎麼鎖 git 區段，還是可能在「實例 B 產出完成、尚未進入鎖」的空窗期被另一支排程的 autostash 撿走。
> **修復（2026/07/22）**：問題根源是 `Qware_Daily_Report_Update` 與 `Qware_Daily_Report_Update_Final` 兩個排程本來就設定成完全相同的觸發時間（每日 08:00），「兩者並存互為備援」的設計反而製造了併發的必要條件。已用 `Disable-ScheduledTask` 停用原始版 `Qware_Daily_Report_Update`，只保留設定較完整的 `_Final`（見 §1 備注），從源頭消除同一支 BAT 兩個實例同時起跑的可能，不需再修改重複執行判斷或 BAT 邏輯。其餘排程（GA 0800/1500、weekly、travel）觸發時間彼此不同，暫無同類風險。

**追記（2026/07/23 事故）**：`TravelExpenseUpdate` 排程原訂 06:00 觸發，但當天電腦該時段未開機，由 `StartWhenAvailable` 延後補跑到 08:08:10——與 `Qware_Daily_Report_Update_Final`、`Update_GA_Report_0800` 同一時刻（08:08:08）幾乎同時起跑。`travel/update_log.txt` 顯示報表產出正常完成（expense + shopping report 皆成功），log 停在「Pushing to GitHub...」之後即無下文：既沒有 `Update finished.`／`[LINE] OK: travel` 收尾行，`travel/git_sync.log` 當天也完全沒有新增內容（表示 `git pull --rebase` / `git push` 這段從未被執行到，或執行後沒有任何輸出）；`Get-ScheduledTaskInfo` 顯示 `LastTaskResult=1`（一般錯誤，非 0x800710E0 那類已知代號）。事後檢查當下已無殘留的 `.git_bat_lock` 目錄、`.git/rebase-merge`，也沒有掛住的 git/cmd 程序，本地 git log 與 origin/main 一致、且當天本來就沒有 travel 的 commit——研判是該實例在 git 互斥鎖等待或 git 操作途中被中止（很可能與同一秒起跑的 daily/GA 排程互相影響有關），但因程序已結束、無法回溯確切中止原因。**處理方式**：人工手動執行 `cmd /c "D:\2025\AI\MongoDB\travel\auto_update.bat"`，本次乾淨跑完全程（commit `4d37fdf`、push 成功、`[LINE] OK: travel` 正常出現），未修改 BAT 邏輯。
> **與既有機制的落差**：`daily_update.bat`／`weekly_update.bat` 都有「今日已完成則跳過」的重複執行保護（比對 log 內今日時間戳），`travel/auto_update.bat` 目前**沒有**這層保護，也沒有「push 失敗時的告警」——今天是使用者主動察觉才發現並補跑；若要根治，可考慮替 travel 加上與 daily 類似的當日完成檢查，或在 git push 失敗時額外用 LINE 告警（目前 LINE 通知只在流程走到最後才發送，中途中止時完全靜默）。

**追記（2026/07/23，`A_Qware_Revenue_Report_Daily.html` 二度卡住）**：同一份報表在 07/21 卡住過一次（見上方 07/22 事故，已用 `bd3f330` 修復），今天再度發生：`daily_log.txt` 明確顯示 08:08:18 已成功產出新版（`Report generated: ... (42 KB)`），但當天的 commit（`7654b93`）完全沒有包含這個檔案，網站上仍是 07/22 09:46 產出、日期範圍停在「~07月21日」的舊版——直到使用者反映才發現，用 `git diff` 確認確實是舊內容（非「剛好資料沒變」），重新執行 `generate_a_daily_report.js` 補上（`2066e3e`）。
> **可能原因**：`generate_a_daily_report.js` 是 `daily_update.bat` 8 支 script 中**第一個**執行的（08:08:18 產出），比起最後才執行的 script，它在磁碟上「已產出但尚未 commit」的曝險時間最長（要等其餘 7 支 script 都跑完，約到 08:13 才會執行 `git add`）——如果同一時段有 GA／travel 等其他排程的 `git pull --rebase --autostash` 介入，這份報表被撿進 autostash 的機率就比同批次晚產出的報表高。這只是推論，`git_sync.log` 本身沒有留下能直接證實的線索（今天的 autostash 記錄顯示「Applied autostash」成功，不像 07/22 事故那樣缺了還原紀錄）。
> **暫時處理方式**：未修改 BAT 邏輯，僅人工重跑補救；若此檔案第三度發生同樣情形，值得考慮把 `generate_a_daily_report.js` 移到 8 支 script 的最後一個執行（縮短曝險窗口），或讓 daily_update.bat 改成每支 script 產出後就個別 commit（目前是全部 8 支跑完才一次 `git add .`）。

### 6.4 新增排程程式規範

若需新增排程：
1. 撰寫 `.bat` 或 `.ps1`，輸出 log 至 `*_log.txt`
2. 在 Windows 工作排程器建立任務，設定 WorkingDirectory
3. 更新本文件 §1 總覽表
4. 在 `HTML_Report_Catalog.html` 總目錄新增一列

---

## 7. 相關連結

### 視覺化儀表板

- **HTML 儀表板**：[Scheduled_Tasks_Dashboard.html](https://lard23chen.github.io/report/Scheduled_Tasks_Dashboard.html) — 排程狀態總覽、BAT 執行流程、錯誤排查指南

### 相關規範文檔

- 每日營業報表規範：`REPORT_SPEC_A_DAILY_REVENUE.md`
- 週報分析報表規範：`REPORT_SPEC_A_WEEKLY_REVENUE.md`
- GA 流量報表規範：`REPORT_SPEC_GA_EVENTS_TRAFFIC.md`
- GA 點擊/瀏覽/漏斗報表規範：`REPORT_SPEC_D_GA_CLICKDATA_202606.md` / `REPORT_SPEC_D_GA_PAGEVIEWDATA_202606.md` / `REPORT_SPEC_D_GA_FUNNEL_202606.md`
- E 系統轉換漏斗規範：`REPORT_SPEC_E_DMP_FUNNEL.md`
- Azure 費用報表規範：`REPORT_SPEC_AZURE_DAILY.md`
- 旅遊報表規範：`REPORT_SPEC_TRAVEL_2026.md`

---
*最後更新：2026/07/23（依使用者要求，`daily_update.bat` 移除 `generate_kaohsiung_beer_festival_report.js`／`generate_d_ga_clickdata_report.js`／`generate_d_ga_pageview_report.js` 三支 script，`A_KaohsiungBeerFestival_2026.html`／`D_GA_ClickData_Webb_202606_Report.html`／`D_GA_PageViewData_Webb_202606_Report.html` 停止每日自動更新；已確認保留的 `generate_d_ga_funnel_report.js`／`generate_d_ga_funnel_cart_data.js` 直接查 MongoDB、不依賴這三支的輸出，移除後不影響。見 §2.2／§2.3）*
*2026/07/23（`TravelExpenseUpdate` 依使用者要求停用（`Disable-ScheduledTask`），`travel/auto_update.bat` 與報表本身未刪除，僅排程停止觸發；同步從 `HTML_Report_Catalog.html` 移除對應列（原 S4），`Scheduled_Tasks_Dashboard.html` 標示為已停用。見 §1 備注、§4）*
*2026/07/23（`A_Qware_Revenue_Report_Daily.html` 二度卡住：08:08 已成功產出新版，但當天 commit 沒收進去，網站仍是 07/22 舊版，直到使用者反映才發現；已重跑補推 `2066e3e`，追記於 §6.3——這是同一份報表 07/21 之後第二次發生同症狀，推測與它是 daily_update.bat 8 支 script 中最早產出、曝險時間最長有關，但未證實，暫未改 BAT 邏輯）*
*2026/07/23（新增每月排程 `Qware_DMP_AllTime_Top10_Monthly`（每月 1 日 10:00）+ `update_dmp_alltime_top10.bat`，見新增的 §5.5；同步把 `generate_alltime_top10_v3.js` 從每次全表掃描（~40 分鐘）改成增量架構——狀態序列化內嵌於主報表 HTML（沿用 GA 報表的 `generatedAt`/`SD_START`/`SD_END` 寫法），只查新資料、Top10 新面孔才觸發一次性補齊；不重複訪客改用自製 HyperLogLog（無新增 npm 依賴），避免完整訪客 ID 清單讓報表檔案隨時間無限增長。詳見 `REPORT_SPEC_TRAFFIC_ANALYSIS.md` §3）*
*2026/07/23（`update_ga_report.bat` 也補上失敗告警：node script／git push 出錯 goto 中斷並發 `-Status FAIL` LINE，沿用 travel/weekly 的單一 script 中斷模式；因 GA 一天觸發兩次（08:00/15:00）是刻意設計，故不加重複執行保護，與其他三支 bat 不同。已實測完整流程，成功 commit `b593dc6`。見 §3.2）*
*2026/07/23（把 travel 補上的失敗告警機制延伸到 `daily_update.bat`／`weekly_update.bat`：daily 維持 8 支獨立 script 的 best-effort 精神，個別失敗記入 `FAILED_STEPS`、跑完才統一判斷發 FAIL 或成功 LINE；weekly 只有單一 script，比照 travel 用 goto 中斷＋即時告警，且刻意不新增原本沒有的成功通知；`send_line_notify.ps1` 的 `failLabels` 新增 `weekly`。見 §2.2／§5.2。已用「今日已完成」跳過路徑實測 daily/weekly 兩支 bat，確認新增的 errorlevel 檢查未破壞既有流程）*
*2026/07/23（承接同日稍早的 `TravelExpenseUpdate` 事故，為 `travel/auto_update.bat` 補上重複執行保護（比照 daily/weekly，需 `Update finished.` 含日期時間戳）與各步驟失敗告警（errorlevel 檢查 + `send_line_notify.ps1` 新增 `-Status FAIL -Detail` 參數），見 §4.2；已手動測試完整流程（成功 commit `9603612`）與跳過邏輯皆正常運作）*
*2026/07/23（`TravelExpenseUpdate` 因 `StartWhenAvailable` 延後補跑到與 daily/GA 相同的 08:08 時段，git push 階段中途中止、`LastTaskResult=1`，人工重跑 `travel/auto_update.bat` 補推（`4d37fdf`），追記於 §6.3；travel 排程目前無重複執行保護與失敗告警，待評估是否補上）*
*2026/07/22（放棄雲端 routine 路線，5 個 routine 全數 `enabled: false`，本地排程恢復為唯一主力，見 §0.4；發現並修復 `A_Qware_Revenue_Report_Daily.html` 因排程併發競爭卡在舊版本兩天的事故（追記於 §6.3），根因是 `Qware_Daily_Report_Update` 與 `_Final` 觸發時間完全相同導致同時起跑，已停用前者、只留設定較完整的 `_Final`，從源頭消除併發）*
*2026/07/20（本地排程 git push 自 07/18 起因排程 session 取不到 GCM 憑證持續失敗、Pages 停更兩天；排程主力遷移至雲端 Claude Code Routines——修復 daily/GA 兩個雲端 routine 的 prompt（補 MongoDB 連線字串，此前從未成功執行）、新建 weekly/travel 兩個 routine，見 §0；本地排程轉備援待停用）*
*2026/07/14（排程同時補跑造成 git 互踩、三份日報更新遺失，四支 BAT git 區段加入目錄原子互斥鎖，見 §6.3；generate_d_ga_funnel_cart_data.js 加入每日排程，A購物車/結帳資料不再停更）*
*2026/07/13：git push 掛死事故復原；四支 BAT 加入 git pull --rebase --autostash 與認證不互動防護，git 輸出改導向 git_sync.log，見 §6.3*
*2026/07/09：新增 `Qware_Weekly_Report_Update` 排程 + `weekly_update.bat`，A 系統週報每週四 08:30 自動產出*
*2026/07/07：daily_update.bat 新增 generate_e_dmp_funnel_report.js，E 系統轉換漏斗報表改為每日 08:00 自動更新*
*2026/07/06：補記 daily_update.bat 實際步驟：pageview / funnel generator 與 LINE 通知；更新排程總覽最後執行紀錄；註記 git add . 會收走工作區未提交變更*
