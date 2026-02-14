const xlsx = require('xlsx');

const filePath = 'd:/2025/AI/MongoDB/travel/new_data_gid_1320702581.csv';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: 0 });

// Log headers and first few rows to understand structure
const headers = Object.keys(data[0]);
console.log('Headers:', headers.slice(0, 5)); // Show first 5 headers
console.log('Total rows:', data.length);
console.log('First row:', JSON.stringify(data[0]));
