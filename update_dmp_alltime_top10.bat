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
git add A_DMP_PageView_Report_AllTime_Top10.html dmp_details_alltime\*.html dmp_alltime_top10_log.txt
git commit -m "Auto-update DMP AllTime Top10 report: %date% %time%"
:: Rebase onto remote first so pushes from other machines don't cause non-fast-forward rejection
git pull --rebase --autostash origin main >> git_sync.log 2>&1
if errorlevel 1 (
    echo [%date% %time%] git pull --rebase failed, aborting rebase. See git_sync.log >> dmp_alltime_top10_log.txt
    git rebase --abort >> git_sync.log 2>&1
)
git push origin main >> git_sync.log 2>&1
if errorlevel 1 (
    rd "%GIT_BAT_LOCK%" 2>nul
    goto :fail_push
)
rd "%GIT_BAT_LOCK%" 2>nul

echo Sending LINE notification...
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "dmp_top10" >> dmp_alltime_top10_log.txt 2>&1

echo Done.
exit /b 0

:fail_generate
echo [%date% %time%] FAILED: generate_alltime_top10_v3.js. >> dmp_alltime_top10_log.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "dmp_top10" -Status "FAIL" -Detail "報表產生失敗（generate_alltime_top10_v3.js）" >> dmp_alltime_top10_log.txt 2>&1
exit /b 1

:fail_push
echo [%date% %time%] FAILED: git push step. >> dmp_alltime_top10_log.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "dmp_top10" -Status "FAIL" -Detail "git push 失敗" >> dmp_alltime_top10_log.txt 2>&1
exit /b 1
