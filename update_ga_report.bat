@echo off
cd /d D:\2025\AI\MongoDB

:: Fail fast instead of hanging forever if git needs credentials (no UI in scheduled session)
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never

node generate_ga_events_report.js
git add .
git commit -m "Auto-update GA Traffic Reports: %date% %time%"
:: Rebase onto remote first so pushes from other machines don't cause non-fast-forward rejection
git pull --rebase --autostash origin main >> git_sync.log 2>&1
if errorlevel 1 git rebase --abort >> git_sync.log 2>&1
git push origin main >> git_sync.log 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "ga"
