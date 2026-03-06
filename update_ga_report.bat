@echo off
cd /d D:\2025\AI\MongoDB
node generate_ga_events_report.js
git add A_GA_Events_Traffic_Report.html
git commit -m "Auto-update A_GA_Events_Traffic_Report"
git push
