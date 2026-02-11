const xlsx = require('xlsx');

// Read the workbook
const workbook = xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Get raw JSON (array of arrays) to see structure
const rawData = xlsx.utils.sheet_to_json(sheet, {header: 1});

console.log('Total rows:', rawData.length);
console.log('First 10 rows:');
rawData.slice(0, 10).forEach((row, index) => {
    console.log(`Row ${index}:`, JSON.stringify(row));
});
