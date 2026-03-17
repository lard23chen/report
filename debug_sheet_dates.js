const xlsx = require('xlsx');
const workbook = xlsx.readFile('sheet.xlsx');
const targetSheets = ['輸出04_雲端_每日票務監管'];

targetSheets.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        console.log(`Sheet not found: ${sheetName}`);
        return;
    }
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const dates = new Set();
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[0]) continue;
        let dateStr = String(row[0]).trim();
        if (typeof row[0] === 'number') {
            const dateObj = new Date((row[0] - (25569)) * 86400 * 1000);
            if (!isNaN(dateObj)) {
                dateStr = `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
            }
        }
        if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
            dates.add(dateStr);
        }
    }
    console.log('Found dates:', Array.from(dates).sort());
});
