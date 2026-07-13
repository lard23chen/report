require('dotenv').config({ path: __dirname + '/.env', quiet: true });
﻿const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");

        const startTime = new Date("2026-03-09T18:00:00+08:00");
        const endTime = new Date("2026-03-09T18:30:00+08:00");

        const sessions = await db.collection("QwareTrafficSession").find({
            ActivityID: 39455,
            CreateTime: { $gte: startTime, $lte: endTime }
        }).sort({ CreateTime: 1 }).toArray();

        const reads = await db.collection("QwareTrafficGAReadTime").find({
            ActivityID: 39455,
            CreateTime: { $gte: startTime, $lte: endTime }
        }).sort({ CreateTime: 1 }).toArray();

        const masterMap = {};
        sessions.forEach(s => {
            const m = s.CreateTime.getMinutes().toString().padStart(2, '0');
            const key = `18:${m}`;
            if (!masterMap[key]) masterMap[key] = { time: key, session: 0, activeD: 0, activeA: 0, activeDMin: 0, activeAMin: 0 };
            masterMap[key].session = Math.max(masterMap[key].session, s.SessionCount);
        });

        reads.forEach(r => {
            const m = r.CreateTime.getMinutes().toString().padStart(2, '0');
            const key = `18:${m}`;
            if (!masterMap[key]) masterMap[key] = { time: key, session: 0, activeD: 0, activeA: 0, activeDMin: 0, activeAMin: 0 };
            masterMap[key].activeD = Number(r.ActiveUsersDCount) || 0;
            masterMap[key].activeA = Number(r.ActiveUsersACount) || 0;
            masterMap[key].activeDMin = Number(r.ActiveUsersDMinCount) || 0;
            masterMap[key].activeAMin = Number(r.ActiveUsersAMinCount) || 0;
        });

        const sortedData = Object.keys(masterMap).sort().map(k => masterMap[k]);

        const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>統一獅開賣流量深度分析 (3/9 18:00-18:30)</title>
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
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&family=Noto+Sans+TC:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #3b82f6; }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background: var(--bg); color: var(--text); padding: 40px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { margin-bottom: 10px; color: var(--accent); }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .card { background: var(--card); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }
        .card h3 { margin: 0; font-size: 0.9rem; opacity: 0.7; }
        .card .val { font-size: 1.8rem; font-weight: 700; margin-top: 5px; }
        .chart-wrap { background: var(--card); padding: 25px; border-radius: 16px; margin-bottom: 30px; height: 500px; }
        table { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 12px; overflow: hidden; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }
        th { background: rgba(255,255,255,0.05); color: var(--accent); }
        .peak { color: #f87171; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🦁 統一獅 37 年度例行賽預售流量分析</h1>
        <p style="opacity:0.6; margin-bottom:30px;">時段：2026/03/09 18:00 - 18:30 | 展平數據報告</p>

        <div class="summary">
            <div class="card"><h3>Session 峰值</h3><div class="val">${Math.max(...sortedData.map(d=>d.session))}</div></div>
            <div class="card"><h3>最高網頁在線</h3><div class="val">${Math.max(...sortedData.map(d=>d.activeD))}</div></div>
            <div class="card"><h3>最高 APP 在線</h3><div class="val">${Math.max(...sortedData.map(d=>d.activeA))}</div></div>
            <div class="card"><h3>總在線人數 (終點)</h3><div class="val">${sortedData[sortedData.length-1].activeD + sortedData[sortedData.length-1].activeA}</div></div>
        </div>

        <div class="chart-wrap"><canvas id="mainChart"></canvas></div>

        <table>
            <thead><tr><th>時間</th><th>Session</th><th>網頁在線 (D)</th><th>APP 在線 (A)</th><th>總在線</th><th>網頁/分</th><th>APP/分</th></tr></thead>
            <tbody>
                ${sortedData.map(d => `
                    <tr>
                        <td>${d.time}</td>
                        <td class="${d.session > 2000 ? 'peak' : ''}">${d.session.toLocaleString()}</td>
                        <td>${d.activeD.toLocaleString()}</td>
                        <td>${d.activeA.toLocaleString()}</td>
                        <td style="font-weight:700">${(d.activeD + d.activeA).toLocaleString()}</td>
                        <td style="opacity:0.7">${d.activeDMin.toLocaleString()}</td>
                        <td style="opacity:0.7">${d.activeAMin.toLocaleString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <script>
        const ctx = document.getElementById('mainChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(sortedData.map(d=>d.time))},
                datasets: [
                    { label: 'Session', data: ${JSON.stringify(sortedData.map(d=>d.session))}, borderColor: '#3b82f6', tension: 0.3, yAxisID: 'y' },
                    { label: '網頁在線 (D)', data: ${JSON.stringify(sortedData.map(d=>d.activeD))}, borderColor: '#f59e0b', tension: 0.3, yAxisID: 'y1' },
                    { label: 'APP 在線 (A)', data: ${JSON.stringify(sortedData.map(d=>d.activeA))}, borderColor: '#10b981', tension: 0.3, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Session' } },
                    y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Active Users' } }
                },
                plugins: { legend: { labels: { color: '#f8fafc' } } }
            }
        });
    </script>
</body>
</html>`;
        fs.writeFileSync('A_UniformLions_GA_Analysis_20260309.html', html);
        console.log("Report generated: A_UniformLions_GA_Analysis_20260309.html");

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
