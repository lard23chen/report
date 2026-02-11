const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, 'Qware_Revenue_Report_2025年12月_分析報表.html');

try {
    if (!fs.existsSync(reportPath)) {
        console.error("Report file not found.");
        process.exit(1);
    }

    const content = fs.readFileSync(reportPath, 'utf8');

    // Extract JSON
    // Standard format: const dbData = [...];
    const startMarker = 'const dbData = ';
    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) {
        console.error("Could not find 'const dbData =' in report.");
        process.exit(1);
    }

    const jsonStart = startIndex + startMarker.length;
    // Find the end. It should be a script block.
    // Usually finding `;\n` is enough if formatted standardly.
    // Or finds the next <script or function.

    // Let's take a chunk and try to find the end.
    // 72MB file... substring might be heavy but manageable in Node.

    // Let's find the closing `];` 
    // Since it's huge, let's stream or just slice a large chunk if possible? 
    // Be careful with memory. 72MB string is fine in V8 (limit is ~500MB).

    let jsonStr = content.substring(jsonStart);
    const scriptEnd = jsonStr.indexOf('function init()');
    if (scriptEnd !== -1) {
        jsonStr = jsonStr.substring(0, scriptEnd);
    }

    jsonStr = jsonStr.trim();
    if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);

    console.log("Parsing JSON data (this may take a moment)...");
    const data = JSON.parse(jsonStr);
    console.log(`Loaded ${data.length} records from report.`);

    // Analyze Refund Data
    const refundDocs = data.filter(d =>
        d['狀態'] === '退票' ||
        d['狀態'] === '已退票' ||
        (d['手續費'] && d['手續費'] > 0)
    );
    console.log(`Found ${refundDocs.length} refund documents in the report.`);

    if (refundDocs.length > 0) {
        // Calculate totals
        const totalRefundFee = refundDocs.reduce((acc, cur) => acc + (cur['手續費'] || 0), 0);
        console.log(`Total Refund Fee in Report: ${totalRefundFee}`);

        // Show status breakdown
        const statuses = {};
        refundDocs.forEach(d => {
            const s = d['狀態'] || 'Unknown';
            statuses[s] = (statuses[s] || 0) + 1;
        });
        console.log("Refund Doc Statuses:", statuses);

        // Check dates of refunds
        const dates = refundDocs.map(d => d['交易時間'] || d['退票時間']).filter(d => d);
        if (dates.length > 0) {
            console.log(`Date range of refunds: ${dates.sort()[0]} to ${dates.sort()[dates.length - 1]}`);
        }
    }

} catch (e) {
    console.error("Error analyzing report:", e.message);
}
