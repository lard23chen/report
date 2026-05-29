@echo off
cd /d D:\2025\AI\MongoDB
node generate_ga_events_report.js
git add .
git commit -m "Auto-update GA Traffic Reports: %date% %time%"
git push
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\2025\AI\MongoDB\send_line_notify.ps1" -Template "ga"
