const ExcelJS = require('exceljs');

async function inspect2026Hotel() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx');

    const sheet = workbook.worksheets.find(s => s.name.includes('2026 HOTEL'));
    if (!sheet) {
        console.log('Could not find 2026 HOTEL sheet!');
        return;
    }
    console.log(`Inspecting Sheet: ${sheet.name}`);

    // Dump all rows to see structure and dates
    sheet.eachRow((row, rowNumber) => {
        // Simple serialization of values
        const values = row.values;
        // Check if any date-like string or object exists
        const hasDate = values.some(v => v instanceof Date || (typeof v === 'string' && v.includes('2026')));

        if (hasDate || rowNumber < 5) { // Show first few rows and any row with 2026 date
            console.log(`Row ${rowNumber}:`, JSON.stringify(values));
        }
    });

    // Also check 2026 Ticket dates to see the range we are trying to match
    const ticketSheet = workbook.worksheets.find(s => s.name.includes('2026 Tikcet') || s.name.includes('2026 Ticket'));
    if (ticketSheet) {
        console.log(`\n--- Ticket Data for Feb 2026 ---`);
        ticketSheet.eachRow((row, rowNumber) => {
            const rowStr = JSON.stringify(row.values);
            if (rowStr.includes('2026-02') || rowStr.includes('2026/02')) {
                console.log(`Ticket Row ${rowNumber}:`, rowStr);
            }
        });
    }
}

inspect2026Hotel();
