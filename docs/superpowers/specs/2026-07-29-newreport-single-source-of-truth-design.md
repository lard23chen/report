---
title: NewReport 成為唯一真相來源 — 排程改為直接 push NewReport
date: 2026-07-29
status: approved
---

## 背景

`D:\2025\AI\MongoDB`（remote `origin` = `lard23chen/report`）目前 `.git` 已達 549M，逼近 `HTML_Report_Catalog.html` §容量與封存 提到的 GitHub Pages 1GB 上限。`D:\2025\AI\NewReport`（remote `origin` = `lard23chen/NewReport`）是 2026/07/24 從 `report` 一次性複製出的乾淨 repo（`.git` 僅 7.5M），2026/07/27 起靠 `sync_newreport.bat` 每日 20:00 單向同步部分報表，但兩邊分頭維護、鏡像常落後（使用者兩度反映資料沒更新才發現）。

使用者決定：不想再維護兩個 repo，改以 NewReport 為唯一真相來源，`report` repo 之後完全凍結。

## 目標

- 所有排程（daily / GA / weekly / DMP monthly）產出報表後，**直接、即時**push 到 `NewReport`，不再 push 到 `report`。
- `HTML_Report_Catalog.html`、`Scheduled_Tasks_Dashboard.html` 這類目錄/儀表板頁面也一併改為同步到 NewReport 維護。
- 退休 `sync_newreport.bat` 與 `Qware_NewReport_Sync_Daily`（每日 20:00）排程——即時同步後不再需要批次補跑。

## 不動的部分

- `D:\2025\AI\MongoDB` 仍是唯一的**執行目錄**：`.env`、MongoDB 連線設定、`node_modules`、所有 `generate_xxx.js` 原始碼都留在原地，不搬家。
- Windows Task Scheduler 排程本身的路徑、觸發時間不變，只改各 bat 內部的 git push 目標。
- `D:\2025\AI\NewReport` 的第二個 remote `company`（`git@github-company:org-ticket-mgmt/ViewReport.git`）完全不碰，這次改動只操作 `origin`（`lard23chen/NewReport`）。
- `daily_log.txt`、`weekly_log.txt`、`git_sync.log`、`dmp_alltime_top10_log.txt` 等 log 檔案繼續只留在本機 `D:\2025\AI\MongoDB`，不進任何 git（既不進 `report` 也不進 `NewReport`）；本機仍用這些檔案做「今日是否已跑過」的重複執行判斷。

## 改法：4 支排程 bat 套用同一個模式

適用範圍：`daily_update.bat`、`update_ga_report.bat`、`weekly_update.bat`、`update_dmp_alltime_top10.bat`。

1. Node 產出報表到 `D:\2025\AI\MongoDB`（跟現在一樣，不動 MongoDB 連線邏輯與各 script 的產出路徑）。
2. 更新 `HTML_Report_Catalog.html` / `Scheduled_Tasks_Dashboard.html` 對應列（沿用現有 `updateCatalogRow()` 邏輯，一樣先改本地檔案）。
3. 用 `D:\2025\AI\NewReport\.sync_lock` 互斥鎖（沿用 `sync_newreport.bat` §5.6.4 現成的「搶不到鎖每 5 秒重試、最多等 10 分鐘」模式），把這次產出的報表 HTML + 目錄/儀表板頁複製進 `D:\2025\AI\NewReport`（覆蓋複製，不比對差異——理由同 §5.6.4 教訓：CRLF/LF 正規化問題，一律複製、只信任 `git commit` 自身判斷）。
4. `cd /d D:\2025\AI\NewReport`：
   ```
   git add <這支 bat 這次要同步的檔案清單>   # 不用 git add .
   git commit -m "Auto-update <report 名稱>: <timestamp>"
   git pull --rebase --autostash origin main   # 失敗則 git rebase --abort
   git push origin main                        # 輸出導向 git_sync.log（NewReport 端另建一份，避免鎖到主 log）
   ```
   若 commit 因無變更而 errorlevel（nothing to commit）→ 視為成功、跳過 push，不視為失敗。
5. **移除**原本在 `D:\2025\AI\MongoDB` 對 `report`（`origin`）的 git add/commit/push 段落（含 `generate_a_daily_report.js` 現有的獨立提交邏輯，§2.2 提到的 2026/07/24 新增機制）。
6. `GIT_TERMINAL_PROMPT=0`、`GCM_INTERACTIVE=never` 等既有的 git 認證不互動防護，在 NewReport 端的 git 操作一樣套用。
7. LINE 通知邏輯不變，只是現在的成敗判斷對象是「push 到 NewReport」而非「push 到 report」。

### 各 bat 同步檔案清單

| bat | 同步到 NewReport 的檔案 |
|---|---|
| `daily_update.bat` | `A_Qware_Revenue_Report_Daily.html`、`D_GA_Funnel_202606_Report.html`、`E_DMP_Funnel_Report.html`、`report_index.html`、`HTML_Report_Catalog.html`、（每月 2 日另加）`A_Qware_Revenue_Report_YYYY年MM月_分析報表.html`、（每月 10 日另加）`A_GA_Traffic_Analysis_Report.html` |
| `update_ga_report.bat` | `A_GA_Events_Traffic_Report.html`、`HTML_Report_Catalog.html`（若有異動） |
| `weekly_update.bat` | `A_Qware_Revenue_Report_Weekly_*.html`（僅 NewReport 端不存在時新增）、`HTML_Report_Catalog.html` |
| `update_dmp_alltime_top10.bat` | `A_DMP_PageView_Report_AllTime_Top10.html`、`dmp_details_alltime/*.html`（10 份）、`HTML_Report_Catalog.html` |

`Scheduled_Tasks_Dashboard.html` 若有異動（例如排程狀態欄位更新），跟著任一支觸發時一併同步；沒有固定綁在哪支 bat，由改到它的那支負責帶上。

## 退休項目

- `sync_newreport.bat` 停用（檔案保留、不刪除，比照 `travel/auto_update.bat` 的停用慣例）。
- `Qware_NewReport_Sync_Daily`（每日 20:00）排程設為 Disabled。
- `REPORT_SPEC_SCHEDULED_TASKS.md` §5.6 標註為「已停用（2026/07/29 起改為各排程即時同步，見新 spec）」，§1 總覽表同步更新狀態欄。

## 待知悉但這次不處理

- `lard23chen.github.io/report` 網站本身：之後停止更新但不刪除，繼續掛著當歷史存檔；要不要加導頁提示到 NewReport，之後再議。
- `D:\2025\AI\MongoDB` 的 git working tree 之後會持續顯示未 commit 的異動（因為不再對 `report` 做 add/commit），屬預期行為、不影響排程運作。
- NewReport 的 `company` remote 用途未知（不在任何既有 spec 文件中），這次完全不動，僅操作 `origin`。

## 風險

- 4 支 bat 都要改，範圍不小；建議逐支改完就手動觸發驗證一次（比照 `update_dmp_alltime_top10.bat` 當初的建置驗證方式），確認 push 到 NewReport 成功、`HTML_Report_Catalog.html` 連結可正常開啟，再繼續下一支。
- 移除對 `report` 的 push 後，若之後又想找回某天 `report` 端的舊版報表比對，只能從 `report` repo 的既有 git 歷史（凍結前）回溯；NewReport 是全新獨立歷史，2026/07/24 之前的版本不在其中。
