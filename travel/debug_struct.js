const ExcelJS = require('exceljs');

async function debugTicketStructure() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx');

    const tSheet = workbook.worksheets.find(s => s.name.includes('2026 Tikcet') || s.name.includes('Ticket'));
    if (tSheet) {
        console.log(`Sheet: ${tSheet.name}`);
        // Row 1 (Header?)
        console.log(`Row 1:`, JSON.stringify(tSheet.getRow(1).values));
        // Row 2 (Data?)
        console.log(`Row 2:`, JSON.stringify(tSheet.getRow(2).values));
        // Row 3
        console.log(`Row 3:`, JSON.stringify(tSheet.getRow(3).values));
    }
}
debugTicketStructure();
