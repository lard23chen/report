const xlsx = require('xlsx');

const workbook = xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx', { cellDates: true });

console.log('All Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    console.log(`\n--- Sheet: ${sheetName} ---`);

    // Try to find any date-like columns
    let maxDate = new Date('1900-01-01');
    let minDate = new Date('2100-01-01');
    let dateCount = 0;

    data.forEach(row => {
        Object.values(row).forEach(val => {
            if (val instanceof Date) {
                if (val > maxDate) maxDate = val;
                if (val < minDate) minDate = val;
                dateCount++;
            }
        });
    });

    if (dateCount > 0) {
        console.log(`Date Range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
    } else {
        console.log('No date objects found (might be strings or numbers).');
        // Check first row to see if keys look like dates
        if (data.length > 0) console.log('First row keys:', Object.keys(data[0]));
    }
});
