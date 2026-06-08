@echo off
cd /d D:\2025\AI\MongoDB
echo [%date% %time%] Starting Daily Report Update... >> daily_log.txt

echo Running generate_a_daily_report.js...
"D:\nodejs\node.exe" generate_a_daily_report.js >> daily_log.txt 2>&1

echo Running generate_kaohsiung_beer_festival_report.js...
"D:\nodejs\node.exe" generate_kaohsiung_beer_festival_report.js >> daily_log.txt 2>&1

echo Running generate_d_ga_clickdata_report.js...
"D:\nodejs\node.exe" generate_d_ga_clickdata_report.js >> daily_log.txt 2>&1

echo Running update_index_stats.js (monthly stats update)...
"D:\nodejs\node.exe" update_index_stats.js >> daily_log.txt 2>&1

for /f %%d in ('powershell -NoProfile -Command "(Get-Date).Day"') do set TODAY_DAY=%%d
if "%TODAY_DAY%"=="2" (
    echo [%date% %time%] Day 2 detected - generating previous month report... >> daily_log.txt
    "D:\nodejs\node.exe" generate_monthly_report.js >> daily_log.txt 2>&1
)

echo [%date% %time%] Update Completed. >> daily_log.txt

echo Pushing to Git...
git add .
git commit -m "Auto Update Daily Reports: %date% %time%"
git push origin main >> daily_log.txt 2>&1

echo Sending LINE notification...
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "daily" >> daily_log.txt 2>&1

echo Done.
