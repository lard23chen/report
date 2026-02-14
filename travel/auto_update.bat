@echo off
cd /d "d:\2025\AI\MongoDB\travel"
echo %DATE% %TIME% - Starting update process... >> update_log.txt

:: 1. Download latest CSV
echo Downloading CSV... >> update_log.txt
powershell -Command "Invoke-WebRequest -Uri 'https://docs.google.com/spreadsheets/d/1pZCR_nVgyhwYldCRxfum4AsC-vxSFdjnkqAotzeV1CI/export?format=csv&gid=0' -OutFile 'new_analysis_data.csv'" >> update_log.txt 2>&1

:: 2. Regenerate HTML
echo Regenerating HTML... >> update_log.txt
node generate_expense_report.js >> update_log.txt 2>&1

:: 2b. Download Shopping CSV & Reference HTML
echo Downloading Shopping CSV... >> update_log.txt
powershell -Command "Invoke-WebRequest -Uri 'https://docs.google.com/spreadsheets/d/1fgJbzRvnn-4VUbn6PIMh2PyDpxkNPJo8MbuEj4pNt1M/export?format=csv&gid=1320702581' -OutFile 'new_data_gid_1320702581.csv'" >> update_log.txt 2>&1
echo Downloading Reference Site... >> update_log.txt
powershell -Command "Invoke-WebRequest -Uri 'https://togoarai.github.io/20260211-Wishing-in-Thailand/' -OutFile 'reference_site.html'" >> update_log.txt 2>&1
echo Regenerating Shopping Report... >> update_log.txt
node generate_shopping_report.js >> update_log.txt 2>&1

:: 3. Git Push
echo Pushing to GitHub... >> update_log.txt
git add .
git commit -m "Auto-update expense report: %DATE% %TIME%"
git push >> update_log.txt 2>&1

echo Update finished. >> update_log.txt
