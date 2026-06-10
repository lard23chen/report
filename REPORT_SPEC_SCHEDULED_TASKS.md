# 自動排程程式 技術規範說明

本文件定義 Qware 報表系統中所有 Windows 工作排程器（Task Scheduler）自動化程式的設定、執行邏輯與維護規範。

---

## 1. 排程總覽

| 排程名稱 | BAT 檔 | 觸發時間 | 最後執行 | 狀態 |
|---------|--------|---------|---------|------|
| `Qware_Daily_Report_Update` | `daily_update.bat` | 每日 08:00 | 2026/06/10 09:13（失敗） | Ready |
| `Qware_Daily_Report_Update_Final` | `daily_update.bat` | 每日 08:00 | 2026/06/09 08:34 | Ready |
| `Qware_Monthly_Report_Update` | `daily_update.bat` | 每月 2 日 08:30 | 2026/05/02 07:56 | Ready |
| `Update_GA_Report_0800` | `update_ga_report.bat` | 每日 08:00 | — | Ready |
| `Update_GA_Report_1500` | `update_ga_report.bat` | 每日 15:00 | — | Ready |
| `TravelExpenseUpdate` | `travel/auto_update.bat` | 每日 06:00 | 2026/06/10 09:14 | Ready |
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
node update_index_stats.js                         → report_index.html（統計表 + Tab1 月份卡片）
if 今日為2日: node generate_monthly_report.js      → A_Qware_Revenue_Report_YYYY年MM月_分析報表.html
git add . && git commit -m "Auto Update Daily Reports: ..." && git push origin main
```

### 2.3 產出報表

| 腳本 | 產出 HTML | 資料來源 | 說明 |
|------|----------|---------|------|
| `generate_a_daily_report.js` | `A_Qware_Revenue_Report_Daily.html` | MongoDB `Qware_A_Ticket_data_Daily` | A 系統每日營業快訊 |
| `generate_kaohsiung_beer_festival_report.js` | `A_KaohsiungBeerFestival_2026.html` | MongoDB `Qware_A_Ticket_data_Daily` + `Qware_A_Traffic_session_data` | 2026 高雄啤酒音樂節專案分析 |
| `generate_d_ga_clickdata_report.js` | `D_GA_ClickData_Webb_202606_Report.html` | MongoDB `QwareAi.GA_D_ClickData_Webb_202606` | D 系統節目點擊量分析（GA）；patch-in-place 方式更新資料常數 |
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

## 5. 維護注意事項

### 5.1 常見錯誤碼

| 錯誤碼 | 代號 | 常見原因 | 處理方式 |
|--------|------|---------|---------|
| `2147946720`（`0x800710E0`） | — | Node.js 路徑錯誤、MongoDB 逾時、Git 無差異 | 查 `daily_log.txt`；確認 `_Final` 排程是否成功 |
| `-2147020576`（`0x80070520`） | `ERROR_NO_SUCH_LOGON_SESSION` | 排程觸發時電腦已鎖定（Interactive only 限制） | 登入後由 HKCU Run 機碼自動補跑；或手動執行 BAT |

**排查步驟：**
1. 查看 `daily_log.txt` 確認 Node.js 輸出與完成時間戳
2. 確認 `Qware_Daily_Report_Update_Final` 是否成功（Result: 0）
3. 手動執行 BAT 確認錯誤訊息

### 5.2 登入補跑機制（HKCU Run）

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

### 5.3 新增排程程式規範

若需新增排程：
1. 撰寫 `.bat` 或 `.ps1`，輸出 log 至 `*_log.txt`
2. 在 Windows 工作排程器建立任務，設定 WorkingDirectory
3. 更新本文件 §1 總覽表
4. 在 `HTML_Report_Catalog.html` 總目錄新增一列

---

## 6. 相關連結

### 視覺化儀表板

- **HTML 儀表板**：[Scheduled_Tasks_Dashboard.html](https://lard23chen.github.io/report/Scheduled_Tasks_Dashboard.html) — 排程狀態總覽、BAT 執行流程、錯誤排查指南

### 相關規範文檔

- 每日營業報表規範：`REPORT_SPEC_A_DAILY_REVENUE.md`
- GA 流量報表規範：`REPORT_SPEC_GA_EVENTS_TRAFFIC.md`
- Azure 費用報表規範：`REPORT_SPEC_AZURE_DAILY.md`
- 旅遊報表規範：`REPORT_SPEC_TRAVEL_2026.md`
