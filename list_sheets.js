const xlsx = require('xlsx');
const workbook = xlsx.readFile('sheet.xlsx');
console.log(workbook.SheetNames);
