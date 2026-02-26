const fs = require('fs');
const path = require('path');

let code = fs.readFileSync('generate_golden_disc_report.js', 'utf8');

// 1. Data Source
code = code.replace(
    "const TARGET_NAME = '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards';",
    "const TARGET_NAME = /deca joins 2026 world tour/i;"
);

// 2. Headings and Metadata
code = code.replace(/A_GoldenDisc_Report_2026-02-06/g, 'A_DecaJoins_Report_2026-02');
code = code.replace(/第40屆金唱片頒獎典禮 - 專案分析報表/g, 'deca joins 2026 world tour - 專案分析報表');
code = code.replace(/GOLDEN DISC AWARDS/g, 'DECA JOINS 2026');
code = code.replace(/第40屆金唱片頒獎典禮 - 專案銷售分析/g, 'world tour － 在這裡停一下 - 專案銷售分析');

// 3. Colors
code = code.replace(/--accent-color: #ffd700; \/\* Gold \*\//g, '--accent-color: #4DB6AC; /* Teal */');
code = code.replace(/--accent-secondary: #ffb300;/g, '--accent-secondary: #80cbc4;');
code = code.replace(/background: linear-gradient\(135deg, #ffd700, #bf953f\);/g, 'background: linear-gradient(135deg, #4DB6AC, #26A69A);');
code = code.replace(/background: linear-gradient\(135deg, #1e88e5, #1565c0\);/g, 'background: linear-gradient(135deg, #4DB6AC, #26A69A);');
code = code.replace(/#ffd700/g, '#4DB6AC');
code = code.replace(/rgba\(255, 215, 0, 0\.1\)/g, 'rgba(77, 182, 172, 0.1)');
code = code.replace(/rgba\(255, 215, 0, 0\.4\)/g, 'rgba(38, 166, 154, 0.4)');
code = code.replace(/rgba\(255, 215, 0, 0\.5\)/g, 'rgba(38, 166, 154, 0.5)');

// 4. GA Disable
code = code.replace("const topEventId = 39311;", "const topEventId = null;");
code = code.replace("db.collection(\"QwareTrafficSession\").find({ ActivityID: topEventId }).toArray();", "[];");
code = code.replace("db.collection(\"QwareTrafficGAReadTime\").find({ ActivityID: topEventId }).toArray();", "[];");

// 5. Replace AOV Deep Dive with Sessions analysis
const htmlReplaceStart = '<!-- AOV Analysis Section -->';
const htmlReplaceEnd = '        </div>\\n    </div>\\n\\n</div>\\n\\n<script>';
const newHtml = \`    <!-- Sessions Analysis Section -->
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
</div>

<script>\`;
code = code.replace(new RegExp(htmlReplaceStart + '[\\\\s\\\\S]*?<\/div>\\\\s*<\/div>\\\\s*<\/div>\\\\s*<script>'), newHtml);

// 6. JS script logic modification
const jsHook = "// 1. Daily Trend";
const newJs = \`        // 0. Session Analysis
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
        
        // 1. Daily Trend\`;

code = code.replace("// 1. Daily Trend", newJs);

// 7. Output fix & Back to home link fix
code = code.replace("const filePath = path.join(__dirname, fileName);", "const filePath = path.join(__dirname, 'report', fileName);");
code = code.replace('href="report_index.html"', 'href="../report_index.html"');

fs.writeFileSync('generate_decajoins_report.js', code);
