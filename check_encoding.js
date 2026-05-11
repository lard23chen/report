const fs = require('fs');
const buffer = fs.readFileSync('sheet_preview.html');
// Check the first few bytes
console.log(buffer.slice(0, 100).toString('hex'));
// Try to detect UTF-8 or Big5
// We can just try to decode it as UTF-8 and see
const text = buffer.toString('utf8');
console.log(text.substring(0, 500));
