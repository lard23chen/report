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

echo [%date% %time%] Weekly Update Completed. >> weekly_log.txt

echo Pushing to Git...
git add A_Qware_Revenue_Report_Weekly_*.html report_index.html HTML_Report_Catalog.html weekly_log.txt
git commit -m "Auto Update Weekly Report: %date% %time%"
:: Rebase onto remote first so pushes from other machines don't cause non-fast-forward rejection
git pull --rebase --autostash origin main >> git_sync.log 2>&1
if errorlevel 1 (
    echo [%date% %time%] git pull --rebase failed, aborting rebase. See git_sync.log >> weekly_log.txt
    git rebase --abort >> git_sync.log 2>&1
)
git push origin main >> git_sync.log 2>&1

echo Done.
