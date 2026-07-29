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
            if not defined EXTRA_FILES set EXTRA_FILES= %%M
        )
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
    git push origin main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
    if errorlevel 1 set FAILED_STEPS=%FAILED_STEPS%NewReport-push-origin;
    git pull --rebase --autostash company main >> D:\2025\AI\MongoDB\git_sync.log 2>&1
    if errorlevel 1 git rebase --abort >> D:\2025\AI\MongoDB\git_sync.log 2>&1
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
