const xlsx = require('xlsx');

// Read the workbook with cellDates: true to convert Excel dates automatically
const workbook = xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx', { cellDates: true });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Get raw JSON
const rawData = xlsx.utils.sheet_to_json(sheet);

console.log('Total extracted rows:', rawData.length);
console.log('First 5 rows:', JSON.stringify(rawData.slice(0, 5), null, 2));

// Check for Booking Code grouping
const grouped = {};
rawData.forEach(row => {
    const code = row['訂位代號'] || 'UNKNOWN';
    if (!grouped[code]) grouped[code] = [];
    grouped[code].push(row);
});

console.log('Number of unique booking codes:', Object.keys(grouped).length);
console.log('Sample Group (first one):', JSON.stringify(Object.values(grouped)[0], null, 2));
