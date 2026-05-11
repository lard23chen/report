const XLSX = require('xlsx');

function checkSheet() {
    try {
        const workbook = XLSX.readFile('旅遊.xlsx');
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, {header: 1});
        console.log('First 5 rows of 旅遊.xlsx:');
        console.log(data.slice(0, 5));
    } catch (err) {
        console.error('Error reading 旅遊.xlsx:', err.message);
    }
}

checkSheet();
