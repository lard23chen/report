const fs = require('fs');
let html = fs.readFileSync('HTML_Report_Catalog.html', 'utf-8');

const expenseReportHTML = `            <tr>
                <td>17</td>
                <td><span class="sys-badge sys-other">其他</span></td>
                <td><a href="https://lard23chen.github.io/report/daily_expense_report.html" target="_blank">daily_expense_report.html</a></td>
                <td>每日花費與活動紀錄分析報表 (旅遊專案)</td>
                <td><span class="table-name">Google Sheets</span></td>
                <td>排程 / 手動執行</td>
                <td>比對花費明細與監控活動紀錄用</td>
            </tr>
        </tbody>`;

html = html.replace(/\s*<\/tbody>/, '\n' + expenseReportHTML);
fs.writeFileSync('HTML_Report_Catalog.html', html);
console.log('Appended daily expense report');
