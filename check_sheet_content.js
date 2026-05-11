const XLSX = require('xlsx');

function checkSheet() {
    try {
        const workbook = XLSX.readFile('sheet.xlsx');
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, {header: 1});
        console.log('First 5 rows of sheet.xlsx:');
        console.log(data.slice(0, 5));
    } catch (err) {
        console.error('Error reading sheet.xlsx:', err.message);
    }
}

checkSheet();
