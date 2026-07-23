@echo off
cd /d D:\2025\AI\MongoDB

:: Fail fast instead of hanging forever if git needs credentials (no UI in scheduled session)
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never

node generate_ga_events_report.js
if errorlevel 1 goto :fail_generate
:: Git 互斥鎖：避免多個排程同時操作 git 互踩（2026/07/14 併發事故防護；最多等 10 分鐘後放行）
set GIT_BAT_LOCK=D:\2025\AI\MongoDB\.git_bat_lock
set /a GITLOCK_TRIES=0
:acquire_git_lock
md "%GIT_BAT_LOCK%" 2>nul && goto git_lock_ok
set /a GITLOCK_TRIES+=1
if %GITLOCK_TRIES% geq 120 goto git_lock_ok
ping -n 6 127.0.0.1 >nul
goto acquire_git_lock
:git_lock_ok
:: 清掉前次失敗 rebase 的殘留狀態（在互斥鎖內執行，安全）
if exist "D:\2025\AI\MongoDB\.git\rebase-merge" rd /s /q "D:\2025\AI\MongoDB\.git\rebase-merge"
git add .
git commit -m "Auto-update GA Traffic Reports: %date% %time%"
:: Rebase onto remote first so pushes from other machines don't cause non-fast-forward rejection
git pull --rebase --autostash origin main >> git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> git_sync.log 2>&1
git push origin main >> git_sync.log 2>&1
if errorlevel 1 (
    rd "%GIT_BAT_LOCK%" 2>nul
    goto :fail_push
)
rd "%GIT_BAT_LOCK%" 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "ga"
exit /b 0

:fail_generate
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "ga" -Status "FAIL" -Detail "報表產生失敗（generate_ga_events_report.js）"
exit /b 1

:fail_push
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "ga" -Status "FAIL" -Detail "git push 失敗"
exit /b 1
