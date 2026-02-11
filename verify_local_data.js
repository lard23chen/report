
const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, 'GoldenDisc_Report_2026-02-06.html');

try {
    const content = fs.readFileSync(reportPath, 'utf8');

    // Extract JSON
    const startMarker = 'const dbData = ';
    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) {
        console.error("Could not find data in report.");
        process.exit(1);
    }

    // Find the end of the JSON object. It allows for nested objects, but usually it ends with ;
    // However, looking at the generator: const dbData = ${JSON.stringify(data)};
    // So it should be safe to look for the first ; after the start marker

    // Wait, let's find the closing tag or script end to be safer or just parse carefully
    // Since it is JSON.stringify(data), it ends with }; 
    // But data involves arrays, so ];

    // Let's just grab everything after startMarker
    let jsonStr = content.substring(startIndex + startMarker.length);
    // Find the first occurrence of `;\n` or just `;` that terminates the assignment
    // But JSON might contain `;` in strings. 
    // However, the script in HTML is: const dbData = [...];
    // So we can look for `\n    function init() {` or similar.

    // A robust way to extract: The generator uses `const dbData = ${JSON.stringify(data)};`
    // So look for generic semicolon at end of line?
    // Actually, simply finding the LAST `];` or `};` might be risky if there are other scripts.

    // Let's look for the next variable declaration or function definition.
    const endMarker = ';\n\n    function init()';
    const endIndex = jsonStr.indexOf(';'); // First semicolon *should* be the end of the statement if JSON is valid and doesn't contain unescaped logic. JSON.stringify escapes stuff.

    // Actually, let's try to just find the semicolon. 
    // Is it possible the JSON has a semicolon? Yes.
    // data is an array: `[...]`. So it ends with `]`.
    // Let's find the last `]` before `function init`.

    const arrayEndIndex = jsonStr.lastIndexOf('];', 100000000); // search from a far end? No.
    // Let's parse until we hit the function init

    // better:
    const scriptEndIndex = jsonStr.indexOf('function init()');
    jsonStr = jsonStr.substring(0, scriptEndIndex);
    // Trim backwards the last semicolon and whitespace
    jsonStr = jsonStr.trim();
    if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);

    const data = JSON.parse(jsonStr);
    console.log(`Loaded ${data.length} records from local report.`);

    // Check Statuses
    const statuses = [...new Set(data.map(d => d['狀態']))];
    console.log("Distinct Statuses:", statuses);

    // Check Refund Fee
    const refundDocs = data.filter(d => d['狀態'] && d['狀態'].includes('退票'));
    console.log(`Found ${refundDocs.length} refund documents.`);

    if (refundDocs.length > 0) {
        const doc = refundDocs[0];
        // console.log("Refund Doc Keys:", Object.keys(doc));
        const feeKey = Object.keys(doc).find(k => k.includes('手續費'));
        console.log("Found Fee Key:", feeKey);

    } else {
        console.log("No refund documents found to check fees.");
        // Check normal doc for fee key anyway
        const doc = data[0];
        console.log("Normal Doc Keys:", Object.keys(doc));
        const feeKey = Object.keys(doc).find(k => k.includes('手續費'));
        console.log("Normal Doc Fee Key:", feeKey);
    }

} catch (e) {
    console.error("Error analyzing local data:", e);
}
