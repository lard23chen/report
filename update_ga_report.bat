@echo off
cd /d D:\2025\AI\MongoDB
node generate_ga_events_report.js
git add .
git commit -m "Auto-update GA Traffic Reports: %date% %time%"
git push
