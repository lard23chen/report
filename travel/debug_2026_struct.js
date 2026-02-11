const ExcelJS = require('exceljs');

async function debug2026Only() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx');

    // Exact match for 2026
    const tSheet = workbook.worksheets.find(s => s.name.includes('2026 Tikcet'));
    if (tSheet) {
        console.log(`Sheet: ${tSheet.name}`);
        console.log(`Row 1:`, JSON.stringify(tSheet.getRow(1).values));
        console.log(`Row 2:`, JSON.stringify(tSheet.getRow(2).values));
        console.log(`Row 3:`, JSON.stringify(tSheet.getRow(3).values));
        console.log(`Row 4:`, JSON.stringify(tSheet.getRow(4).values));
    }
}
debug2026Only();
