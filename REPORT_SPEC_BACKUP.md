# 備份計畫 (REPORT_SPEC_BACKUP.md)

本文件定義 Qware 報表系統的備份策略、各類資料的保護方式、災難還原步驟與維護規則。

---

## 1. 目的與範圍

確保在「本機硬碟損毀」或「單一雲端服務出問題」時,報表系統可以重建、歷史報表不遺失。涵蓋:程式碼、報表 HTML、排程設定、憑證、原始數據。

---

## 2. 資料分類與保護矩陣

| 資料 | 主要位置 | 備份副本 | 同步方式 | 風險等級 |
|------|---------|---------|---------|---------|
| 程式碼 / generator / BAT / 規範 MD | `D:\2025\AI\MongoDB` | GitHub `lard23chen/report` | 排程每日自動 commit+push(每日 06:00 / 08:00 / 15:00) | 低 |
| 產出報表 HTML(現役) | 同上 | 同上;報表內嵌聚合後數據快照 | 同上 | 低 |
| 已結案報表(封存) | `D:\2025\AI\report-archive-2025/2026` | GitHub `lard23chen/report-archive-YYYY` | 封存時手動 push(SOP 見 `REPORT_SPEC_ARCHIVE.md`) | 低 |
| Windows 排程定義(7 個工作) | 本機 Task Scheduler | `scheduled_tasks_export/*.xml`(在主 repo 內) | **手動**:排程有異動時重新匯出(見 §3.2) | 中 |
| HKCU Run 登入補跑機碼 | 本機登錄檔 | 設定值記載於 `REPORT_SPEC_SCHEDULED_TASKS.md` §6.2 | 文檔記載 | 低 |
| 憑證(`.env` ×2、`.streamlit/secrets.toml`) | 僅本機 | **無**(gitignored,不可進公開 repo) | 手動 SOP 見 §3.3 | **高** |
| MongoDB 原始數據 | MongoDB Atlas 雲端 | 依 Atlas 方案(M0 免費層**無自動備份**) | — | 中(見 §5) |
| Google Sheets(旅遊花費/購物) | Google 雲端 | Google 本身版本歷史;CSV 快取僅本機 | 排程每日下載 | 低 |
| travel 本機資料檔(`shopping_data.xlsx`、`bkk_trip*.csv` 等) | 僅本機(gitignored) | 無 | — | 中 |

---

## 3. 備份機制

### 3.1 git 雙副本(自動,主要機制)

- 四支排程 BAT 每日自動 commit + push,主 repo 與 GitHub 幾乎即時同步,兼具**版本歷史**(可回溯任意時間點的報表與程式)。
- push 失敗防護(pull --rebase、認證不互動、git_sync.log 隔離)見 `REPORT_SPEC_SCHEDULED_TASKS.md` §6.3。
- **注意**:git 歷史重寫(`filter-repo`、force push)會同時影響兩份副本,執行前應先另外壓縮整包留存。

### 3.2 排程定義 XML 匯出(手動)

- 位置:主 repo `scheduled_tasks_export/`,7 個工作各一個 XML(2026/07/13 首次匯出)。
- XML 只含本機 SID 與路徑,無帳密,可放公開 repo。
- **維護規則:凡新增、修改、刪除任何專案排程,必須重新匯出並 commit**:

```powershell
$tasks = "Qware_Daily_Report_Update","Qware_Daily_Report_Update_Final","Qware_Monthly_Report_Update",
         "Qware_Weekly_Report_Update","Update_GA_Report_0800","Update_GA_Report_1500","TravelExpenseUpdate"
foreach ($t in $tasks) { schtasks /Query /TN $t /XML | Out-File "scheduled_tasks_export\$t.xml" -Encoding utf8 }
```

### 3.3 憑證備份(手動,不進 repo)

需另行備份到**私密位置**(密碼管理器或私人雲端硬碟,絕不可 commit 進公開 repo):

| 檔案 | 內容 |
|------|------|
| `D:\2025\AI\MongoDB\.env` | 根目錄環境變數(LINE token 等) |
| `D:\2025\AI\MongoDB\travel\.env` | travel 用環境變數 |
| `D:\2025\AI\MongoDB\.streamlit\secrets.toml` | Streamlit 憑證 |

建議每次修改憑證檔時同步更新私密備份。

### 3.4 MongoDB 原始數據

- 報表 HTML 已內嵌聚合結果,**歷史報表不依賴資料庫存活**;資料庫遺失影響的是「重算歷史」與「未來報表」。
- `Qware_A_Ticket_data_Daily` 為滾動集合(約保留 8 天),本質上不可完整備份,靠每日/每週報表及時聚合留存。
- 若需資料庫層備份:確認 Atlas 方案(M0 無自動備份;M10+ 有連續備份),或定期 `mongodump` 重要集合(`Qware_Ticket_Data` 等)到本機另一顆磁碟。**目前未實施,待決定。**

---

## 4. 災難還原 SOP(新機器重建)

1. 安裝 Node.js(`D:\nodejs\node.exe`,或調整 BAT 內路徑)、git、Git Credential Manager(登入 GitHub)。
2. `git clone https://github.com/lard23chen/report.git D:\2025\AI\MongoDB`;封存庫視需要 clone 到 `D:\2025\AI\report-archive-YYYY`。
3. 在主目錄與 `travel\` 執行 `npm install`。
4. 從私密備份還原 `.env` ×2 與 `.streamlit\secrets.toml`(§3.3)。
5. 匯入排程:`schtasks /Create /TN <名稱> /XML "scheduled_tasks_export\<名稱>.xml"`(會要求指定執行帳號;非管理員帳號需維持「僅使用者登入時執行」)。
6. 重建 HKCU Run 補跑機碼(值見 `REPORT_SPEC_SCHEDULED_TASKS.md` §6.2)。
7. 手動跑一次 `daily_update.bat` 驗證 MongoDB 連線、報表產出與 git push 全流程。

---

## 5. 已知風險與待辦

| # | 風險 | 優先度 | 狀態 |
|---|------|--------|------|
| 1 | **MongoDB 連線字串(含帳密)硬編碼在 235 支 js 檔（237 處）+ 4 個 MD 文檔內,且 repo 為公開**——3 組帳密已曝光（QwareDashBoard×2 cluster、lard23 個人） | **高** | **程式碼已於 2026/07/13 全數改讀 `.env`**（`MONGODB_URI_QWARE` / `MONGODB_URI_DMP` / `MONGODB_URI_PERSONAL`）。lard23:歷史中曝光的舊密碼已失效,新密碼已於 2026/07/13 完成輪換並驗證連線（風險解除）。**QwareDashBoard:曝光密碼仍有效,用戶 2026/07/13 決定暫不輪換——風險保留,強烈建議至少設 Atlas Network Access IP 白名單作為補償控制** |
| 2 | **`.env` 曾被 git 追蹤**（gitignore 對已追蹤檔案無效）,內含 `OPENAI_API_KEY`,已隨公開 repo 曝光 | **高** | 2026/07/13 已 `git rm --cached` 解除追蹤;**OPENAI_API_KEY 必須到 platform.openai.com 重發並更新 `.env`** |
| 3 | Atlas 免費層無自動備份,原始數據單點 | 中 | 待決定(§3.4) |
| 4 | 憑證檔無異地副本 | 高 | 待用戶執行 §3.3(需人工放到私密位置) |
| 5 | travel 本機資料檔無備份 | 低 | 可從 Google Sheets 重新下載大部分內容 |

> 教訓:`.gitignore` 只擋「尚未追蹤」的檔案;已 commit 過的檔案要用 `git rm --cached <檔案>` 解除追蹤,且歷史中的舊內容視同外洩、憑證一律輪換。

---

## 6. 維護規則

1. 排程異動 → 重新匯出 XML(§3.2)並 commit。
2. 憑證異動 → 同步更新私密備份(§3.3)。
3. 新增資料類別(新資料庫、新外部來源)→ 更新 §2 保護矩陣。
4. 每次封存作業(`REPORT_SPEC_ARCHIVE.md`)完成後,確認封存庫本機與 GitHub 兩份都存在。

---
*建立:2026/07/13(首次盤點;同日完成排程 XML 首次匯出)*
