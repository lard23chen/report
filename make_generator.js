const fs = require('fs');
let code = fs.readFileSync('generate_golden_disc_report.js', 'utf8');

// Replace event names
code = code.replace(
    "const TARGET_NAME = '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards';",
    "const TARGET_NAME = /deca joins 2026 world tour/i;"
);
code = code.replace(
    "const data = await collection.find({ [TARGET_FIELD]: TARGET_NAME }).toArray();",
    "const data = await collection.find({ [TARGET_FIELD]: TARGET_NAME }).toArray();"
);

// Replace report title/metadata
code = code.replace(/A_GoldenDisc_Report_2026-02-06/g, 'A_DecaJoins_Report_2026-02');
code = code.replace(/第40屆金唱片頒獎典禮 - 專案分析報表/g, 'deca joins 2026 world tour - 專案分析報表');
code = code.replace(/GOLDEN DISC AWARDS/g, 'DECA JOINS 2026');
code = code.replace(/第40屆金唱片頒獎典禮 - 專案銷售分析/g, 'world tour － 在這裡停一下 - 專案銷售分析');

// Theme colors
code = code.replace(/--accent-color: #ffd700; \/\* Gold \*\//g, '--accent-color: #4DB6AC; /* Teal */');
code = code.replace(/--accent-secondary: #ffb300;/g, '--accent-secondary: #80cbc4;');
code = code.replace(/background: linear-gradient\(135deg, #ffd700, #bf953f\);/g, 'background: linear-gradient(135deg, #4DB6AC, #26A69A);');
code = code.replace(/#ffd700/g, '#4DB6AC');
code = code.replace(/rgba\(255, 215, 0, 0\.1\)/g, 'rgba(77, 182, 172, 0.1)');
code = code.replace(/rgba\(255, 215, 0, 0\.4\)/g, 'rgba(38, 166, 154, 0.4)');
code = code.replace(/rgba\(255, 215, 0, 0\.5\)/g, 'rgba(38, 166, 154, 0.5)');

// Replace GA IDs since there is no GA
code = code.replace("const topEventId = 39311;", "const topEventId = null;");
code = code.replace("const gaSessions = await db.collection(\"QwareTrafficSession\").find({ ActivityID: topEventId }).toArray();", "const gaSessions = [];");
code = code.replace("const gaReads = await db.collection(\"QwareTrafficGAReadTime\").find({ ActivityID: topEventId }).toArray();", "const gaReads = [];");

// Replace AOV deep dive with Session Analysis table structure
const deepDiveStart = code.indexOf('<!-- AOV Analysis Section -->');
const deepDiveEnd = code.indexOf('<!--', deepDiveStart + 10);
const newHtml = `
    <!-- Sessions Analysis Section -->
    <div class="main-content">
        <div class="chart-card" style="grid-column: span 2; border-left: 5px solid #AB47BC;">
            <h3 style="border-left-color: #AB47BC;">各場次分析 (Sessions Analysis)</h3>
             <table id="sessionTable">
                <thead>
                    <tr>
                        <th style="color: #AB47BC;">場次 (Session)</th>
                        <th style="color: #AB47BC;" class="text-right">筆數 (Orders)</th>
                        <th style="color: #AB47BC;" class="text-right">張數 (Tickets)</th>
                        <th style="color: #AB47BC;" class="text-right">營收 (Revenue)</th>
                        <th style="color: #AB47BC;" class="text-right">客單價 (AOV)</th>
                        <th style="color: #AB47BC;" class="text-right">佔比 (Share)</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    </div>
    
`;
code = code.substring(0, deepDiveStart) + newHtml + code.substring(deepDiveEnd);

// Instead of injecting JS by replacing comments, we can append it directly before "function init()" closes or replace "// 1. Daily Trend"
const newJs = `
        // 0. Session Analysis
        const sessionStats = {};
        validOrders.forEach(o => {
            const session = o['場次名稱'] || '未知場次';
            if(!sessionStats[session]) sessionStats[session] = { orders: new Set(), tickets: 0, revenue: 0 };
            const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : Math.random().toString();
            sessionStats[session].orders.add(orderId);
            sessionStats[session].tickets += 1;
            sessionStats[session].revenue += (o['售價'] || 0);
        });

        const sessionArray = Object.keys(sessionStats).map(k => ({
            session: k,
            orders: sessionStats[k].orders.size,
            tickets: sessionStats[k].tickets,
            revenue: sessionStats[k].revenue
        })).sort((a,b) => b.revenue - a.revenue);

        const sessionBody = document.querySelector('#sessionTable tbody');
        if (sessionBody) {
            sessionArray.forEach(s => {
                const share = revenue ? ((s.revenue / revenue) * 100).toFixed(1) + '%' : '0%';
                const s_aov = s.orders > 0 ? Math.round(s.revenue / s.orders) : 0;
                const tr = document.createElement('tr');
                tr.innerHTML = '<td>' + s.session + '</td>' +
                    '<td class="text-right">' + s.orders.toLocaleString() + '</td>' +
                    '<td class="text-right">' + s.tickets.toLocaleString() + '</td>' +
                    '<td class="text-right">$' + s.revenue.toLocaleString() + '</td>' +
                    '<td class="text-right">$' + s_aov.toLocaleString() + '</td>' +
                    '<td class="text-right"><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">' +
                    '<div style="width:' + share + '; background:#AB47BC; height:6px;"></div>' +
                    '</div> ' + share + '</td>';
                sessionBody.appendChild(tr);
            });
        }
        
        // 1. Daily Trend`;

code = code.replace("// 1. Daily Trend", newJs);

// Fix updating index component
const addIndexCode = `
        const indexHtmlPath = path.join(__dirname, 'report', 'report_index.html');
        if (fs.existsSync(indexHtmlPath)) {
            let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
            if (!indexHtml.includes(fileName)) {
                const injectContent = \`
                <div class="card">
                    <div class="card-icon icon-comparison">🎤</div>
                    <div class="card-content">
                        <h3>deca joins 2026 world tour (A系統)</h3>
                        <p>專案銷售數據分析，包含客單價、年齡性別分佈與各場次(台北/台中/高雄)表現分析。</p>
                    </div>
                    <div class="card-meta">
                        <span class="badge">Event</span>
                        <a href="\${fileName}" class="btn-link">查看報表
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </a>
                    </div>
                </div>\`;
                indexHtml = indexHtml.replace(/<div class="grid" id="tab4-grid">/, '<div class="grid" id="tab4-grid">' + injectContent);
                indexHtml = indexHtml.replace(/<div style="grid-column: 1\\/-1; text-align: center; color: var\\(--text-secondary\\); padding: 2rem;">\\s*暫無專案報表.*?<\\/div>/, '');
                fs.writeFileSync(indexHtmlPath, indexHtml);
                console.log("Updated report_index.html");
            }
        }
        
        const rootIndexHtmlPath = path.join(__dirname, 'report_index.html');
        if (fs.existsSync(rootIndexHtmlPath)) {
            let indexHtml = fs.readFileSync(rootIndexHtmlPath, 'utf8');
            if (!indexHtml.includes(fileName)) {
                const injectContent = \`
                <div class="card">
                    <div class="card-icon icon-comparison">🎤</div>
                    <div class="card-content">
                        <h3>deca joins 2026 world tour (A系統)</h3>
                        <p>專案銷售數據分析，包含客單價、年齡性別分佈與各場次(台北/台中/高雄)表現分析。</p>
                    </div>
                    <div class="card-meta">
                        <span class="badge">Event</span>
                        <a href="report/\${fileName}" class="btn-link">查看報表
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </a>
                    </div>
                </div>\`;
                indexHtml = indexHtml.replace(/<div class="grid" id="tab4-grid">/, '<div class="grid" id="tab4-grid">' + injectContent);
                indexHtml = indexHtml.replace(/<div style="grid-column: 1\\/-1; text-align: center; color: var\\(--text-secondary\\); padding: 2rem;">\\s*暫無專案報表.*?<\\/div>/, '');
                fs.writeFileSync(rootIndexHtmlPath, indexHtml);
                console.log("Updated root report_index.html");
            }
        }
`;

code = code.replace("console.log(`Report generated successfully: ${filePath}`);", "console.log(`Report generated successfully: ${filePath}`);\n" + addIndexCode);
code = code.replace("const filePath = path.join(__dirname, fileName);", "const filePath = path.join(__dirname, 'report', fileName);");


fs.writeFileSync('generate_decajoins_report.js', code);
