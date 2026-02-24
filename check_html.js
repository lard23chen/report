const fs = require('fs');

try {
    const html = fs.readFileSync('E_Qware_Revenue_Report_2026年01月_分析報表.html', 'utf8');

    // Find where the values are stored in the HTML file
    const valMatches = html.match(/<div class="value" id="val-[^"]+">.*?<\/div>/g);
    console.log("Values found in HTML:");
    if (valMatches) {
        valMatches.forEach(m => console.log(m));
    } else {
        console.log("No values found!");
    }
} catch (e) {
    console.error("Error reading file:", e);
}
