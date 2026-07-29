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
- `D:\2025\AI\NewReport` 的第二個 remote `company`（`git@github-company:org-ticket-mgmt/ViewReport.git`）**需要跟 `origin` 一起推**——查證後發現這不是廢棄設定，`sync_newreport.bat` 現行就會同時推 `origin` 與 `company`，且 `company` 那邊的 `main` 分支與 `origin` 完全同步、還有一個 `codex/ec2-iis-deploy` 分支與開著的 PR #1，判斷是公司內部有系統依賴這份同步（可能部署到 EC2/IIS）。退休 `sync_newreport.bat` 後，這個 push 行為必須由 4 支排程 bat 接手維持，否則公司那邊的資料會停更。
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
   git pull --rebase --autostash origin main    # 失敗則 git rebase --abort
   git pull --rebase --autostash company main   # 同上，失敗則 git rebase --abort
   git push origin main                         # 輸出導向 git_sync.log（NewReport 端另建一份，避免鎖到主 log）
   git push company main                        # 沿用 sync_newreport.bat 現行行為，維持公司內部 repo 同步
   ```
   若 commit 因無變更而 errorlevel（nothing to commit）→ 視為成功、跳過兩個 push，不視為失敗。
   任一 push（origin 或 company）失敗都視為這次同步失敗，記入 FAILED_STEPS 並在 LINE 告警的 Detail 註明是哪一個 remote 失敗。
5. **移除**原本在 `D:\2025\AI\MongoDB` 對 `report`（`origin`）的 git add/commit/push 段落（含 `generate_a_daily_report.js` 現有的獨立提交邏輯，§2.2 提到的 2026/07/24 新增機制）。
6. `GIT_TERMINAL_PROMPT=0`、`GCM_INTERACTIVE=never` 等既有的 git 認證不互動防護，在 NewReport 端的 git 操作一樣套用。
7. LINE 通知邏輯不變，只是現在的成敗判斷對象是「push 到 NewReport」而非「push 到 report」。

### 各 bat 同步檔案清單

| bat | 同步到 NewReport 的檔案 |
|---|---|
| `daily_update.bat` | `A_Qware_Revenue_Report_Daily.html`、`D_GA_Funnel_202606_Report.html`、`E_DMP_Funnel_Report.html`、`report_index.html`、（每月 2 日另加）`A_Qware_Revenue_Report_YYYY年MM月_分析報表.html`、（每月 10 日另加）`A_GA_Traffic_Analysis_Report.html` |
| `update_ga_report.bat` | `A_GA_Events_Traffic_Report.html` |
| `weekly_update.bat` | `A_Qware_Revenue_Report_Weekly_*.html`（僅 NewReport 端不存在時新增）、`report_index.html`、`HTML_Report_Catalog.html` |
| `update_dmp_alltime_top10.bat` | `A_DMP_PageView_Report_AllTime_Top10.html`、`dmp_details_alltime/*.html`（10 份） |

> **修正（實作前查證）**：原稿以為 daily/GA/DMP 也會動到 `HTML_Report_Catalog.html`，但實際 grep 各 `generate_xxx.js` 後確認**只有 `generate_a_weekly_report.js` 會呼叫 `updateCatalogRow()` 寫入目錄頁**，daily/GA/DMP 三支排程完全不碰它；`report_index.html` 則是 `update_index_stats.js`（daily 排程內）與 `generate_a_weekly_report.js`（weekly 排程內）都會寫入，兩邊都要同步。新流程改用「指名同步」（不像現行 report 端用 `git add .` 會順便撈到任何殘留異動），所以每支 bat 只同步自己腳本實際產出的檔案，不多加。
>
> `Scheduled_Tasks_Dashboard.html` 目前沒有任何腳本自動更新它（純手動維護），這次不需要、也不會被排到任何 bat 的自動同步清單裡；遷移時人工複製一份到 NewReport 即可，之後手動編輯要記得手動同步兩邊（不在本次自動化範圍內）。

## 退休項目

- `sync_newreport.bat` 停用（檔案保留、不刪除，比照 `travel/auto_update.bat` 的停用慣例）。
- `Qware_NewReport_Sync_Daily`（每日 20:00）排程設為 Disabled。
- `REPORT_SPEC_SCHEDULED_TASKS.md` §5.6 標註為「已停用（2026/07/29 起改為各排程即時同步，見新 spec）」，§1 總覽表同步更新狀態欄。

## 待知悉但這次不處理

- `lard23chen.github.io/report` 網站本身：之後停止更新但不刪除，繼續掛著當歷史存檔；要不要加導頁提示到 NewReport，之後再議。
- `D:\2025\AI\MongoDB` 的 git working tree 之後會持續顯示未 commit 的異動（因為不再對 `report` 做 add/commit），屬預期行為、不影響排程運作。
- NewReport 的 `company` remote 對應公司內部系統的確切用途（是否真的部署到 EC2/IIS）仍未完全確認，只是從分支/PR 現況推斷；這次維持現有 push 行為，不深究上游用途。

## 風險

- 4 支 bat 都要改，範圍不小；建議逐支改完就手動觸發驗證一次（比照 `update_dmp_alltime_top10.bat` 當初的建置驗證方式），確認 push 到 NewReport 成功、`HTML_Report_Catalog.html` 連結可正常開啟，再繼續下一支。
- 移除對 `report` 的 push 後，若之後又想找回某天 `report` 端的舊版報表比對，只能從 `report` repo 的既有 git 歷史（凍結前）回溯；NewReport 是全新獨立歷史，2026/07/24 之前的版本不在其中。
