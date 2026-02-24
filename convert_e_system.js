const fs = require('fs');
let content = fs.readFileSync('generate_report_jan_2026.js', 'utf8');

content = content.replace(/Qware_Ticket_Data/g, 'Qware_Ticket_Data_Esys');
content = content.replace(/A_Qware_Revenue_Report/g, 'E_Qware_Revenue_Report');
content = content.replace(/\(A系統\)/g, '(E系統)');
content = content.replace(/href="report_index.html"/g, 'href="E_report_index.html"');
content = content.replace(/dateTitle \+ " \(A系統\)"/g, 'dateTitle + " (E系統)"');

// Fix valid order status
content = content.replace(/狀態'\] === '正常'/g, "狀態'] === '成功'");

fs.writeFileSync('generate_e_report_jan_2026.js', content, 'utf8');
console.log('generate_e_report_jan_2026.js updated successfully with 成功 status.');
