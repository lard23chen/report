const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('sheet_preview.html', 'utf8');
const $ = cheerio.load(html);

const data = [];
$('table.waffle tr').each((i, tr) => {
    const row = [];
    $(tr).find('td').each((j, td) => {
        row.push($(td).text().trim());
    });
    if (row.length > 0) {
        data.push(row);
    }
});

console.log(JSON.stringify(data, null, 2));
fs.writeFileSync('extracted_insurance.json', JSON.stringify(data, null, 2));
