@echo off
:: 已停用（2026/07/29）：即時同步已內建到 daily_update.bat / update_ga_report.bat /
:: weekly_update.bat / update_dmp_alltime_top10.bat 各自的排程尾端，不再需要每日 20:00
:: 批次補跑。檔案保留供參考，對應排程 Qware_NewReport_Sync_Daily 已 Disable。見
:: docs/superpowers/specs/2026-07-29-newreport-single-source-of-truth-design.md
setlocal enabledelayedexpansion
set SRC=D:\2025\AI\MongoDB
set DST=D:\2025\AI\NewReport

set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=never

cd /d %SRC%

:: Skip if already run today (this task only needs to run once/day, after all other schedules finish)
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy/MM/dd"') do set TODAY=%%d
findstr /c:"[%TODAY%" newreport_sync_log.txt 2>nul | findstr /c:"Sync check complete" >nul 2>&1
if %errorlevel%==0 (
    echo [%date% %time%] Already ran today, skipping. >> newreport_sync_log.txt
    exit /b 0
)

:: Self-concurrency lock (separate from the main repo's .git_bat_lock; this script touches a different repo)
set SYNC_LOCK=%DST%\.sync_lock
set /a LOCK_TRIES=0
:acquire_sync_lock
md "%SYNC_LOCK%" 2>nul && goto sync_lock_ok
set /a LOCK_TRIES+=1
if %LOCK_TRIES% geq 60 goto sync_lock_ok
ping -n 6 127.0.0.1 >nul
goto acquire_sync_lock
:sync_lock_ok

echo [%date% %time%] Starting NewReport sync... >> newreport_sync_log.txt

:: Make sure both repos are current before copying
cd /d %SRC%
git pull --rebase --autostash origin main >> git_sync.log 2>&1
cd /d %DST%
if exist "%DST%\.git\rebase-merge" rd /s /q "%DST%\.git\rebase-merge"
git pull --rebase --autostash origin main >> "%SRC%\git_sync.log" 2>&1

:: Always copy the current state and let "git commit" itself decide (via normalized blob
:: content) whether anything actually changed - avoids false positives from CRLF/LF
:: differences between the two working trees that a raw byte/fc compare would trip on.

:: --- S1/S2/S5 fixed-name scheduled report outputs ---
for %%F in (A_Qware_Revenue_Report_Daily.html D_GA_Funnel_202606_Report.html E_DMP_Funnel_Report.html report_index.html A_GA_Events_Traffic_Report.html A_DMP_PageView_Report_AllTime_Top10.html) do (
    copy /y "%SRC%\%%F" "%DST%\%%F" >nul
)

:: --- S5 DMP AllTime Top10 detail pages (10 files) ---
for %%F in ("%SRC%\dmp_details_alltime\*.html") do (
    copy /y "%%F" "%DST%\dmp_details_alltime\%%~nxF" >nul
)

:: --- S3 weekly report: filename changes each week, only need to add the newest if missing ---
for /f "delims=" %%F in ('dir /b /o-d "%SRC%\A_Qware_Revenue_Report_Weekly_*.html" 2^>nul') do (
    if not exist "%DST%\%%F" (
        copy /y "%SRC%\%%F" "%DST%\%%F" >nul
        echo [%date% %time%]   added new weekly report %%F >> "%SRC%\newreport_sync_log.txt"
    )
    goto weekly_done
)
:weekly_done

cd /d %DST%
git add A_Qware_Revenue_Report_Daily.html D_GA_Funnel_202606_Report.html E_DMP_Funnel_Report.html report_index.html A_GA_Events_Traffic_Report.html A_DMP_PageView_Report_AllTime_Top10.html dmp_details_alltime A_Qware_Revenue_Report_Weekly_*.html
git commit -m "Sync scheduled report outputs from lard23chen/report: %date% %time%" >> "%SRC%\newreport_sync_log.txt" 2>&1
if errorlevel 1 (
    echo [%date% %time%] Nothing changed since last sync. >> "%SRC%\newreport_sync_log.txt"
) else (
    git pull --rebase --autostash origin main >> "%SRC%\git_sync.log" 2>&1
    git pull --rebase --autostash company main >> "%SRC%\git_sync.log" 2>&1
    git push origin main >> "%SRC%\git_sync.log" 2>&1
    git push company main >> "%SRC%\git_sync.log" 2>&1
    if errorlevel 1 (
        echo [%date% %time%] git push failed, see git_sync.log >> "%SRC%\newreport_sync_log.txt"
        powershell -NoProfile -ExecutionPolicy Bypass -File "%SRC%\send_line_notify.ps1" -Template "newreport_sync" -Status "FAIL" -Detail "git push failed" >> "%SRC%\newreport_sync_log.txt" 2>&1
    ) else (
        echo [%date% %time%] Sync completed with changes and pushed. >> "%SRC%\newreport_sync_log.txt"
        powershell -NoProfile -ExecutionPolicy Bypass -File "%SRC%\send_line_notify.ps1" -Template "newreport_sync" >> "%SRC%\newreport_sync_log.txt" 2>&1
    )
)

echo [%date% %time%] Sync check complete. >> "%SRC%\newreport_sync_log.txt"
rd "%SYNC_LOCK%" 2>nul

:: Commit this script's own log into the report repo (uses report repo's own git mutex,
:: separate from the NewReport lock above since it's a different git working tree)
cd /d %SRC%
set GIT_BAT_LOCK=D:\2025\AI\MongoDB\.git_bat_lock
set /a GITLOCK_TRIES=0
:acquire_git_lock_nrsync
md "%GIT_BAT_LOCK%" 2>nul && goto git_lock_ok_nrsync
set /a GITLOCK_TRIES+=1
if %GITLOCK_TRIES% geq 60 goto git_lock_ok_nrsync
ping -n 6 127.0.0.1 >nul
goto acquire_git_lock_nrsync
:git_lock_ok_nrsync
if exist "D:\2025\AI\MongoDB\.git\rebase-merge" rd /s /q "D:\2025\AI\MongoDB\.git\rebase-merge"
git add newreport_sync_log.txt
git commit -m "Update newreport_sync_log.txt: %date% %time%" >> newreport_sync_log.txt 2>&1
git pull --rebase --autostash origin main >> git_sync.log 2>&1
git push origin main >> git_sync.log 2>&1
rd "%GIT_BAT_LOCK%" 2>nul

echo Done.
