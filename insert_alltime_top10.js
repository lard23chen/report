const fs = require('fs');

let c = fs.readFileSync('report_index.html', 'utf8');

let newCards = `

                <div class="card">
                    <div class="card-icon icon-analysis" style="background: rgba(167, 139, 250, 0.1); color: #a78bfa;">
                        👁️
                    </div>
                    <div class="card-content">
                        <h3>DMP 歷史總計 Top 10 排行榜</h3>
                        <p>以 First-Party DMP 資料庫為基礎，分析歷史累積的 Page View 瀏覽量與排行。</p>
                    </div>
                    <div class="card-meta">
                        <span class="badge">All Time Top 10</span>
                        <a href="A_DMP_PageView_Report_AllTime_Top10.html" class="btn-link"
                            style="background-color: #a78bfa; color: #fff;">
                            查看報表
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </a>
                    </div>
                </div>`;

const splitPoint = '2026年02月 DMP 節目流量統計報表</h3>\r\n                        <p>以 First-Party DMP 資料庫為基礎，分析各售票節目的 Page View 瀏覽量與排行。</p>\r\n                    </div>\r\n                    <div class="card-meta">\r\n                        <span class="badge">Page Views</span>\r\n                        <a href="A_DMP_PageView_Report_2026-02.html" class="btn-link"\r\n                            style="background-color: #a78bfa; color: #fff;">\r\n                            查看報表\r\n                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">\r\n                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"\r\n                                    d="M14 5l7 7m0 0l-7 7m7-7H3" />\r\n                            </svg>\r\n                        </a>\r\n                    </div>\r\n                </div>';
const splitPointLF = splitPoint.replace(/\r\n/g, '\n');

if (c.includes(splitPoint)) {
    c = c.replace(splitPoint, splitPoint + newCards.replace(/\n/g, '\r\n'));
    console.log("Replaced CRLF");
} else if (c.includes(splitPointLF)) {
    c = c.replace(splitPointLF, splitPointLF + newCards);
    console.log("Replaced LF");
}

fs.writeFileSync('report_index.html', c);
