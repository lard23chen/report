const xlsx = require('xlsx');

const workbook = xlsx.readFile('d:/2025/AI/MongoDB/travel/旅遊.xlsx');
console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // Array of arrays
    if (data.length > 0) {
        console.log(`\n--- Sheet: ${name} ---`);
        console.log('Headers:', data[0]);
        // Check first few rows for data
        console.log('First 2 rows of data:', data.slice(1, 3));
    }
});
