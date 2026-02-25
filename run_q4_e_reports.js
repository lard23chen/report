const fs = require('fs');
const { execSync } = require('child_process');

let content = fs.readFileSync('generate_e_report_jan_2026.js', 'utf8');

// The script only filters by regex "^2026-01", we just replace that string.
const months = ['2025-12'];

for (const m of months) {
    let newContent = content.replace(/2026-01/g, m);
    // There may be instances of 2026年01月 hardcoded in titles if any, let's also replace them just in case
    let zhMonth = m.replace('-', '年') + '月';
    newContent = newContent.replace(/2026年01月/g, zhMonth);

    fs.writeFileSync(`temp_run_${m}.js`, newContent, 'utf8');
    console.log(`Generating report for ${m}...`);
    try {
        execSync(`node temp_run_${m}.js`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Failed to generate report for ${m}:`, e);
    }
    fs.unlinkSync(`temp_run_${m}.js`);
}
console.log('All reports generated.');
