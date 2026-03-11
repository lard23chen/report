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
    else if (content.includes('AzureMonthlyCost')) text = "Data Source: MongoDB (QwareAi / AzureMonthlyCost)";
    else if (content.includes('csv') || content.includes('sheet')) text = "Data Source: System Data Excerpts";
    return text;
}

const headerTpl = (text) => `\n<!-- Data Source Header -->\n<div style="margin-top:8px; color: #888; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px;">\n    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> \n    ${text}\n</div>`;

function processFile(file, isJS) {
    let content = fs.readFileSync(file, 'utf-8');
    
    // 1. Remove footer if exists
    content = content.replace(/(?:\\n)?<!-- Data Source Footer -->[\s\S]*?<\/div>(?:\\n)?/g, '');
    
    // 2. Remove any accidentally injected header to avoid duplicates
    content = content.replace(/(?:\\n)?<!-- Data Source Header -->[\s\S]*?<\/div>(?:\\n)?/g, '');
    
    // Remove the hardcoded ones
    content = content.replace(/<div style="margin-top:5px; color: #666;">Data Source.*?<\/div>/gi, '');
    content = content.replace(/<div style="margin-top:8px; color: var\(--text-secondary\); font-size: 0.85em; display: flex; align-items: center; gap: 5px;">[\s\S]*?Data Source:.*?<\/div>/g, '');

    let dsText = getDataSourceText(content);
    let headerHtml = headerTpl(dsText);
    if (isJS) {
        headerHtml = headerHtml.replace(/\n/g, '\\n');
    }

    let modified = false;

    if (content.match(/<div class="logo-sub">.*?<\/div>/i)) {
        content = content.replace(/(<div class="logo-sub">.*?<\/div>)/i, `$1${headerHtml}`);
        modified = true;
    } 
    else if (content.match(/<h1[^>]*>.*?<\/h1>/i)) {
        content = content.replace(/(<h1[^>]*>.*?<\/h1>)/i, `$1${headerHtml}`);
        modified = true;
    }
    else if (content.match(/<body[^>]*>/i)) {
        content = content.replace(/(<body[^>]*>)/i, `$1${headerHtml}`);
        modified = true;
    }
    
    if (modified) {
        fs.writeFileSync(file, content, 'utf-8');
        return 1;
    }
    return 0;
}

let changedHtml = 0;
for (const file of htmlFiles) changedHtml += processFile(file, false);

let changedJs = 0;
for (const file of jsFiles) changedJs += processFile(file, true);

console.log(`Updated ${changedHtml} HTML files and ${changedJs} JS files.`);
