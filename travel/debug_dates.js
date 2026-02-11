const ExcelJS = require('exceljs');

async function debugTripDates() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx');

    // 1. Flights
    const ticketSheet = workbook.worksheets.find(s => s.name.includes('2026 Tikcet') || s.name.includes('Ticket'));
    if (ticketSheet) {
        console.log(`\n--- FLIGHTS (${ticketSheet.name}) ---`);
        ticketSheet.eachRow((row, i) => {
            const vals = row.values;
            // Scan for date and route
            let date = null;
            let route = null;
            let dest = null;
            row.eachCell((cell, col) => {
                const v = cell.value;
                if (v instanceof Date) date = v;
                else if (typeof v === 'string') {
                    if (v.includes('ROUTE') || v.includes('去') || v.includes('回')) route = v;
                    if (['BKK', 'TPE'].some(d => v.includes(d))) dest = v;
                }
            });
            if (date && (dest || route)) {
                console.log(`Row ${i}: Date=${date.toISOString()}, Route=${route}, Dest=${dest}`);
            }
        });
    }

    // 2. Hotels
    const hotelSheet = workbook.worksheets.find(s => s.name.includes('2026 HOTEL'));
    if (hotelSheet) {
        console.log(`\n--- HOTELS (${hotelSheet.name}) ---`);
        hotelSheet.eachRow((row, i) => {
            // Check for date in any cell
            row.eachCell((cell, col) => {
                if (cell.value instanceof Date) {
                    // Check if row has "Hotel" name?
                    const rowVals = JSON.stringify(row.values);
                    if (rowVals.includes('Staybridge') || rowVals.includes('Bangkok') || rowVals.includes('BKK')) {
                        console.log(`Row ${i}: Date=${cell.value.toISOString()}, Val=${cell.value}`);
                    }
                }
            });
        });
    }
}

debugTripDates();
