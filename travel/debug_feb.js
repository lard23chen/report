const ExcelJS = require('exceljs');

async function debugFeb2026() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx');

    // Check 2026 Ticket
    console.log('\n--- 2026 Ticket (Feb entries) ---');
    const tSheet = workbook.worksheets.find(s => s.name.includes('2026 Tikcet') || s.name.includes('Ticket'));
    if (tSheet) {
        tSheet.eachRow((row, i) => {
            const vals = row.values;
            const str = JSON.stringify(vals);
            if (str.includes('2026-02') || str.includes('Feb') || str.includes('2026/02')) {
                console.log(`Row ${i}:`, str);
            }
        });
    }

    // Check 2026 Hotel
    console.log('\n--- 2026 Hotel (Feb entries) ---');
    const hSheet = workbook.worksheets.find(s => s.name.includes('2026 HOTEL'));
    if (hSheet) {
        hSheet.eachRow((row, i) => {
            const vals = row.values;
            const str = JSON.stringify(vals);
            if (str.includes('2026-02') || str.includes('Feb') || str.includes('2026/02') || str.includes('Staybridge')) {
                console.log(`Row ${i} (Hotel):`, str);
            }
        });
    }
}
debugFeb2026();
