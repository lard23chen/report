const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'shopping_data.xlsx');
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0]; // GID specific file should only have one sheet
const sheet = workbook.Sheets[sheetName];

// Check first row (headers) for links
const range = xlsx.utils.decode_range(sheet['!ref']);
console.log('Range:', range);

const headerLinks = {};

for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = xlsx.utils.encode_cell({ c: C, r: 0 });
    const cell = sheet[cellAddress];

    if (cell && cell.v) { // cell.v is value
        let link = null;
        if (cell.l) { // cell.l is link object { Target: 'url', Tooltip: 'tooltip' }
            link = cell.l.Target;
        }

        // Sometimes Google Sheets hyperlinks are embedded differently?
        // Let's print out what cell.l looks like if present.
        if (cell.l) {
            console.log(`Found link for '${cell.v}':`, cell.l);
            headerLinks[cell.v] = cell.l.Target;
        }
    }
}

console.log('Extracted Links:', headerLinks);
