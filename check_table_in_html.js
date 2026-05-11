const fs = require('fs');
const html = fs.readFileSync('sheet_preview.html', 'utf8');
const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
if (tableMatch) {
    console.log('Found table!');
    console.log(tableMatch[0].substring(0, 500));
} else {
    console.log('No table found.');
}
const trCount = (html.match(/<tr/g) || []).length;
console.log('TR count:', trCount);
