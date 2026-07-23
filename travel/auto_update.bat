@echo off
cd /d "d:\2025\AI\MongoDB\travel"

:: Fail fast instead of hanging forever if git needs credentials (no UI in scheduled session)
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never

:: Skip if already completed today (2026/07/23 新增，比照 daily/weekly_update.bat)
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy/MM/dd"') do set TODAY=%%d
findstr /c:"%TODAY%" update_log.txt 2>nul | findstr /c:"Update finished." >nul 2>&1
if %errorlevel%==0 (
    echo %DATE% %TIME% - Already completed today, skipping. >> update_log.txt
    exit /b 0
)

echo %DATE% %TIME% - Starting update process... >> update_log.txt

:: 1. Download latest CSV
echo Downloading CSV... >> update_log.txt
powershell -Command "Invoke-WebRequest -Uri 'https://docs.google.com/spreadsheets/d/1pZCR_nVgyhwYldCRxfum4AsC-vxSFdjnkqAotzeV1CI/export?format=csv&gid=0' -OutFile 'new_analysis_data.csv'" >> update_log.txt 2>&1
if errorlevel 1 goto :fail_download

:: 2. Regenerate HTML
echo Regenerating HTML... >> update_log.txt
node generate_expense_report.js >> update_log.txt 2>&1
if errorlevel 1 goto :fail_generate

:: 2b. Download Shopping CSV & Reference HTML
echo Downloading Shopping CSV... >> update_log.txt
powershell -Command "Invoke-WebRequest -Uri 'https://docs.google.com/spreadsheets/d/1fgJbzRvnn-4VUbn6PIMh2PyDpxkNPJo8MbuEj4pNt1M/export?format=csv&gid=1320702581' -OutFile 'new_data_gid_1320702581.csv'" >> update_log.txt 2>&1
if errorlevel 1 goto :fail_download
echo Downloading Reference Site... >> update_log.txt
powershell -Command "Invoke-WebRequest -Uri 'https://togoarai.github.io/20260211-Wishing-in-Thailand/' -OutFile 'reference_site.html'" >> update_log.txt 2>&1
if errorlevel 1 goto :fail_download
echo Regenerating Shopping Report... >> update_log.txt
node generate_shopping_report.js >> update_log.txt 2>&1
if errorlevel 1 goto :fail_generate

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
:: 清掉前次失敗 rebase 的殘留狀態（在互斥鎖內執行，安全）
if exist "D:\2025\AI\MongoDB\.git\rebase-merge" rd /s /q "D:\2025\AI\MongoDB\.git\rebase-merge"
git add .
git commit -m "Auto-update expense report: %DATE% %TIME%"
:: Rebase onto remote first so pushes from other machines don't cause non-fast-forward rejection
git pull --rebase --autostash origin main >> git_sync.log 2>&1
if errorlevel 1 (
    echo %DATE% %TIME% - git pull --rebase failed, aborting rebase. See git_sync.log >> update_log.txt
    git rebase --abort >> git_sync.log 2>&1
)
git push origin main >> git_sync.log 2>&1
if errorlevel 1 (
    rd "%GIT_BAT_LOCK%" 2>nul
    goto :fail_push
)
rd "%GIT_BAT_LOCK%" 2>nul

echo %DATE% %TIME% - Update finished. >> update_log.txt

echo Sending LINE notification...
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "travel" >> update_log.txt 2>&1
exit /b 0

:fail_download
echo %DATE% %TIME% - FAILED: CSV/reference download step. >> update_log.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "travel" -Status "FAIL" -Detail "CSV/參考網頁下載失敗" >> update_log.txt 2>&1
exit /b 1

:fail_generate
echo %DATE% %TIME% - FAILED: report generation step. >> update_log.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "travel" -Status "FAIL" -Detail "報表產生失敗（node script）" >> update_log.txt 2>&1
exit /b 1

:fail_push
echo %DATE% %TIME% - FAILED: git push step. >> update_log.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "travel" -Status "FAIL" -Detail "git push 失敗" >> update_log.txt 2>&1
exit /b 1
