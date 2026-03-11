const fs = require('fs');

let html = fs.readFileSync('HTML_Report_Catalog.html', 'utf-8');

const dailyReportHTML = `
            <tr>
                <td>ID_PLACEHOLDER</td>
                <td><span class="sys-badge sys-a">A系統</span></td>
                <td><a href="https://lard23chen.github.io/report/A_Qware_Revenue_Report_Daily.html" target="_blank">A_Qware_Revenue_Report_Daily.html</a></td>
                <td>A系統 每日營業分析報表</td>
                <td><span class="table-name">Qware_A_Ticket_data_Daily</span></td>
                <td>每日 09:00 排程執行</td>
                <td>每日銷售、退票與付款方式彙整分析</td>
            </tr>
`;

const dmpTop10HTML = `
            <tr>
                <td>ID_PLACEHOLDER</td>
                <td><span class="sys-badge sys-other">流量</span></td>
                <td><a href="https://lard23chen.github.io/report/A_DMP_PageView_Report_AllTime_Top10.html" target="_blank">A_DMP_PageView_Report_AllTime_Top10.html</a></td>
                <td>DMP 歷史總結: 歷來瀏覽量 Top 10 活動報表</td>
                <td><span class="table-name">Qware_A_Traffic_session_data</span></td>
                <td>專案性 / 手動執行</td>
                <td>歷史所有 DMP 開站活動頁的總流量分析</td>
            </tr>
`;

const expenseReportHTML = `
            <tr>
                <td>ID_PLACEHOLDER</td>
                <td><span class="sys-badge sys-other">其他</span></td>
                <td><a href="https://lard23chen.github.io/report/daily_expense_report.html" target="_blank">daily_expense_report.html</a></td>
                <td>每日經費與活動分析報表</td>
                <td><span class="table-name">Google Sheets</span></td>
                <td>排程 / 手動執行</td>
                <td>顯示經費明細與監控紀錄</td>
            </tr>
`;

// Insert dailyReport immediately after A_SamLee_Report
html = html.replace('<!-- Monthly Reports E System -->', dailyReportHTML.trim() + '\n\n            <!-- Monthly Reports E System -->');

// Insert dmp top10 immediately after DMP 2026-02
html = html.replace('<!-- Others -->', dmpTop10HTML.trim() + '\n\n            <!-- Others -->');

// Insert expense report at the end of Others
html = html.replace('純 UI 切版設計展示檔案</td>\n            </tr>', '純 UI 切版設計展示檔案</td>\n            </tr>\n\n' + expenseReportHTML.trim());

// Auto-number the IDs in the first <td> of each <tr> under <tbody>
let idCounter = 1;
html = html.replace(/<td>(\d+|ID_PLACEHOLDER)<\/td>/g, () => `<td>${idCounter++}</td>`);

fs.writeFileSync('HTML_Report_Catalog.html', html);
console.log('Finished updating HTML_Report_Catalog.html');
