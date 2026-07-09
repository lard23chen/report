# 自動排程程式 技術規範說明

本文件定義 Qware 報表系統中所有 Windows 工作排程器（Task Scheduler）自動化程式的設定、執行邏輯與維護規範。

---

## 1. 排程總覽

| 排程名稱 | BAT 檔 | 觸發時間 | 最後執行 | 狀態 |
|---------|--------|---------|---------|------|
| `Qware_Daily_Report_Update` | `daily_update.bat` | 每日 08:00 | 2026/07/06 09:07（成功，git 記錄） | Ready |
| `Qware_Daily_Report_Update_Final` | `daily_update.bat` | 每日 08:00 | 同上（兩排程共用 BAT，依重複執行保護擇一生效） | Ready |
| `Qware_Monthly_Report_Update` | `daily_update.bat` | 每月 2 日 08:30 | 2026/07/02 08:42（成功，git 記錄） | Ready |
| `Update_GA_Report_0800` | `update_ga_report.bat` | 每日 08:00 | 2026/07/06 15:00（成功，git 記錄） | Ready |
| `Update_GA_Report_1500` | `update_ga_report.bat` | 每日 15:00 | 同上 | Ready |
| `TravelExpenseUpdate` | `travel/auto_update.bat` | 每日 06:00 | 2026/07/06 09:10（成功，git 記錄） | Ready |
| `Qware_Weekly_Report_Update` | `weekly_update.bat` | 每週四 08:30 | 2026/07/09 10:21（建立時手動驗證成功，git `fe5673f`） | Ready |
| `QwareDailyReport`（HKCU Run） | `daily_update.bat` | 每次使用者登入 | — | 常駐 |

> **備注**：`Qware_Daily_Report_Update` 與 `Qware_Daily_Report_Update_Final` 執行相同的 BAT，前者為原始排程，後者為補強版（設有 WorkingDirectory）。兩者並存確保至少一個成功觸發。
> 因帳號非系統管理員，無法將排程設定為「不論是否登入都執行」，改以 HKCU Run 機碼作為登入補跑機制。

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
node generate_kaohsiung_beer_festival_report.js    → A_KaohsiungBeerFestival_2026.html
node generate_d_ga_clickdata_report.js             → D_GA_ClickData_Webb_202606_Report.html
node generate_d_ga_pageview_report.js              → D_GA_PageViewData_Webb_202606_Report.html
node generate_d_ga_funnel_report.js                → D_GA_Funnel_202606_Report.html
node generate_e_dmp_funnel_report.js               → E_DMP_Funnel_Report.html
node update_index_stats.js                         → report_index.html（統計表 + Tab1 月份卡片）
if 今日為2日:  node generate_monthly_report.js     → A_Qware_Revenue_Report_YYYY年MM月_分析報表.html
if 今日為10日: node generate_ga_report.js          → A_GA_Traffic_Analysis_Report.html
git add . && git commit -m "Auto Update Daily Reports: ..." && git push origin main
powershell send_line_notify.ps1 -Template "daily"  → LINE 完成通知
```

> ⚠️ 結尾的 `git add .` 會把**當下工作區所有未提交變更**一起 commit 進去。若在排程觸發時段（08:00 前後、登入補跑、15:00 GA 排程）有進行中的手動修改，可能被自動 commit 收走（2026/07/06 曾發生，見 git `f0e940e`）。

### 2.3 產出報表

| 腳本 | 產出 HTML | 資料來源 | 說明 |
|------|----------|---------|------|
| `generate_a_daily_report.js` | `A_Qware_Revenue_Report_Daily.html` | MongoDB `Qware_A_Ticket_data_Daily` | A 系統每日營業快訊 |
| `generate_kaohsiung_beer_festival_report.js` | `A_KaohsiungBeerFestival_2026.html` | MongoDB `Qware_A_Ticket_data_Daily` + `Qware_A_Traffic_session_data` | 2026 高雄啤酒音樂節專案分析 |
| `generate_d_ga_clickdata_report.js` | `D_GA_ClickData_Webb_202606_Report.html` | MongoDB `QwareAi.GA_D_ClickData_Webb_202606` | D 系統節目點擊量分析（GA）；patch-in-place 方式更新資料常數 |
| `generate_d_ga_pageview_report.js` | `D_GA_PageViewData_Webb_202606_Report.html` | MongoDB `QwareAi.GA_D_PageViewData_Webb_202606` | D 系統節目瀏覽量分析（GA） |
| `generate_d_ga_funnel_report.js` | `D_GA_Funnel_202606_Report.html` | MongoDB `QwareAi.GA_D_PageViewData_Webb_202606` + `GA_D_ClickData_Webb_202606` | 瀏覽→點擊轉換漏斗；2026/07/06 起含每日明細與日期陣列（PV_BY_DATE / CLICK_ACT_DAILY / PV_DATES / CL_DATES）全自動更新。A購物車/結帳的 `generate_d_ga_funnel_cart_data.js` **不在排程內**，需手動執行 |
| `generate_e_dmp_funnel_report.js` | `E_DMP_Funnel_Report.html` | MongoDB `trek-first-party-dmp.event`（bu:"E"） | E 系統瀏覽→購買轉換漏斗（張數/金額/轉換率）；單一腳本重新聚合全部資料並注入 Data marker 區塊；2026/07/07 起加入排程 |
| `update_index_stats.js` | `report_index.html` | MongoDB `Qware_Ticket_Data` | 月份統計表、趨勢圖、Tab1 本月報表卡片；每日執行 |
| `generate_monthly_report.js` | `A_Qware_Revenue_Report_YYYY年MM月_分析報表.html` | MongoDB `Qware_Ticket_Data` | 上月完整分析報表；**僅每月 2 日執行**（bat 內有日期判斷） |

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
node generate_ga_events_report.js    → A_GA_Events_Traffic_Report.html
git add . && git commit -m "Auto-update GA Traffic Reports: ..." && git push
```

### 3.3 產出報表

| 腳本 | 產出 HTML | 資料來源 | 說明 |
|------|----------|---------|------|
| `generate_ga_events_report.js` | `A_GA_Events_Traffic_Report.html` | MongoDB `Qware_A_Traffic_session_data` | GA 事件流量深度分析（每分鐘 Session / 訂單 / 張數） |

### 3.4 雙時段設計

- **08:00**：取得前一天結算後的完整數據
- **15:00**：取得當日上午到下午的即時更新數據

---

## 4. travel/auto_update.bat

### 4.1 基本資訊

| 項目 | 說明 |
|------|------|
| 路徑 | `D:\2025\AI\MongoDB\travel\auto_update.bat` |
| 對應排程 | `TravelExpenseUpdate`（每日 06:00） |
| 執行目錄 | `D:\2025\AI\MongoDB\travel` |
| Log 檔 | `travel\update_log.txt` |

### 4.2 執行步驟

```bat
# 1. 下載主要花費 CSV（Google Sheets → new_analysis_data.csv）
# 2. node generate_expense_report.js → expense_report.html
# 3. 下載購物 CSV（Google Sheets GID:1320702581 → new_data_gid_1320702581.csv）
# 4. 下載參考網頁（→ reference_site.html）
# 5. node generate_shopping_report.js → shopping HTML
# 6. git add . && git commit -m "Auto-update expense report: ..." && git push
```

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
node generate_a_weekly_report.js   → A_Qware_Revenue_Report_Weekly.html（上週四~本週三，排除B開頭訂單）
git add A_Qware_Revenue_Report_Weekly.html weekly_log.txt
git commit -m "Auto Update Weekly Report: ..." && git push origin main
```

> 與 `daily_update.bat` 不同，此 BAT 的 `git add` **只加入週報 HTML 與 log**（非 `git add .`），避免把工作區其他未提交變更一起收走（§2.2 已知問題）。
> 重複執行保護的日期比對使用 `findstr /c:"%TODAY%"`（不含 `[` 前綴），因 `%date%` 格式在互動 shell 與排程器下可能不同（`週四 2026/07/09` vs `2026/07/09 週四`）。

### 5.3 執行時間設計

- **每週四 08:30**：此時「上週四～本週三」一整週資料已完整；資料來源 `Qware_A_Ticket_data_Daily` 為滾動集合（約保留 8 天），週四執行可趕在週初資料被清掉前取得完整一週。
- 錯過時段（電腦關機/鎖定）由 `StartWhenAvailable` 於下次開機可用時補跑；BAT 內重複執行保護避免同日重跑。

---

## 6. 維護注意事項

### 6.1 常見錯誤碼

| 錯誤碼 | 代號 | 常見原因 | 處理方式 |
|--------|------|---------|---------|
| `2147946720`（`0x800710E0`） | — | Node.js 路徑錯誤、MongoDB 逾時、Git 無差異 | 查 `daily_log.txt`；確認 `_Final` 排程是否成功 |
| `-2147020576`（`0x80070520`） | `ERROR_NO_SUCH_LOGON_SESSION` | 排程觸發時電腦已鎖定（Interactive only 限制） | 登入後由 HKCU Run 機碼自動補跑；或手動執行 BAT |

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

### 6.3 新增排程程式規範

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
*最後更新：2026/07/09（新增 `Qware_Weekly_Report_Update` 排程 + `weekly_update.bat`，A 系統週報每週四 08:30 自動產出）*
*2026/07/07：daily_update.bat 新增 generate_e_dmp_funnel_report.js，E 系統轉換漏斗報表改為每日 08:00 自動更新*
*2026/07/06：補記 daily_update.bat 實際步驟：pageview / funnel generator 與 LINE 通知；更新排程總覽最後執行紀錄；註記 git add . 會收走工作區未提交變更*
