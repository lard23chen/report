@echo off
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

echo Running generate_a_daily_report.js...
"D:\nodejs\node.exe" generate_a_daily_report.js >> daily_log.txt 2>&1

echo Running generate_kaohsiung_beer_festival_report.js...
"D:\nodejs\node.exe" generate_kaohsiung_beer_festival_report.js >> daily_log.txt 2>&1

echo Running generate_d_ga_clickdata_report.js...
"D:\nodejs\node.exe" generate_d_ga_clickdata_report.js >> daily_log.txt 2>&1

echo Running generate_d_ga_pageview_report.js...
"D:\nodejs\node.exe" generate_d_ga_pageview_report.js >> daily_log.txt 2>&1

echo Running generate_d_ga_funnel_report.js...
"D:\nodejs\node.exe" generate_d_ga_funnel_report.js >> daily_log.txt 2>&1

echo Running generate_d_ga_funnel_cart_data.js...
"D:\nodejs\node.exe" generate_d_ga_funnel_cart_data.js >> daily_log.txt 2>&1

echo Running generate_e_dmp_funnel_report.js...
"D:\nodejs\node.exe" generate_e_dmp_funnel_report.js >> daily_log.txt 2>&1

echo Running update_index_stats.js (monthly stats update)...
"D:\nodejs\node.exe" update_index_stats.js >> daily_log.txt 2>&1

for /f %%d in ('powershell -NoProfile -Command "(Get-Date).Day"') do set TODAY_DAY=%%d
if "%TODAY_DAY%"=="2" (
    echo [%date% %time%] Day 2 detected - generating previous month report... >> daily_log.txt
    "D:\nodejs\node.exe" generate_monthly_report.js >> daily_log.txt 2>&1
)
if "%TODAY_DAY%"=="10" (
    echo [%date% %time%] Day 10 detected - updating GA Traffic Analysis Report... >> daily_log.txt
    "D:\nodejs\node.exe" generate_ga_report.js >> daily_log.txt 2>&1
)

echo [%date% %time%] Update Completed. >> daily_log.txt

echo Pushing to Git...
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
git commit -m "Auto Update Daily Reports: %date% %time%"
:: Rebase onto remote first so pushes from other machines don't cause non-fast-forward rejection
git pull --rebase --autostash origin main >> git_sync.log 2>&1
if errorlevel 1 (
    echo [%date% %time%] git pull --rebase failed, aborting rebase. See git_sync.log >> daily_log.txt
    git rebase --abort >> git_sync.log 2>&1
)
git push origin main >> git_sync.log 2>&1
rd "%GIT_BAT_LOCK%" 2>nul

echo Sending LINE notification...
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "daily" >> daily_log.txt 2>&1

echo Done.
