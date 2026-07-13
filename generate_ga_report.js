require('dotenv').config({ path: __dirname + '/.env', quiet: true });
﻿const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function generateReport() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('GA_MonthlyStats');
        // Fetch and sort by ID for chronological data
        const docs = await collection.find({}).sort({ ID: 1 }).toArray();

        // 整理給前端圖表用的資料
        const chartData = docs.map(d => {
            const ym = (d.YearMonth || d.StartDate.toISOString().slice(0, 7)).replace(/-/g, "/");
            const sumAll = (d.A_Total || 0) + (d.D_Total || 0) + (d.E_Total || 0);
            return {
                month: ym,
                total: sumAll,
                A: { total: d.A_Total || 0, mobile: d.A_Mobile || 0 },
                D: { total: d.D_Total || 0, mobile: d.D_Mobile || 0 },
                E: { total: d.E_Total || 0, mobile: d.E_Mobile || 0 }
            };
        });

        // 按 YearMonth 升序排列（避免 ID 順序不一致導致亂序）
        chartData.sort((a, b) => a.month.localeCompare(b.month));

        // 計算整體數據
        let total_A = 0, total_A_M = 0;
        let total_D = 0, total_D_M = 0;
        let total_E = 0, total_E_M = 0;

        docs.forEach(d => {
            total_A += d.A_Total || 0; total_A_M += d.A_Mobile || 0;
            total_D += d.D_Total || 0; total_D_M += d.D_Mobile || 0;
            total_E += d.E_Total || 0; total_E_M += d.E_Mobile || 0;
        });

        const totalAll = total_A + total_D + total_E;

        const reportTime = new Date().toLocaleString('zh-TW');

        // Build MoM analysis block (latest month vs previous)
        let momSection = '';
        if (chartData.length >= 2) {
            const cur = chartData[chartData.length - 1];
            const prev = chartData[chartData.length - 2];
            const pct = (c, p) => p ? ((c - p) / p * 100).toFixed(1) : '0';
            const arrowHtml = (pctStr, diff) => {
                const v = parseFloat(pctStr);
                const color = v >= 0 ? '#66BB6A' : '#ef5350';
                const arrow = v >= 0 ? '▲' : '▼';
                return `<span style="color:${color};">${arrow} ${Math.abs(v)}%</span>（${v >= 0 ? '+' : '-'}${diff}）`;
            };
            const ppHtml = (ppStr) => {
                const v = parseFloat(ppStr);
                const color = v >= 0 ? '#66BB6A' : '#ef5350';
                return `<span style="color:${color};">(${v >= 0 ? '+' : ''}${ppStr}pp)</span>`;
            };
            const mobRate = (tot, mob) => tot ? ((mob / tot) * 100).toFixed(1) : '0';
            const dPct = pct(cur.D.total, prev.D.total);
            const aPct = pct(cur.A.total, prev.A.total);
            const ePct = pct(cur.E.total, prev.E.total);
            const dDiff = Math.abs(cur.D.total - prev.D.total).toLocaleString();
            const aDiff = Math.abs(cur.A.total - prev.A.total).toLocaleString();
            const eDiff = Math.abs(cur.E.total - prev.E.total).toLocaleString();
            const dMob = mobRate(cur.D.total, cur.D.mobile);
            const aMob = mobRate(cur.A.total, cur.A.mobile);
            const eMob = mobRate(cur.E.total, cur.E.mobile);
            const dMobPrev = mobRate(prev.D.total, prev.D.mobile);
            const aMobPrev = mobRate(prev.A.total, prev.A.mobile);
            const eMobPrev = mobRate(prev.E.total, prev.E.mobile);
            const dMobPp = (parseFloat(dMob) - parseFloat(dMobPrev)).toFixed(1);
            const aMobPp = (parseFloat(aMob) - parseFloat(aMobPrev)).toFixed(1);
            const eMobPp = (parseFloat(eMob) - parseFloat(eMobPrev)).toFixed(1);
            momSection = `<div style="margin-top:24px;">
        <h4 style="color:var(--accent-color);font-size:1rem;margin-bottom:10px;">最近月份趨勢分析 (MoM Analysis)</h4>
        <div style="background:#252525;border-radius:10px;padding:14px 18px;border-left:3px solid var(--accent-color);max-width:780px;line-height:1.8;font-size:0.92rem;">
            <div style="font-weight:700;margin-bottom:6px;color:var(--text-primary);">${cur.month} 較上月(${prev.month})</div>
            <div style="color:var(--text-secondary);">📊 <b style="color:var(--text-primary);">流量：</b>D系統 ${arrowHtml(dPct, dDiff)}、A系統 ${arrowHtml(aPct, aDiff)}、E系統 ${arrowHtml(ePct, eDiff)}。</div>
            <div style="color:var(--text-secondary);">📱 <b style="color:var(--text-primary);">Mobile 佔比：</b>D系統 ${dMob}% ${ppHtml(dMobPp)}、A系統 ${aMob}% ${ppHtml(aMobPp)}、E系統 ${eMob}% ${ppHtml(eMobPp)}。</div>
        </div>
    </div>`;
        }

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GA 系統流量分析報表</title>
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
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #121212;
            --card-bg: #1e1e1e;
            --text-primary: #e0e0e0;
            --text-secondary: #a0a0a0;
            --accent-color: #4DB6AC;
            --accent-secondary: #80CBC4;
            --shadow: 0 8px 16px rgba(0,0,0,0.3);
            
            --color-a: #FF7043;
            --color-d: #42A5F5;
            --color-e: #66BB6A;
            --color-b: #AB47BC;
        }

        body {
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            padding: 30px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        header {
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            background: linear-gradient(to right, #2c2c2c, #1e1e1e);
            padding: 30px;
            border-radius: 20px;
            box-shadow: var(--shadow);
            border-bottom: 2px solid var(--accent-color);
        }

        .logo-text {
            font-size: 2.2rem;
            font-weight: 800;
            background: linear-gradient(135deg, #4DB6AC, #80CBC4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0;
            letter-spacing: -0.5px;
            text-transform: uppercase;
        }

        .logo-sub {
            font-size: 0.9rem;
            color: var(--accent-secondary);
            margin-top: 5px;
            font-weight: 600;
        }

        .meta {
            text-align: right;
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .card {
            background: var(--card-bg);
            border-radius: 16px;
            padding: 20px;
            box-shadow: var(--shadow);
            border: 1px solid #333;
            transition: transform 0.2s;
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 4px; height: 100%;
            background: var(--accent-color);
        }
        .card.card-a::before { background: var(--color-a); }
        .card.card-d::before { background: var(--color-d); }
        .card.card-e::before { background: var(--color-e); }
        .card.card-b::before { background: var(--color-b); }

        .card:hover { transform: translateY(-3px); }

        .card h3 { margin: 0 0 10px 0; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); }
        .card .value { font-size: 1.8em; font-weight: 700; color: var(--text-primary); }
        .card .sub { font-size: 0.8em; color: #888; margin-top: 5px; display: flex; justify-content: space-between; }
        .card .mobile-rate { color: #fff; font-weight: 600; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; }

        .main-content {
            display: grid;
            grid-template-columns: 1fr;
            gap: 25px;
            margin-bottom: 40px;
        }
        
        @media(min-width: 1024px) {
            .main-content { grid-template-columns: 2fr 1fr; }
            .full-width { grid-column: 1 / -1; }
        }

        .chart-card {
            background: var(--card-bg);
            border-radius: 20px;
            padding: 25px;
            box-shadow: var(--shadow);
            position: relative;
        }

        .chart-card h3 {
            margin-top: 0;
            color: var(--text-primary);
            border-left: 4px solid var(--accent-color);
            padding-left: 10px;
            margin-bottom: 20px;
        }

        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9em; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #333; }
        th { color: var(--accent-color); font-weight: 600; text-transform: uppercase; }
        tr:hover { background-color: rgba(255, 255, 255, 0.02); }
        
        .sys-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; color: #fff; display: inline-block; width: 60px; text-align: center; }
        .bg-a { background: var(--color-a); }
        .bg-d { background: var(--color-d); }
        .bg-e { background: var(--color-e); }
        .bg-b { background: var(--color-b); }

        /* Go Home Button */
        #goHomeBtn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #424242, #212121);
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.1);
            padding: 12px 24px;
            border-radius: 50px;
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
            z-index: 1000;
        }
        #goHomeBtn:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.6);
            border-color: rgba(255,255,255,0.2);
            background: linear-gradient(135deg, #4a4a4a, #2a2a2a);
        }
    </style>
</head>
<body>

<a href="report_index.html" id="goHomeBtn">
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
    </svg>
    回首頁
</a>

<div class="container">
    <header>
        <div>
            <div class="logo-text">Traffic Analytics</div>
            <div class="logo-sub">Google Analytics 流量系統分析</div>
            <!-- Data Source Header -->
            <div style="margin-top:8px; color: #888; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px;">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> 
                Data Source: MongoDB (QwareAi / GA_MonthlyStats)
            </div>
        </div>
        <div class="meta">
            分析區間: ${chartData[0].month} ~ ${chartData[chartData.length - 1].month}<br>
            產生時間: ${reportTime}
        </div>
    </header>

    <div class="stats-grid">
        <div class="card">
            <h3>總流量 (Total Traffic)</h3>
            <div class="value">${totalAll.toLocaleString()}</div>
            <div class="sub">跨系統加總</div>
        </div>
        <div class="card card-a">
            <h3>A系統</h3>
            <div class="value" style="color: var(--color-a);">${total_A.toLocaleString()}</div>
            <div class="sub">
                <span>流量佔比: ${((total_A / totalAll) * 100).toFixed(1)}%</span>
                <span class="mobile-rate">Mobile: ${((total_A_M / total_A) * 100).toFixed(1)}%</span>
            </div>
        </div>
        <div class="card card-d">
            <h3>D系統</h3>
            <div class="value" style="color: var(--color-d);">${total_D.toLocaleString()}</div>
            <div class="sub">
                <span>流量佔比: ${((total_D / totalAll) * 100).toFixed(1)}%</span>
                <span class="mobile-rate">Mobile: ${((total_D_M / total_D) * 100).toFixed(1)}%</span>
            </div>
        </div>
        <div class="card card-e">
            <h3>E系統</h3>
            <div class="value" style="color: var(--color-e);">${total_E.toLocaleString()}</div>
            <div class="sub">
                <span>流量佔比: ${((total_E / totalAll) * 100).toFixed(1)}%</span>
                <span class="mobile-rate">Mobile: ${((total_E_M / total_E) * 100).toFixed(1)}%</span>
            </div>
        </div>
    </div>

    <div class="main-content">
        <div class="chart-card full-width">
            <h3>每月詳細數據 (Monthly Data)</h3>
            <table>
                <thead>
                    <tr>
                        <th>月份 (Month)</th>
                        <th>D系統流量</th>
                        <th>A系統流量</th>
                        <th>E系統流量</th>
                    </tr>
                </thead>
                <tbody>
                    ${[...chartData].reverse().map((d, index) => {
            // original index in chronological order
            let origIndex = chartData.length - 1 - index;
            let prev = origIndex > 0 ? chartData[origIndex - 1] : null;

            const getChangeHTML = (currVal, prevVal) => {
                if (!prevVal) return '';
                const diff = currVal - prevVal;
                const pct = ((diff / prevVal) * 100).toFixed(1);
                if (diff > 0) return '<span style="color: #66BB6A; font-size: 1em; font-weight: bold; margin-left: 5px;">▲ ' + pct + '%</span>';
                if (diff < 0) return '<span style="color: #ef5350; font-size: 1em; font-weight: bold; margin-left: 5px;">▼ ' + Math.abs(pct) + '%</span>';
                return '<span style="color: #888; font-size: 1em; font-weight: bold; margin-left: 5px;">- 0%</span>';
            };

            return '<tr>' +
                '<td style="font-weight: bold; font-size: 1.1em;">' + d.month + '</td>' +
                '<td><span style="font-size: 1.3em; font-weight: bold;">' + d.D.total.toLocaleString() + '</span> ' + getChangeHTML(d.D.total, prev?.D.total) + ' <span style="font-size: 1em; font-weight: bold; color: var(--accent-secondary); margin-left: 8px;">(Mobile 佔比: ' + (((d.D.mobile / d.D.total) * 100) || 0).toFixed(1) + '%)</span></td>' +
                '<td><span style="font-size: 1.3em; font-weight: bold;">' + d.A.total.toLocaleString() + '</span> ' + getChangeHTML(d.A.total, prev?.A.total) + ' <span style="font-size: 1em; font-weight: bold; color: var(--accent-secondary); margin-left: 8px;">(Mobile 佔比: ' + (((d.A.mobile / d.A.total) * 100) || 0).toFixed(1) + '%)</span></td>' +
                '<td><span style="font-size: 1.3em; font-weight: bold;">' + d.E.total.toLocaleString() + '</span> ' + getChangeHTML(d.E.total, prev?.E.total) + ' <span style="font-size: 1em; font-weight: bold; color: var(--accent-secondary); margin-left: 8px;">(Mobile 佔比: ' + (((d.E.mobile / d.E.total) * 100) || 0).toFixed(1) + '%)</span></td>' +
                '</tr>';
        }).join('')}
                </tbody>
            </table>
            ${momSection}
        </div>
    </div>

    <div class="main-content">
        <div class="chart-card full-width">
            <h3>每月流量趨勢 (Traffic Trend by System)</h3>
            <div style="height: 400px; width: 100%;">
                <canvas id="trendChart"></canvas>
            </div>
        </div>
    </div>

    <div class="main-content">
        <div class="chart-card">
            <h3>系統流量佔比 (Traffic Share)</h3>
            <div style="height: 350px;">
                <canvas id="shareChart"></canvas>
            </div>
        </div>
        
        <div class="chart-card">
            <h3>行動裝置佔比 (Mobile Usage)</h3>
            <div style="height: 350px;">
                <canvas id="mobileChart"></canvas>
            </div>
        </div>
    </div>

</div>

<script>
    const chartData = ${JSON.stringify(chartData)};
    
    const months = chartData.map(d => d.month);
    
    // 1. 每月流量折線圖
    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'A系統',
                    data: chartData.map(d => d.A.total),
                    borderColor: '#FF7043',
                    backgroundColor: 'rgba(255, 112, 67, 0.1)',
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4
                },
                {
                    label: 'D系統',
                    data: chartData.map(d => d.D.total),
                    borderColor: '#42A5F5',
                    backgroundColor: 'rgba(66, 165, 245, 0.1)',
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4
                },
                {
                    label: 'E系統',
                    data: chartData.map(d => d.E.total),
                    borderColor: '#66BB6A',
                    backgroundColor: 'rgba(102, 187, 106, 0.1)',
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4
                }
            ]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#ccc' } },
                datalabels: {
                    color: '#fff',
                    align: 'top',
                    offset: 4,
                    font: { size: 10, weight: 'bold' },
                    formatter: (value, ctx) => {
                        if(ctx.dataset.label === '總流量') return ''; // optionally hide total flow labels so it doesn't clutter
                        return value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value;
                    }
                }
            },
            scales: {
                x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                y: { grid: { color: '#333' }, ticks: { color: '#888', callback: v => (v>=1000 ? (v/1000) + 'k' : v) } }
            }
        }
    });

    // 2. 系統佔比圓餅圖
    new Chart(document.getElementById('shareChart'), {
        type: 'doughnut',
        data: {
            labels: ['A系統', 'D系統', 'E系統'],
            datasets: [{
                data: [${total_A}, ${total_D}, ${total_E}],
                backgroundColor: ['#FF7043', '#42A5F5', '#66BB6A'],
                borderWidth: 0
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#ccc' } },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 14 },
                    formatter: (value, ctx) => {
                        let sum = ctx.chart._metasets[ctx.datasetIndex].total;
                        let percentage = (value * 100 / sum).toFixed(1) + "%";
                        return percentage;
                    }
                }
            }
        }
    });

    // 3. 行動裝置佔比長條圖
    const mobileRates = [
        ${((total_A_M / total_A) * 100).toFixed(1)},
        ${((total_D_M / total_D) * 100).toFixed(1)},
        ${((total_E_M / total_E) * 100).toFixed(1)}
    ];
    
    new Chart(document.getElementById('mobileChart'), {
        type: 'bar',
        data: {
            labels: ['A系統', 'D系統', 'E系統'],
            datasets: [{
                label: 'Mobile %',
                data: mobileRates,
                backgroundColor: ['#FF7043', '#42A5F5', '#66BB6A'],
                borderRadius: 6
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: '#fff',
                    anchor: 'end',
                    align: 'top',
                    font: { weight: 'bold' },
                    formatter: v => v + '%'
                }
            },
            scales: {
                y: { max: 100, grid: { color: '#333' }, ticks: { color: '#ccc', callback: v => v + '%' } },
                x: { grid: { display: false }, ticks: { color: '#ccc' } }
            }
        }
    });

</script>

</body>
</html>
`;

        const outPath = path.join(__dirname, 'A_GA_Traffic_Analysis_Report.html');
        fs.writeFileSync(outPath, htmlContent, 'utf8');
        console.log(`Report generated successfully at ${outPath}`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

generateReport();
