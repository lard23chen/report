const xlsx = require('xlsx');

const workbook = xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx');

['2025 HOTEL', '2026 HOTEL'].forEach(sheetName => {
    if (workbook.Sheets[sheetName]) {
        console.log(`\n--- Sheet: ${sheetName} ---`);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        console.log('Headers:', Object.keys(data[0] || {}));
        console.log('First 2 rows:', JSON.stringify(data.slice(0, 2), null, 2));
    } else {
        console.log(`Sheet not found: ${sheetName}`);
    }
});

['Ticket', '2025 Tikcet'].forEach(sheetName => {
    if (workbook.Sheets[sheetName]) {
        console.log(`\n--- Sheet: ${sheetName} ---`);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        console.log('Headers:', Object.keys(data[0] || {}));
        console.log('First row date sample:', data[0]['班機日期']);
    }
});
