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
