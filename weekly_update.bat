@echo off
cd /d D:\2025\AI\MongoDB

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
git add A_Qware_Revenue_Report_Weekly.html weekly_log.txt
git commit -m "Auto Update Weekly Report: %date% %time%"
git push origin main >> weekly_log.txt 2>&1

echo Done.
