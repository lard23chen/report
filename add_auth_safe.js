
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

console.log(`Processing ${files.length} HTML files...`);

files.forEach(file => {
    try {
        const filePath = path.join(dir, file);
        let content = fs.readFileSync(filePath, 'utf8'); // Read as UTF-8

        // Check if auth.js is already present
        if (!content.includes('auth.js')) {
            console.log(`Adding auth to ${file}`);
            content = content.replace('</body>', '<script src="auth.js"></script></body>');
        } else {
            console.log(`Auth already present in ${file}, re-saving to fix encoding.`);
        }

        // Write with BOM to ensure UTF-8 interpretation
        // The \ufeff at the start is the BOM
        fs.writeFileSync(filePath, '\ufeff' + content, 'utf8');
    } catch (err) {
        console.error(`Error processing ${file}:`, err);
    }
});

console.log("All files processed.");
