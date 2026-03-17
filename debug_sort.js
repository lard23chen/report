const fs = require('fs');
const html = fs.readFileSync('A_GA_Traffic_Analysis_Report.html', 'utf8');
const regex = /<td style="font-weight: bold; font-size: 1.1em;">(.*?)<\/td>/g;
let match;
const months = [];
while ((match = regex.exec(html)) !== null) {
    months.push(match[1]);
}
console.log(months.slice(0, 10));
