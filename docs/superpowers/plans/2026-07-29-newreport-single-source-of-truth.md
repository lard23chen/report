# NewReport Single Source of Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the 4 scheduled report bats (`daily_update.bat`, `update_ga_report.bat`, `weekly_update.bat`, `update_dmp_alltime_top10.bat`) from pushing to `report` (`origin` in `D:\2025\AI\MongoDB`), and instead have each push its output directly and immediately to `NewReport` (`origin` + `company` remotes in `D:\2025\AI\NewReport`), retiring the once-daily `sync_newreport.bat` batch-sync step.

**Architecture:** Node generation keeps running in `D:\2025\AI\MongoDB` unchanged (this is where `.env`/MongoDB connectivity/`node_modules` live). Each bat, after generating its reports, copies only the files it actually produced into `D:\2025\AI\NewReport` and does `git add <named files>` → `commit` → `pull --rebase --autostash` (both `origin` and `company`) → `push` (both remotes), guarded by the existing `.sync_lock` mutex pattern from `sync_newreport.bat` (needed because all 4 bats now write into the *same* NewReport repo, unlike today where each wrote into a different repo). No `git add .` is used anywhere in this plan — each bat only stages files it deterministically produced, per the corrected file-list table in the spec.

**Tech Stack:** Windows `cmd.exe` batch scripts, git, Windows Task Scheduler (`schtasks`/`ScheduledTasks` PowerShell cmdlets), existing `send_line_notify.ps1`.

**Spec:** `docs/superpowers/specs/2026-07-29-newreport-single-source-of-truth-design.md`

---

### Task 0: Confirm working state before touching anything

**Files:** none (read-only checks)

- [ ] **Step 1: Confirm both repos are clean and up to date**

Run:
```
cd /d D:\2025\AI\MongoDB
git status
git pull --rebase --autostash origin main
cd /d D:\2025\AI\NewReport
git status
git pull --rebase --autostash origin main
git pull --rebase --autostash company main
```
Expected: no unexpected uncommitted changes in either repo (the known `daily_log.txt` local-only diff in `D:\2025\AI\MongoDB` is fine — logs are never committed per this plan); both repos report "up to date" after pulling from both remotes.

- [ ] **Step 2: Confirm `dmp_details_alltime` exists in NewReport with the 10 detail files**

Run: `dir "D:\2025\AI\NewReport\dmp_details_alltime\*.html"`
Expected: 10 `.html` files listed (already verified present during planning — this step just re-confirms before the DMP bat is changed).

---

### Task 1: Modify `daily_update.bat` to sync to NewReport instead of `report`

**Files:**
- Modify: `D:\2025\AI\MongoDB\daily_update.bat`

The existing file has two report-push blocks to remove: the early independent commit for `A_Qware_Revenue_Report_Daily.html` (added 2026/07/24 to reduce a commit-loss window — no longer needed since we stop touching `report` entirely) and the final `git add .` block. Both are replaced by one consolidated NewReport sync block at the end. `setlocal enabledelayedexpansion` is added so the conditional (day-2 monthly / day-10 GA) extra files can be appended to a file list safely inside `if` blocks — plain `%VAR%` expansion happens at block-parse time and would not pick up a value set earlier in the same script reliably once nested inside further blocks, so `!VAR!` (delayed expansion) is used for that one variable.

- [ ] **Step 1: Replace the full file contents**

```bat
@echo off
setlocal enabledelayedexpansion
cd /d D:\2025\AI\MongoDB

:: Fail fast instead of hanging forever if git needs credentials (no UI in scheduled session)
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never

:: Skip if already completed today
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy/MM/dd"') do set TODAY=%%d
findstr /c:"[%TODAY%" daily_log.txt | findstr "Update Completed" >nul 2>&1
if %errorlevel%==0 (
    echo [%date% %time%] Already completed today, skipping. >> daily_log.txt
    exit /b 0
)

echo [%date% %time%] Starting Daily Report Update... >> daily_log.txt

:: 失敗告警（2026/07/23 新增）：各 script 出錯不中斷（維持既有 best-effort 行為，
:: 讓其他成功的報表照常推上去），但記下失敗的 script 名稱，最後統一發 LINE 告警。
set FAILED_STEPS=

echo Running generate_a_daily_report.js...
"D:\nodejs\node.exe" generate_a_daily_report.js >> daily_log.txt 2>&1
if errorlevel 1 set FAILED_STEPS=%FAILED_STEPS%generate_a_daily_report.js;

echo Running generate_d_ga_funnel_report.js...
"D:\nodejs\node.exe" generate_d_ga_funnel_report.js >> daily_log.txt 2>&1
if errorlevel 1 set FAILED_STEPS=%FAILED_STEPS%generate_d_ga_funnel_report.js;

echo Running generate_d_ga_funnel_cart_data.js...
"D:\nodejs\node.exe" generate_d_ga_funnel_cart_data.js >> daily_log.txt 2>&1
if errorlevel 1 set FAILED_STEPS=%FAILED_STEPS%generate_d_ga_funnel_cart_data.js;

echo Running generate_e_dmp_funnel_report.js...
"D:\nodejs\node.exe" generate_e_dmp_funnel_report.js >> daily_log.txt 2>&1
if errorlevel 1 set FAILED_STEPS=%FAILED_STEPS%generate_e_dmp_funnel_report.js;

echo Running update_index_stats.js (monthly stats update)...
"D:\nodejs\node.exe" update_index_stats.js >> daily_log.txt 2>&1
if errorlevel 1 set FAILED_STEPS=%FAILED_STEPS%update_index_stats.js;

set EXTRA_FILES=

for /f %%d in ('powershell -NoProfile -Command "(Get-Date).Day"') do set TODAY_DAY=%%d
if "%TODAY_DAY%"=="2" (
    echo [%date% %time%] Day 2 detected - generating previous month report... >> daily_log.txt
    "D:\nodejs\node.exe" generate_monthly_report.js >> daily_log.txt 2>&1
    if errorlevel 1 (
        set FAILED_STEPS=%FAILED_STEPS%generate_monthly_report.js;
    ) else (
        for /f "delims=" %%M in ('dir /b /o-d "A_Qware_Revenue_Report_*年*月_分析報表.html" 2^>nul') do (
            set EXTRA_FILES=!EXTRA_FILES! %%M
            goto monthly_file_found
        )
        :monthly_file_found
    )
)
if "%TODAY_DAY%"=="10" (
    echo [%date% %time%] Day 10 detected - updating GA Traffic Analysis Report... >> daily_log.txt
    "D:\nodejs\node.exe" generate_ga_report.js >> daily_log.txt 2>&1
    if errorlevel 1 (
        set FAILED_STEPS=%FAILED_STEPS%generate_ga_report.js;
    ) else (
        set EXTRA_FILES=!EXTRA_FILES! A_GA_Traffic_Analysis_Report.html
    )
)

echo [%date% %time%] Update Completed. >> daily_log.txt

echo Syncing to NewReport...
:: NewReport push（2026/07/29 起取代原本對 report/origin 的推送；report repo 之後不再由
:: 排程自動 commit，改為即時同步進 NewReport，見
:: docs/superpowers/specs/2026-07-29-newreport-single-source-of-truth-design.md）
set SYNC_FILES=A_Qware_Revenue_Report_Daily.html D_GA_Funnel_202606_Report.html E_DMP_Funnel_Report.html report_index.html!EXTRA_FILES!

set SYNC_LOCK=D:\2025\AI\NewReport\.sync_lock
set /a LOCK_TRIES=0
:acquire_sync_lock
md "%SYNC_LOCK%" 2>nul && goto sync_lock_ok
set /a LOCK_TRIES+=1
if %LOCK_TRIES% geq 120 goto sync_lock_ok
ping -n 6 127.0.0.1 >nul
goto acquire_sync_lock
:sync_lock_ok

cd /d D:\2025\AI\NewReport
if exist "D:\2025\AI\NewReport\.git\rebase-merge" rd /s /q "D:\2025\AI\NewReport\.git\rebase-merge"
git pull --rebase --autostash origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
git pull --rebase --autostash company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1

cd /d D:\2025\AI\MongoDB
for %%F in (%SYNC_FILES%) do copy /y "D:\2025\AI\MongoDB\%%F" "D:\2025\AI\NewReport\%%F" >nul

cd /d D:\2025\AI\NewReport
git add %SYNC_FILES%
git commit -m "Auto-update Daily Reports: %date% %time%" >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 (
    echo [%date% %time%] NewReport: nothing to commit. >> D:\2025\AI\MongoDB\daily_log.txt
) else (
    git pull --rebase --autostash origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
    if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
    git pull --rebase --autostash company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
    if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
    git push origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
    if errorlevel 1 set FAILED_STEPS=%FAILED_STEPS%NewReport-push-origin;
    git push company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
    if errorlevel 1 set FAILED_STEPS=%FAILED_STEPS%NewReport-push-company;
)
cd /d D:\2025\AI\MongoDB
rd "%SYNC_LOCK%" 2>nul

echo Sending LINE notification...
if defined FAILED_STEPS (
    echo [%date% %time%] Completed with failures: %FAILED_STEPS% >> daily_log.txt
    powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "daily" -Status "FAIL" -Detail "%FAILED_STEPS%" >> daily_log.txt 2>&1
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "daily" >> daily_log.txt 2>&1
)

echo Done.
```

- [ ] **Step 2: Verify CRLF line endings survived the write**

Run: `git diff --stat daily_update.bat` and `file daily_update.bat` (or open in an editor and check "CRLF" in the status bar). `.gitattributes` forces `*.bat text eol=crlf` on commit, but the working-tree file itself must already be CRLF before `git diff` is meaningful — if the edit tool wrote LF, `git add`/`git commit` will normalize it on the way in (per `.gitattributes`), so this is a soft check, not a blocker.

- [ ] **Step 3: Manually trigger and verify (no day-2/day-10 branch)**

Run: `del daily_log.txt` is **not** needed — instead temporarily rename today's completed marker out of the way is unnecessary since this is a fresh manual run for testing; just run:
```
cmd /c "D:\2025\AI\MongoDB\daily_update.bat"
```
Expected: exits 0; `daily_log.txt` shows `Update Completed.` and no `Completed with failures`; `cd D:\2025\AI\NewReport && git log -1` shows a new `Auto-update Daily Reports: ...` commit; `git log company/main -1` (after `git fetch company`) matches the same commit; `cd D:\2025\AI\MongoDB && git status` shows **no new commit** in `report` (only the untracked/modified report files sitting in the working tree, never staged).

- [ ] **Step 4: Commit**

```bash
git add daily_update.bat
git commit -m "Push daily report outputs to NewReport instead of report repo"
```

---

### Task 2: Modify `update_ga_report.bat`

**Files:**
- Modify: `D:\2025\AI\MongoDB\update_ga_report.bat`

- [ ] **Step 1: Replace the full file contents**

```bat
@echo off
cd /d D:\2025\AI\MongoDB

:: Fail fast instead of hanging forever if git needs credentials (no UI in scheduled session)
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never

node generate_ga_events_report.js
if errorlevel 1 goto :fail_generate

:: NewReport push（2026/07/29 起取代原本對 report/origin 的推送；見
:: docs/superpowers/specs/2026-07-29-newreport-single-source-of-truth-design.md）
set SYNC_LOCK=D:\2025\AI\NewReport\.sync_lock
set /a LOCK_TRIES=0
:acquire_sync_lock
md "%SYNC_LOCK%" 2>nul && goto sync_lock_ok
set /a LOCK_TRIES+=1
if %LOCK_TRIES% geq 120 goto sync_lock_ok
ping -n 6 127.0.0.1 >nul
goto acquire_sync_lock
:sync_lock_ok

cd /d D:\2025\AI\NewReport
if exist "D:\2025\AI\NewReport\.git\rebase-merge" rd /s /q "D:\2025\AI\NewReport\.git\rebase-merge"
git pull --rebase --autostash origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
git pull --rebase --autostash company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1

copy /y "D:\2025\AI\MongoDB\A_GA_Events_Traffic_Report.html" "D:\2025\AI\NewReport\A_GA_Events_Traffic_Report.html" >nul

git add A_GA_Events_Traffic_Report.html
git commit -m "Auto-update GA Traffic Reports: %date% %time%" >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 (
    cd /d D:\2025\AI\MongoDB
    rd "%SYNC_LOCK%" 2>nul
    powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "ga"
    exit /b 0
)
git pull --rebase --autostash origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
git pull --rebase --autostash company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
git push origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 (
    cd /d D:\2025\AI\MongoDB
    rd "%SYNC_LOCK%" 2>nul
    goto :fail_push
)
git push company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 (
    cd /d D:\2025\AI\MongoDB
    rd "%SYNC_LOCK%" 2>nul
    goto :fail_push
)

cd /d D:\2025\AI\MongoDB
rd "%SYNC_LOCK%" 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "ga"
exit /b 0

:fail_generate
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "ga" -Status "FAIL" -Detail "報表產生失敗（generate_ga_events_report.js）"
exit /b 1

:fail_push
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "ga" -Status "FAIL" -Detail "NewReport git push 失敗"
exit /b 1
```

- [ ] **Step 2: Manually trigger and verify**

Run: `cmd /c "D:\2025\AI\MongoDB\update_ga_report.bat"`
Expected: exits 0; `cd D:\2025\AI\NewReport && git log -1` shows `Auto-update GA Traffic Reports: ...`; `report` repo (`D:\2025\AI\MongoDB`) has no new commit.

- [ ] **Step 3: Commit**

```bash
git add update_ga_report.bat
git commit -m "Push GA report output to NewReport instead of report repo"
```

---

### Task 3: Modify `weekly_update.bat`

**Files:**
- Modify: `D:\2025\AI\MongoDB\weekly_update.bat`

- [ ] **Step 1: Replace the full file contents**

```bat
@echo off
cd /d D:\2025\AI\MongoDB

:: Fail fast instead of hanging forever if git needs credentials (no UI in scheduled session)
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never

:: Skip if already completed today
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy/MM/dd"') do set TODAY=%%d
findstr /c:"%TODAY%" weekly_log.txt 2>nul | findstr /c:"Weekly Update Completed" >nul 2>&1
if %errorlevel%==0 (
    echo [%date% %time%] Already completed today, skipping. >> weekly_log.txt
    exit /b 0
)

echo [%date% %time%] Starting Weekly Report Update... >> weekly_log.txt

echo Running generate_a_weekly_report.js...
"D:\nodejs\node.exe" generate_a_weekly_report.js >> weekly_log.txt 2>&1
if errorlevel 1 goto :fail_generate

echo [%date% %time%] Weekly Update Completed. >> weekly_log.txt

echo Syncing to NewReport...
:: NewReport push（2026/07/29 起取代原本對 report/origin 的推送；見
:: docs/superpowers/specs/2026-07-29-newreport-single-source-of-truth-design.md）
set SYNC_LOCK=D:\2025\AI\NewReport\.sync_lock
set /a LOCK_TRIES=0
:acquire_sync_lock
md "%SYNC_LOCK%" 2>nul && goto sync_lock_ok
set /a LOCK_TRIES+=1
if %LOCK_TRIES% geq 120 goto sync_lock_ok
ping -n 6 127.0.0.1 >nul
goto acquire_sync_lock
:sync_lock_ok

cd /d D:\2025\AI\NewReport
if exist "D:\2025\AI\NewReport\.git\rebase-merge" rd /s /q "D:\2025\AI\NewReport\.git\rebase-merge"
git pull --rebase --autostash origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
git pull --rebase --autostash company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1

copy /y "D:\2025\AI\MongoDB\report_index.html" "D:\2025\AI\NewReport\report_index.html" >nul
copy /y "D:\2025\AI\MongoDB\HTML_Report_Catalog.html" "D:\2025\AI\NewReport\HTML_Report_Catalog.html" >nul

cd /d D:\2025\AI\MongoDB
for /f "delims=" %%F in ('dir /b /o-d "A_Qware_Revenue_Report_Weekly_*.html" 2^>nul') do (
    if not exist "D:\2025\AI\NewReport\%%F" (
        copy /y "D:\2025\AI\MongoDB\%%F" "D:\2025\AI\NewReport\%%F" >nul
        echo [%date% %time%] Added new weekly report %%F to NewReport >> weekly_log.txt
    )
    goto weekly_copy_done
)
:weekly_copy_done

cd /d D:\2025\AI\NewReport
git add report_index.html HTML_Report_Catalog.html A_Qware_Revenue_Report_Weekly_*.html
git commit -m "Auto Update Weekly Report: %date% %time%" >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 (
    cd /d D:\2025\AI\MongoDB
    rd "%SYNC_LOCK%" 2>nul
    echo Done.
    exit /b 0
)
git pull --rebase --autostash origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
git pull --rebase --autostash company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
git push origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 (
    cd /d D:\2025\AI\MongoDB
    rd "%SYNC_LOCK%" 2>nul
    goto :fail_push
)
git push company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 (
    cd /d D:\2025\AI\MongoDB
    rd "%SYNC_LOCK%" 2>nul
    goto :fail_push
)

cd /d D:\2025\AI\MongoDB
rd "%SYNC_LOCK%" 2>nul

echo Done.
exit /b 0

:fail_generate
echo [%date% %time%] FAILED: generate_a_weekly_report.js. >> weekly_log.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "weekly" -Status "FAIL" -Detail "報表產生失敗（generate_a_weekly_report.js）" >> weekly_log.txt 2>&1
exit /b 1

:fail_push
echo [%date% %time%] FAILED: NewReport git push step. >> weekly_log.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "weekly" -Status "FAIL" -Detail "NewReport git push 失敗" >> weekly_log.txt 2>&1
exit /b 1
```

Note: original `weekly_update.bat` sends **no** LINE notification on success (only on failure) — this is preserved as-is, not a bug to fix.

- [ ] **Step 2: Manually trigger and verify**

Weekly has a same-day duplicate-run guard, so if it was already run today the manual test will just skip. Force a real run by checking `weekly_log.txt` for today's `Weekly Update Completed` line first; if present, this step can be verified by re-reading the most recent real run's result instead of re-triggering (don't fabricate a fake log entry to bypass the guard — that would corrupt the duplicate-run protection for real scheduled runs today).

Run: `cmd /c "D:\2025\AI\MongoDB\weekly_update.bat"`
Expected (if not already run today): exits 0; `cd D:\2025\AI\NewReport && git log -1` shows `Auto Update Weekly Report: ...`; `report` repo has no new commit.

- [ ] **Step 3: Commit**

```bash
git add weekly_update.bat
git commit -m "Push weekly report output to NewReport instead of report repo"
```

---

### Task 4: Modify `update_dmp_alltime_top10.bat`

**Files:**
- Modify: `D:\2025\AI\MongoDB\update_dmp_alltime_top10.bat`

- [ ] **Step 1: Replace the full file contents**

```bat
@echo off
cd /d D:\2025\AI\MongoDB

:: Fail fast instead of hanging forever if git needs credentials (no UI in scheduled session)
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never

:: Skip if already completed this month (incremental generator makes this safe to retry,
:: but avoids redundant runs if StartWhenAvailable catches up more than once)
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy/MM"') do set THISMONTH=%%d
findstr /c:"%THISMONTH%" dmp_alltime_top10_log.txt 2>nul | findstr /c:"Update finished." >nul 2>&1
if %errorlevel%==0 (
    echo [%date% %time%] Already completed this month, skipping. >> dmp_alltime_top10_log.txt
    exit /b 0
)

echo [%date% %time%] Starting DMP AllTime Top10 update... >> dmp_alltime_top10_log.txt

echo Running generate_alltime_top10_v3.js...
"D:\nodejs\node.exe" generate_alltime_top10_v3.js >> dmp_alltime_top10_log.txt 2>&1
if errorlevel 1 goto :fail_generate

echo [%date% %time%] Update finished. >> dmp_alltime_top10_log.txt

echo Syncing to NewReport...
:: NewReport push（2026/07/29 起取代原本對 report/origin 的推送；見
:: docs/superpowers/specs/2026-07-29-newreport-single-source-of-truth-design.md）
set SYNC_LOCK=D:\2025\AI\NewReport\.sync_lock
set /a LOCK_TRIES=0
:acquire_sync_lock
md "%SYNC_LOCK%" 2>nul && goto sync_lock_ok
set /a LOCK_TRIES+=1
if %LOCK_TRIES% geq 120 goto sync_lock_ok
ping -n 6 127.0.0.1 >nul
goto acquire_sync_lock
:sync_lock_ok

cd /d D:\2025\AI\NewReport
if exist "D:\2025\AI\NewReport\.git\rebase-merge" rd /s /q "D:\2025\AI\NewReport\.git\rebase-merge"
git pull --rebase --autostash origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
git pull --rebase --autostash company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1

copy /y "D:\2025\AI\MongoDB\A_DMP_PageView_Report_AllTime_Top10.html" "D:\2025\AI\NewReport\A_DMP_PageView_Report_AllTime_Top10.html" >nul
for %%F in ("D:\2025\AI\MongoDB\dmp_details_alltime\*.html") do (
    copy /y "%%F" "D:\2025\AI\NewReport\dmp_details_alltime\%%~nxF" >nul
)

git add A_DMP_PageView_Report_AllTime_Top10.html dmp_details_alltime\*.html
git commit -m "Auto-update DMP AllTime Top10 report: %date% %time%" >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 (
    cd /d D:\2025\AI\MongoDB
    rd "%SYNC_LOCK%" 2>nul
    powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "dmp_top10" >> dmp_alltime_top10_log.txt 2>&1
    echo Done.
    exit /b 0
)
git pull --rebase --autostash origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
git pull --rebase --autostash company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
git push origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 (
    cd /d D:\2025\AI\MongoDB
    rd "%SYNC_LOCK%" 2>nul
    goto :fail_push
)
git push company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 (
    cd /d D:\2025\AI\MongoDB
    rd "%SYNC_LOCK%" 2>nul
    goto :fail_push
)

cd /d D:\2025\AI\MongoDB
rd "%SYNC_LOCK%" 2>nul

echo Sending LINE notification...
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "dmp_top10" >> dmp_alltime_top10_log.txt 2>&1

echo Done.
exit /b 0

:fail_generate
echo [%date% %time%] FAILED: generate_alltime_top10_v3.js. >> dmp_alltime_top10_log.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "dmp_top10" -Status "FAIL" -Detail "報表產生失敗（generate_alltime_top10_v3.js）" >> dmp_alltime_top10_log.txt 2>&1
exit /b 1

:fail_push
echo [%date% %time%] FAILED: NewReport git push step. >> dmp_alltime_top10_log.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "dmp_top10" -Status "FAIL" -Detail "NewReport git push 失敗" >> dmp_alltime_top10_log.txt 2>&1
exit /b 1
```

- [ ] **Step 2: Manually trigger and verify**

This bat has a same-*month* duplicate-run guard. If already run this month, verify against the most recent real run's log/git history instead of forcing a re-run (do not hand-edit `dmp_alltime_top10_log.txt` to bypass the guard).

Run: `cmd /c "D:\2025\AI\MongoDB\update_dmp_alltime_top10.bat"`
Expected (if not already run this month): exits 0; `cd D:\2025\AI\NewReport && git log -1` shows `Auto-update DMP AllTime Top10 report: ...`; `report` repo has no new commit.

- [ ] **Step 3: Commit**

```bash
git add update_dmp_alltime_top10.bat
git commit -m "Push DMP AllTime Top10 report output to NewReport instead of report repo"
```

---

### Task 5: Retire `sync_newreport.bat` and its scheduled task

**Files:**
- Modify: `D:\2025\AI\MongoDB\sync_newreport.bat` (mark disabled, do not delete)

- [ ] **Step 1: Add a disabled-header comment to the top of the file**

Insert immediately after `@echo off` on line 1:

```bat
@echo off
:: 已停用（2026/07/29）：即時同步已內建到 daily_update.bat / update_ga_report.bat /
:: weekly_update.bat / update_dmp_alltime_top10.bat 各自的排程尾端，不再需要每日 20:00
:: 批次補跑。檔案保留供參考，對應排程 Qware_NewReport_Sync_Daily 已 Disable。見
:: docs/superpowers/specs/2026-07-29-newreport-single-source-of-truth-design.md
setlocal enabledelayedexpansion
set SRC=D:\2025\AI\MongoDB
```

(This replaces the original line 1 `@echo off` and line 2 `setlocal enabledelayedexpansion` — everything from the original line 3 onward, `set SRC=D:\2025\AI\MongoDB`, stays unchanged since it's now on its own line right after. The rest of the file body is untouched; the task scheduler entry being disabled in Step 2 is what actually stops it from running, this comment is just documentation for anyone opening the file later.)

- [ ] **Step 2: Disable the Windows scheduled task**

Run:
```
Get-ScheduledTask -TaskName "Qware_NewReport_Sync_Daily" | Disable-ScheduledTask
Get-ScheduledTask -TaskName "Qware_NewReport_Sync_Daily" | Select-Object TaskName, State
```
Expected: `State` shows `Disabled`.

- [ ] **Step 3: Commit**

```bash
git add sync_newreport.bat
git commit -m "Mark sync_newreport.bat as retired after switching to per-schedule immediate sync"
```

---

### Task 6: One-time manual sync of files the automated bats never touch

**Files:** none tracked by git in this repo (manual file copy only)

`Scheduled_Tasks_Dashboard.html` and `HTML_Report_Catalog.html` are not both covered by the 4 bats — `HTML_Report_Catalog.html` is only refreshed by `weekly_update.bat` (Task 3), and `Scheduled_Tasks_Dashboard.html` isn't touched by any script at all. Bring NewReport's copies up to date once so they're not stuck on the 2026/07/24 snapshot.

- [ ] **Step 1: Copy current versions into NewReport**

Run:
```
copy /y "D:\2025\AI\MongoDB\HTML_Report_Catalog.html" "D:\2025\AI\NewReport\HTML_Report_Catalog.html"
copy /y "D:\2025\AI\MongoDB\Scheduled_Tasks_Dashboard.html" "D:\2025\AI\NewReport\Scheduled_Tasks_Dashboard.html"
```

- [ ] **Step 2: Commit and push to both NewReport remotes**

Run:
```
cd /d D:\2025\AI\NewReport
git add HTML_Report_Catalog.html Scheduled_Tasks_Dashboard.html
git commit -m "One-time sync of catalog and dashboard pages ahead of automated weekly sync"
git pull --rebase --autostash origin main
git pull --rebase --autostash company main
git push origin main
git push company main
```
Expected: both pushes succeed (or report the actual failure — do not silently ignore a push failure here, this is a manual one-off run, not a scheduled task with retry).

---

### Task 7: Update `REPORT_SPEC_SCHEDULED_TASKS.md`

**Files:**
- Modify: `D:\2025\AI\MongoDB\REPORT_SPEC_SCHEDULED_TASKS.md`

Per `CLAUDE.md`'s "開發後必做" rule, the spec doc must be updated to reflect the new behavior, not just the design doc under `docs/superpowers/`.

- [ ] **Step 1: Update the §1 overview table's `Qware_NewReport_Sync_Daily` row**

Find the row:
```
| `Qware_NewReport_Sync_Daily` | `sync_newreport.bat` | 每日 20:00 | 2026/07/27（建立時手動驗證，見 §5.6） | Ready |
```
Replace with:
```
| `Qware_NewReport_Sync_Daily` | `sync_newreport.bat` | 每日 20:00 | 2026/07/28（最後一次執行；2026/07/29 起停用） | **Disabled（2026/07/29）** |
```

- [ ] **Step 2: Replace the §5.6 section body**

Locate the `## 5.6 sync_newreport.bat（2026/07/27 新增）` heading and everything through the section before `## 6. 維護注意事項`. Replace the section content (keep the heading) with:

```markdown
## 5.6 sync_newreport.bat（2026/07/27 新增，2026/07/29 起停用）

### 5.6.1 背景（歷史）

`https://github.com/lard23chen/NewReport` 是 2026/07/24 從本 repo（`lard23chen/report`）依 `HTML_Report_Catalog.html` 列表複製出的獨立新 repo（各自獨立的 git 歷史，非 fork），本機持久複本在 `D:\2025\AI\NewReport`。原本靠這支 bat 每日 20:00 批次同步，`report` repo 才是真相來源。

### 5.6.2 現況（2026/07/29 起）

使用者決定停止維護兩個 repo，改以 `NewReport` 為唯一真相來源。`daily_update.bat` / `update_ga_report.bat` / `weekly_update.bat` / `update_dmp_alltime_top10.bat` 四支排程各自在產出報表後，直接同步進 `D:\2025\AI\NewReport` 並推送到 `origin`（`lard23chen/NewReport`）與 `company`（`org-ticket-mgmt/ViewReport`，公司內部 repo）兩個 remote，不再等每日 20:00 批次補跑。`report` repo（`D:\2025\AI\MongoDB` 對 `origin` 這個 remote）之後不再有任何排程自動 commit；本機的 `.env`／MongoDB 連線／`node_modules`／所有 `generate_xxx.js` 原始碼仍留在 `D:\2025\AI\MongoDB` 不搬家，只是不再是 git 層面的發布目標。

`sync_newreport.bat` 檔案保留但排程 `Qware_NewReport_Sync_Daily` 已 Disable，不再觸發。各 bat 內建的同步邏輯沿用這支 bat 原本的鎖機制（`D:\2025\AI\NewReport\.sync_lock`，與 `report` repo 的 `.git_bat_lock` 分開）與「一律複製、只信任 git commit 自身判斷」的教訓（見 5.6.4 舊版說明，CRLF/LF 正規化問題）。

完整設計與各 bat 的同步檔案清單見 `docs/superpowers/specs/2026-07-29-newreport-single-source-of-truth-design.md`。

### 5.6.3 company remote 補充說明

`D:\2025\AI\NewReport` 有第二個 remote `company`（`git@github-company:org-ticket-mgmt/ViewReport.git`），實作前查證時發現這是**現行就在使用**的公司內部同步（`main` 分支與 `origin` 完全同步、還有一個 `codex/ec2-iis-deploy` 分支與開著的 PR #1），推測會部署到公司 EC2/IIS 環境。四支排程 bat 的 NewReport 同步區段都會同時 `pull --rebase --autostash` 與 `push` 這兩個 remote，維持這個既有行為；`company` repo 的確切下游用途仍未完全確認。
```

- [ ] **Step 3: Update the header note in §1 (just above the overview table) if it still says local Windows scheduling is "唯一主力" without mentioning NewReport**

Find the sentence starting with `> **備注**：` after the §1 table and add a new note line right after it:
```
> **2026/07/29**：`Qware_NewReport_Sync_Daily` 排程停用，`report` repo 之後不再由排程自動 commit；4 支排程改為直接同步進 `NewReport`（`origin` + `company` 兩個 remote），詳見 §5.6.2。
```

- [ ] **Step 4: Commit**

```bash
git add REPORT_SPEC_SCHEDULED_TASKS.md
git commit -m "Document NewReport-direct-push architecture in scheduled tasks spec"
```

---

### Task 8: Final end-to-end sanity check and push

**Files:** none

- [ ] **Step 1: Confirm no bat still references `report`'s `origin` remote in a push context**

Run: `findstr /s /i "git push origin" *.bat` in `D:\2025\AI\MongoDB`
Expected: no matches inside `daily_update.bat`, `update_ga_report.bat`, `weekly_update.bat`, `update_dmp_alltime_top10.bat` (they now only reference `push` while `cd`'d into `D:\2025\AI\NewReport`, i.e. still literally `git push origin main` but against NewReport's `origin`, not report's — confirm by checking each `git push origin main` line is preceded by a `cd /d D:\2025\AI\NewReport` earlier in the same block with no intervening `cd /d D:\2025\AI\MongoDB`).

- [ ] **Step 2: Confirm `report`'s git history only has the human-driven commits from this plan (no scheduled-report commits) since Task 1 started**

Run: `cd /d D:\2025\AI\MongoDB && git log --oneline -20`
Expected: entries match this plan's Task 1–7 commit messages plus whatever was there before; no `Auto Update Daily Reports:` / `Auto-update GA Traffic Reports:` / `Auto Update Weekly Report:` / `Auto-update DMP AllTime Top10 report:` style commits dated after the Task 1 change went in.

- [ ] **Step 3: Push `report`'s commits**

```bash
git push origin main
```

Expected: push succeeds (this is a normal source-code push for `report`, unaffected by the "stop pushing report *data*" decision — only the automated report-data commits stop, not human/dev-driven commits to the automation scripts and spec docs themselves).
