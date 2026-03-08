const fs = require('fs');
let c = fs.readFileSync('HTML_Report_Catalog.html', 'utf8');
c = c.replace(/href="([^"]+\.html)"/g, 'href="https://lard23chen.github.io/report/$1"');
fs.writeFileSync('HTML_Report_Catalog.html', c);
console.log('done!');
