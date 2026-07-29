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
