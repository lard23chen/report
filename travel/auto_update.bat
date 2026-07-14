@echo off
cd /d "d:\2025\AI\MongoDB\travel"

:: Fail fast instead of hanging forever if git needs credentials (no UI in scheduled session)
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never
echo %DATE% %TIME% - Starting update process... >> update_log.txt

:: 1. Download latest CSV
echo Downloading CSV... >> update_log.txt
powershell -Command "Invoke-WebRequest -Uri 'https://docs.google.com/spreadsheets/d/1pZCR_nVgyhwYldCRxfum4AsC-vxSFdjnkqAotzeV1CI/export?format=csv&gid=0' -OutFile 'new_analysis_data.csv'" >> update_log.txt 2>&1

:: 2. Regenerate HTML
echo Regenerating HTML... >> update_log.txt
node generate_expense_report.js >> update_log.txt 2>&1

:: 2b. Download Shopping CSV & Reference HTML
echo Downloading Shopping CSV... >> update_log.txt
powershell -Command "Invoke-WebRequest -Uri 'https://docs.google.com/spreadsheets/d/1fgJbzRvnn-4VUbn6PIMh2PyDpxkNPJo8MbuEj4pNt1M/export?format=csv&gid=1320702581' -OutFile 'new_data_gid_1320702581.csv'" >> update_log.txt 2>&1
echo Downloading Reference Site... >> update_log.txt
powershell -Command "Invoke-WebRequest -Uri 'https://togoarai.github.io/20260211-Wishing-in-Thailand/' -OutFile 'reference_site.html'" >> update_log.txt 2>&1
echo Regenerating Shopping Report... >> update_log.txt
node generate_shopping_report.js >> update_log.txt 2>&1

:: 3. Git Push
echo Pushing to GitHub... >> update_log.txt
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
git add .
git commit -m "Auto-update expense report: %DATE% %TIME%"
:: Rebase onto remote first so pushes from other machines don't cause non-fast-forward rejection
git pull --rebase --autostash origin main >> git_sync.log 2>&1
if errorlevel 1 (
    echo %DATE% %TIME% - git pull --rebase failed, aborting rebase. See git_sync.log >> update_log.txt
    git rebase --abort >> git_sync.log 2>&1
)
git push origin main >> git_sync.log 2>&1
rd "%GIT_BAT_LOCK%" 2>nul

echo Update finished. >> update_log.txt

echo Sending LINE notification...
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "travel" >> update_log.txt 2>&1
