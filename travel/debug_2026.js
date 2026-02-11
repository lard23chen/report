const ExcelJS = require('exceljs');

async function inspect2026() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx');

    // Find the sheet
    const sheet = workbook.worksheets.find(s => s.name.includes('2026'));
    if (!sheet) {
        console.log('Could not find 2026 sheet!');
        return;
    }
    console.log(`Inspecting Sheet: ${sheet.name}`);

    sheet.eachRow((row, rowNumber) => {
        const values = row.values;
        // Check for strikethrough in ANY cell
        let isStrike = false;
        row.eachCell(cell => {
            if (cell.font && cell.font.strike) {
                isStrike = true;
                // console.log(`Row ${rowNumber} Cell ${cell.address} has strike`);
            }
        });

        // Log interesting rows (skip empty ones)
        if (values.length > 1) {
            // Extract date column (usually col 3 based on previous runs, but let's dump all)
            // ExcelJS values are 1-based, index 0 is used for something else usually? No, it's sparse array.
            // Let's just print json.
            console.log(`Row ${rowNumber} [Strike: ${isStrike}]:`, JSON.stringify(values));
        }
    });
}

inspect2026();
