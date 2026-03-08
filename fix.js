const fs = require('fs');
let c = fs.readFileSync('generate_jan_page_views.js', 'utf8');
c = c.replace(/\\\$/g, '$');
c = c.replace(/\\`/g, '`');
fs.writeFileSync('generate_jan_page_views.js', c);
console.log('Fixed');
