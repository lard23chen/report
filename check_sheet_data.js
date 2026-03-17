const xlsx = require('xlsx');
const workbook = xlsx.readFile('sheet.xlsx');
const sheet = workbook.Sheets['04.AzureAWS合併費用'];
const data = xlsx.utils.sheet_to_json(sheet);
console.log(JSON.stringify(data.slice(-5), null, 2));
