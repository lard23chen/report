const ExcelJS = require('exceljs');

async function debugHotelStruct() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx');

    // Exact match for 2026
    const hSheet = workbook.worksheets.find(s => s.name.includes('2026 HOTEL'));
    if (hSheet) {
        console.log(`Sheet: ${hSheet.name}`);
        console.log(`Row 1:`, JSON.stringify(hSheet.getRow(1).values));
        console.log(`Row 2:`, JSON.stringify(hSheet.getRow(2).values));
        console.log(`Row 3:`, JSON.stringify(hSheet.getRow(3).values));
    }
}
debugHotelStruct();
