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
git push origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 (
    cd /d D:\2025\AI\MongoDB
    rd "%SYNC_LOCK%" 2>nul
    goto :fail_push
)
git pull --rebase --autostash company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
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
