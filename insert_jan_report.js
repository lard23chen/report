const fs = require('fs');
let content = fs.readFileSync('report_index.html', 'utf8');

const splitPoint = '                    </div>\r\n                </div>\r\n\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <footer>';
const splitPointLF = '                    </div>\n                </div>\n\n            </div>\n        </div>\n    </div>\n\n    <footer>';

const newCard = `

                <div class="card">
                    <div class="card-icon icon-analysis" style="background: rgba(167, 139, 250, 0.1); color: #a78bfa;">
                        👁️
                    </div>
                    <div class="card-content">
                        <h3>2026年01月 DMP 節目流量統計報表</h3>
                        <p>以 First-Party DMP 資料庫為基礎，分析各售票節目的 Page View 瀏覽量與排行。</p>
                    </div>
                    <div class="card-meta">
                        <span class="badge">Page Views</span>
                        <a href="A_DMP_PageView_Report_2026-01.html" class="btn-link"
                            style="background-color: #a78bfa; color: #fff;">
                            查看報表
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </a>
                    </div>
                </div>`;

if (content.includes(splitPoint)) {
    content = content.replace(splitPoint, '                    </div>\r\n                </div>' + newCard.replace(/\n/g, '\r\n') + '\r\n\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <footer>');
} else if (content.includes(splitPointLF)) {
    content = content.replace(splitPointLF, '                    </div>\n                </div>' + newCard + '\n\n            </div>\n        </div>\n    </div>\n\n    <footer>');
} else {
    console.error("Split point not found");
    process.exit(1);
}

fs.writeFileSync('report_index.html', content);
console.log('Inserted successfully.');
