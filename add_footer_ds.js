const fs = require('fs');

const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.includes('index') && !f.includes('catalog') && !f.includes('dashboard') && f !== 'HTML_Report_Catalog.html');
const jsFiles = fs.readdirSync('.').filter(f => f.endsWith('.js') && f.startsWith('generate_'));

function getDataSourceText(content) {
    let text = "Data Source: MongoDB (QwareAi)";
    if (content.includes('Qware_A_Ticket_data_Daily')) text = "Data Source: MongoDB (QwareAi / Qware_A_Ticket_data_Daily)";
    else if (content.includes('Qware_A_Ticket_data')) text = "Data Source: MongoDB (QwareAi / Qware_A_Ticket_data)";
    else if (content.includes('Qware_E_Ticket_data')) text = "Data Source: MongoDB (QwareAi / Qware_E_Ticket_data)";
    else if (content.includes('DMP_PageView')) text = "Data Source: MongoDB (QwareAi / DMP_PageView...)";
    else if (content.includes('GA_MonthlyStats')) text = "Data Source: MongoDB (QwareAi / GA_MonthlyStats)";
    else if (content.includes('GA_EventsStats')) text = "Data Source: MongoDB (QwareAi / GA_EventsStats)";
    else if (content.includes('csv') || content.includes('sheet')) text = "Data Source: System Data Excerpts";
    return text;
}

let changedHtml = 0;
for (const file of htmlFiles) {
    let html = fs.readFileSync(file, 'utf-8');
    if (html.includes('<!-- Data Source Footer -->')) continue;
    
    let dsText = getDataSourceText(html);
    const footerHtml = `\n<!-- Data Source Footer -->\n<div style="text-align:center; padding: 20px; color: #888; font-size: 0.9em; border-top: 1px solid rgba(0,0,0,0.1); margin-top: 40px; font-family: sans-serif;">\n    ${dsText}\n</div>\n</body>`;
    
    if (html.includes('</body>')) {
        let newHtml = html.replace('</body>', footerHtml);
        fs.writeFileSync(file, newHtml, 'utf-8');
        changedHtml++;    
    }
}

let changedJs = 0;
for (const file of jsFiles) {
    let script = fs.readFileSync(file, 'utf-8');
    if (script.includes('<!-- Data Source Footer -->')) continue;
    
    let dsText = getDataSourceText(script);
    const footerHtml = `\\n<!-- Data Source Footer -->\\n<div style="text-align:center; padding: 20px; color: #888; font-size: 0.9em; border-top: 1px solid rgba(0,0,0,0.1); margin-top: 40px; font-family: sans-serif;">\\n    ${dsText}\\n</div>\\n</body>`;
    
    if (script.includes('</body>')) {
        // Need to be careful with template literals format
        let newScript = script.replace('</body>', footerHtml);
        fs.writeFileSync(file, newScript, 'utf-8');
        changedJs++;
    }
}

console.log(`Updated ${changedHtml} HTML files and ${changedJs} JS files.`);
