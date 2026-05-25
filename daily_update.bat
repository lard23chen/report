@echo off
cd /d D:\2025\AI\MongoDB
echo [%date% %time%] Starting Daily Report Update... >> daily_log.txt

echo Running generate_a_daily_report.js...
"D:\nodejs\node.exe" generate_a_daily_report.js >> daily_log.txt 2>&1

echo Running generate_kaohsiung_beer_festival_report.js...
"D:\nodejs\node.exe" generate_kaohsiung_beer_festival_report.js >> daily_log.txt 2>&1

echo [%date% %time%] Update Completed. >> daily_log.txt

echo Pushing to Git...
git add .
git commit -m "Auto Update Daily Reports: %date% %time%"
git push origin main >> daily_log.txt 2>&1

echo Done.
