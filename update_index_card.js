const fs = require('fs');

const reportHtml = fs.readFileSync('report_index.html', 'utf8');

const targetStr = `
                <div class="card">
                    <div class="card-icon icon-analysis" style="background: rgba(251, 192, 45, 0.1); color: #FBC02D;">
                        💰
                    </div>
                    <div class="card-content">
                        <h3>Azure 雲端費用分析報表</h3>
                        <p>跨系統(A、D、E)與共同費用的雲端成本趨勢與佔比洞察。</p>
                    </div>
                    <div class="card-meta">
                        <span class="badge">Cost Reporting</span>
                        <a href="Azure_Cost_Analysis_Report.html" class="btn-link"
                            style="background-color: #FBC02D; color: #1e1e1e; font-weight: 600;">
                            查看報表
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </a>
                    </div>
                </div>`;

// Because line endings might be CRLF, we normalise text to find and replace.
const insertCard = `
                <div class="card">
                    <div class="card-icon icon-analysis" style="background: rgba(251, 192, 45, 0.1); color: #FBC02D;">
                        💰
                    </div>
                    <div class="card-content">
                        <h3>每日雲端費用分析報表</h3>
                        <p>以每日為單位的雲端費用與售票活動關聯分析曲線圖表。</p>
                    </div>
                    <div class="card-meta">
                        <span class="badge">Daily Cost</span>
                        <a href="daily_expense_report.html" class="btn-link"
                            style="background-color: #FBC02D; color: #1e1e1e; font-weight: 600;">
                            查看報表
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </a>
                    </div>
                </div>`;

const searchRegex = new RegExp('<div class="card">\\s*<div class="card-icon icon-analysis" style="background: rgba\\(251, 192, 45, 0\\.1\\); color: #FBC02D;">\\s*💰\\s*</div>\\s*<div class="card-content">\\s*<h3>Azure 雲端費用分析報表</h3>[\\s\\S]*?</div>\\s*</div>');
if (searchRegex.test(reportHtml)) {
    const newHtml = reportHtml.replace(searchRegex, (match) => {
        return match + '\n' + insertCard;
    });
    fs.writeFileSync('report_index.html', newHtml, 'utf8');
    console.log('Successfully injected card.');
} else {
    console.log('Target string not found');
}
