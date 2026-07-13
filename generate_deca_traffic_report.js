require('dotenv').config({ path: __dirname + '/.env', quiet: true });
﻿const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

const sessionMapping = {
  "B0AQY9PL": "台北站 (5/1)",
  "B0ARAQUY": "台北站 (5/2)",
  "B0ARARJH": "台北站 (5/3)",
  "B0ARASAV": "台中站 (5/8)",
  "B0ARATMZ": "高雄站 (5/10)"
};

async function run() {
    try {
        await client.connect();
        const db = client.db('QwareAi');
        const trafficCol = db.collection('Qware_A_Traffic_session_data');

        const projectName = 'deca joins 2026 world tour － 在這裡停一下';
        const trafficRecords = await trafficCol.find({ '節目名稱': projectName }).toArray();

        // 1. Group by session
        const sessionStats = {};
        const allDates = new Set();

        trafficRecords.forEach(rec => {
            const sid = rec.場次代碼;
            const sessionName = sessionMapping[sid] || sid;
            const date = rec.瀏覽日期.toISOString().split('T')[0];
            const views = rec.瀏覽量 || 0;

            if (!sessionStats[sessionName]) {
                sessionStats[sessionName] = { total: 0, daily: {} };
            }
            sessionStats[sessionName].total += views;
            sessionStats[sessionName].daily[date] = (sessionStats[sessionName].daily[date] || 0) + views;
            allDates.add(date);
        });

        const sortedDates = [...allDates].sort();
        const sortedSessions = Object.keys(sessionStats).sort((a, b) => sessionStats[b].total - sessionStats[a].total);

        // 2. Build HTML
        const reportTime = new Date().toLocaleString('zh-TW');
        const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>deca joins 2026 場次流量分析</title>
    <!-- IP Allowlist: internal network only -->
    <style>html { visibility: hidden; }</style>
    <script>
        (function () {
            var ALLOWED = [
                '211.75.181.109', '211.75.181.110',
                '220.130.6.196',  '220.130.6.197',  '220.130.6.198',
                '220.130.134.238','220.130.134.239', '220.130.134.240',
                '133.149.194.24'
            ];
            function deny(ip) {
                document.documentElement.style.visibility = 'visible';
                document.body.style.cssText = 'margin:0;padding:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;';
                document.body.innerHTML =
                    '<div style="text-align:center;font-family:Outfit,sans-serif;padding:40px">' +
                    '<div style="font-size:5rem;margin-bottom:20px">🔒</div>' +
                    '<h1 style="color:#ef4444;font-size:2rem;margin:0 0 14px">存取被拒絕</h1>' +
                    '<p style="color:#94a3b8;margin:0 0 8px">您目前的 IP 位址：' +
                    '<code style="background:#1e293b;padding:2px 10px;border-radius:4px;color:#f472b6">' + ip + '</code></p>' +
                    '<p style="color:#64748b;font-size:0.88rem">此頁面僅限內部網路存取 &middot; Access restricted to internal network only</p>' +
                    '</div>';
            }
            var timer = setTimeout(function () { deny('timeout'); }, 6000);
            fetch('https://api.ipify.org?format=json')
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    clearTimeout(timer);
                    if (ALLOWED.indexOf(d.ip) !== -1) {
                        document.documentElement.style.visibility = 'visible';
                    } else {
                        deny(d.ip);
                    }
                })
                .catch(function () { clearTimeout(timer); deny('unknown'); });
        })();
    </script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0f172a;
            --card: #1e293b;
            --accent: #38bdf8;
            --text: #f8fafc;
            --text-muted: #94a3b8;
        }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background: var(--bg); color: var(--text); padding: 40px; }
        .container { max-width: 1200px; margin: 0 auto; }
        header { margin-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px; }
        h1 { font-size: 2.2rem; margin-bottom: 5px; color: var(--accent); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: var(--card); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
        .stat-card h3 { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; margin-top: 0; }
        .stat-card .value { font-size: 1.5rem; font-weight: 800; }
        
        .chart-container { background: var(--card); padding: 30px; border-radius: 20px; margin-bottom: 40px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.05); }
        th:first-child, td:first-child { text-align: left; }
        th { color: var(--accent); font-size: 0.8rem; }
        tr:hover { background: rgba(255,255,255,0.02); }
        .total-row { font-weight: 800; color: var(--accent); }
        
        #pdfBtn {
            position: fixed;
            top: 40px;
            right: 40px;
            background: var(--accent);
            color: var(--bg);
            border: none;
            padding: 12px 24px;
            border-radius: 50px;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(56, 189, 248, 0.4);
            transition: all 0.2s;
            z-index: 100;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #pdfBtn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(56, 189, 248, 0.6); }
        
        @media print {
            #pdfBtn { display: none; }
            body { background: white; color: black; padding: 20px; }
            .stat-card, .chart-container { 
                background: white !important; 
                border: 1px solid #ddd !important;
                color: black !important;
                box-shadow: none !important;
            }
            h1, h3, .accent, th { color: #0f172a !important; }
            .stat-card .value { color: #0284c7 !important; }
            .text-muted { color: #64748b !important; }
        }
    </style>
</head>
<body>
    <button id="pdfBtn" onclick="window.print()">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        另存 PDF
    </button>
    <div class="container">
        <header>
            <h1>deca joins 2026 world tour 場次流量分析</h1>
            <div style="color: var(--text-muted); font-size: 0.9rem;">報告產生時間: ${reportTime}</div>
        </header>

        <div class="grid">
            ${sortedSessions.map(s => `
                <div class="stat-card">
                    <h3>${s}</h3>
                    <div class="value">${sessionStats[s].total.toLocaleString()}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">總瀏覽量</div>
                </div>
            `).join('')}
        </div>

        <div class="chart-container" style="overflow-x: auto;">
            <h3>每日場次明細</h3>
            <table>
                <thead>
                    <tr>
                        <th>日期</th>
                        ${sortedSessions.map(s => `<th>${s}</th>`).join('')}
                        <th>當日總計</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedDates.map(d => {
                        let dayTotal = 0;
                        return `<tr>
                            <td>${d}</td>
                            ${sortedSessions.map(s => {
                                const v = sessionStats[s].daily[d] || 0;
                                dayTotal += v;
                                return `<td>${v.toLocaleString()}</td>`;
                            }).join('')}
                            <td style="font-weight: bold;">${dayTotal.toLocaleString()}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td>場次總計</td>
                        ${sortedSessions.map(s => `<td>${sessionStats[s].total.toLocaleString()}</td>`).join('')}
                        <td>${Object.values(sessionStats).reduce((acc, cur) => acc + cur.total, 0).toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
</body>
</html>
        `;

        const outPath = path.join(__dirname, 'A_DecaJoins_Traffic_Analysis.html');
        fs.writeFileSync(outPath, html, 'utf8');
        console.log(`Report generated: ${outPath}`);

    } finally {
        await client.close();
    }
}
run();
