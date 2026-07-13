require('dotenv').config({ path: __dirname + '/.env', quiet: true });
﻿
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function main() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");

        const eventName = "中華職棒37年例行賽統一獅主場（上）";
        const startTimeStr = "2026-03-09 18:00:00";
        const endTimeStr = "2026-03-09 23:59:59";

        console.log(`Fetching order data for ${eventName}...`);
        const collection = db.collection("Qware_A_Ticket_data_Daily");
        
        const allData = await collection.find({
            "節目/商品名稱": { $regex: eventName },
            "交易時間": { $regex: "^2026-03-09" }
        }).toArray();

        // Further filter by precise time
        const data = allData.filter(d => {
            const time = d['交易時間'];
            return time >= startTimeStr && time <= endTimeStr;
        });

        console.log(`Found ${data.length} ticket records.`);

        if (data.length === 0) {
            console.log("No data found for the specified period.");
            return;
        }

        // --- Data Aggregation ---
        let totalRevenue = 0;
        let totalTickets = 0;
        let orderIds = new Set();
        let ticketTypeStats = {};
        let paymentStats = {};
        let salesPointStats = {};
        let genderStats = { "男": 0, "女": 0, "其他": 0 };
        let ageStats = { "20以下": 0, "21-30": 0, "31-40": 0, "41-50": 0, "51+": 0, "未知": 0 };
        let minuteTrend = {};

        data.forEach(d => {
            if (d['狀態'] !== '正常') return;

            let revenue = 0;
            if (d['售價']) {
                if (typeof d['售價'] === 'number') {
                    revenue = d['售價'];
                } else if (d['售價'].$numberDecimal) {
                    revenue = parseFloat(d['售價'].$numberDecimal);
                } else {
                    revenue = parseFloat(d['售價'].toString());
                }
            }
            
            totalRevenue += revenue;
            totalTickets += 1;

            const orderId = d['訂單編號'] ? d['訂單編號'].split('_')[0] : 'Unknown';
            orderIds.add(orderId);

            const tType = d['票別'] || '未知';
            ticketTypeStats[tType] = (ticketTypeStats[tType] || 0) + 1;

            const payment = d['付款方式'] || '未知';
            paymentStats[payment] = (paymentStats[payment] || 0) + revenue;

            const sp = d['銷售點'] || '未知';
            salesPointStats[sp] = (salesPointStats[sp] || 0) + 1;

            const gender = d['性別'] || '未知';
            if (gender === '男') genderStats['男']++;
            else if (gender === '女') genderStats['女']++;
            else genderStats['其他']++;

            const age = d['年齡'];
            if (typeof age === 'number') {
                if (age <= 20) ageStats["20以下"]++;
                else if (age <= 30) ageStats["21-30"]++;
                else if (age <= 40) ageStats["31-40"]++;
                else if (age <= 50) ageStats["41-50"]++;
                else ageStats["51+"]++;
            } else {
                ageStats["未知"]++;
            }

            // Grouping by 30-minute intervals
            const hour = d['交易時間'].slice(11, 13);
            const rawMinute = parseInt(d['交易時間'].slice(14, 16));
            const minutePart = rawMinute < 30 ? "00" : "30";
            const timeKey = `${hour}:${minutePart}`;

            if (!minuteTrend[timeKey]) minuteTrend[timeKey] = { tickets: 0, revenue: 0 };
            minuteTrend[timeKey].tickets += 1;
            minuteTrend[timeKey].revenue += revenue;
        });

        const orderCount = orderIds.size;
        const aov = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

        // Prepare Trend Data
        // Ensure all 30-min slots from 18:00 to 23:30 are represented
        const trendLabels = [];
        for (let h = 18; h <= 23; h++) {
            trendLabels.push(`${h.toString().padStart(2, '0')}:00`);
            trendLabels.push(`${h.toString().padStart(2, '0')}:30`);
        }
        
        const trendTickets = trendLabels.map(label => (minuteTrend[label] ? minuteTrend[label].tickets : 0));
        const trendRevenue = trendLabels.map(label => (minuteTrend[label] ? minuteTrend[label].revenue : 0));

        // --- HTML Generation ---
        const reportTime = new Date().toLocaleString('zh-TW');

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${eventName} - 訂單分析報告</title>
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
            --bg-color: #f0f2f5;
            --card-bg: #ffffff;
            --text-primary: #1c1e21;
            --accent-color: #ff9800; /* Lions Orange */
            --accent-dark: #e65100;
            --shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background: var(--bg-color); color: var(--text-primary); padding: 40px; }
        .container { max-width: 1400px; margin: 0 auto; }
        header { 
            background: linear-gradient(135deg, #ff9800, #ff5722); 
            color: white; 
            padding: 30px; 
            border-radius: 20px; 
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: var(--shadow);
        }
        header h1 { margin: 0; font-size: 2rem; }
        .meta { text-align: right; opacity: 0.9; font-size: 0.9rem; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .card { background: var(--card-bg); padding: 25px; border-radius: 16px; box-shadow: var(--shadow); border-left: 6px solid var(--accent-color); }
        .card .label { font-size: 0.9rem; color: #65676b; margin-bottom: 10px; font-weight: 600; }
        .card .value { font-size: 2.2rem; font-weight: 800; color: var(--accent-dark); }
        
        .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; margin-bottom: 30px; }
        .chart-box { background: var(--card-bg); padding: 25px; border-radius: 20px; box-shadow: var(--shadow); position: relative; }
        .chart-box h3 { margin-top: 0; border-bottom: 2px solid #f0f2f5; padding-bottom: 15px; }

        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-card { background: var(--card-bg); padding: 20px; border-radius: 16px; box-shadow: var(--shadow); }

        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #f0f2f5; }
        th { color: #8a8d91; font-weight: 600; }
        .percentage { color: #8a8d91; font-size: 0.85rem; margin-left:8px; }

        .footer { text-align: center; margin-top: 50px; color: #8a8d91; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>${eventName}</h1>
                <p>訂單深度分析報告 (Lions Order Analysis)</p>\n<!-- Data Source Header -->\n<div style="margin-top:8px; color: #fff; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px; opacity: 0.9;">\n    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> \n    Data Source: MongoDB (QwareAi / Qware_A_Ticket_data_Daily)\n</div>
            </div>
            <div class="meta">
                分析期間: 2026/03/09 18:00 ~ 23:59<br>
                報表時間: ${reportTime}<br>
                分析筆數: ${data.length.toLocaleString()} 筆票券
            </div>
        </header>

        <div class="stats-grid">
            <div class="card">
                <div class="label">總銷售金額 (Gross Revenue)</div>
                <div class="value">NT$ ${totalRevenue.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="label">總銷售張數 (Total Tickets)</div>
                <div class="value">${totalTickets.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="label">總訂單數 (Total Orders)</div>
                <div class="value">${orderCount.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="label">客單價 (AOV)</div>
                <div class="value">NT$ ${aov.toLocaleString()}</div>
            </div>
        </div>

        <div class="main-grid">
            <div class="chart-box">
                <h3>銷售趨勢 (每30分鐘單位)</h3>
                <div style="height: 450px;">
                    <canvas id="trendChart"></canvas>
                </div>
            </div>
            <div class="chart-box">
                <h3>性別比例 (Gender Ratio)</h3>
                <div style="height: 300px;">
                    <canvas id="genderChart"></canvas>
                </div>
                <table style="margin-top: 20px;">
                    ${Object.entries(genderStats).map(([k, v]) => `
                        <tr>
                            <td>${k}</td>
                            <td style="text-align: right;">${v.toLocaleString()} 人 <span class="percentage">(${(v/totalTickets*100).toFixed(1)}%)</span></td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        </div>

        <div class="main-grid">
            <div class="chart-box">
                <h3>票別分析 (Ticket Types)</h3>
                <table>
                    <thead>
                        <tr><th>票別</th><th style="text-align:right;">張數</th><th style="text-align:right;">佔比</th></tr>
                    </thead>
                    <tbody>
                        ${Object.entries(ticketTypeStats).sort((a,b) => b[1] - a[1]).map(([k, v]) => `
                            <tr>
                                <td style="font-weight:600;">${k}</td>
                                <td style="text-align:right;">${v.toLocaleString()}</td>
                                <td style="text-align:right; color:#8a8d91;">${(v/totalTickets*100).toFixed(1)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="chart-box">
                <h3>年齡層分析 (Age Distribution)</h3>
                <div style="height: 250px;">
                    <canvas id="ageChart"></canvas>
                </div>
            </div>
        </div>

        <div class="info-grid">
            <div class="info-card">
                <h3>付款方式 (Payment)</h3>
                <table>
                    ${Object.entries(paymentStats).sort((a,b) => b[1]-a[1]).map(([k, v]) => `
                        <tr>
                            <td>${k}</td>
                            <td style="text-align:right; font-weight:700;">NT$ ${v.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
            <div class="info-card">
                <h3>銷售通路 (Channels)</h3>
                <table>
                    ${Object.entries(salesPointStats).sort((a,b) => b[1]-a[1]).map(([k, v]) => `
                        <tr>
                            <td>${k}</td>
                            <td style="text-align:right; font-weight:700;">${v.toLocaleString()} 張</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        </div>

        <div class="footer">
            &copy; 2026 Qware售票系統分析中心 | 報表產出日期: ${reportTime}
        </div>
    </div>

    <script>
        // Trend Chart
        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: ${JSON.stringify(trendLabels)},
                datasets: [
                    {
                        label: '銷售張數',
                        data: ${JSON.stringify(trendTickets)},
                        borderColor: '#ff9800',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        fill: true,
                        yAxisID: 'y',
                        datalabels: {
                            color: '#e65100',
                            align: 'top',
                            anchor: 'end',
                            offset: 5,
                            font: { weight: 'bold' }
                        }
                    },
                    {
                        label: '銷售金額',
                        data: ${JSON.stringify(trendRevenue)},
                        borderColor: '#e91e63',
                        borderDash: [5, 5],
                        yAxisID: 'y1',
                        datalabels: {
                            color: '#ad1457',
                            align: 'bottom',
                            anchor: 'start',
                            offset: 5,
                            formatter: (val) => val > 0 ? 'NT$' + (val/10000).toFixed(1) + 'w' : ''
                        }
                    }
                ]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { position: 'left', title: { display: true, text: '張數' }, beginAtZero: true },
                    y1: { position: 'right', title: { display: true, text: '金額' }, grid: { drawOnChartArea: false }, beginAtZero: true }
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        // Gender Chart
        new Chart(document.getElementById('genderChart'), {
            type: 'doughnut',
            data: {
                labels: ['男', '女', '其他'],
                datasets: [{
                    data: [${genderStats['男']}, ${genderStats['女']}, ${genderStats['其他']}],
                    backgroundColor: ['#2196f3', '#f44336', '#9c27b0']
                }]
            }
        });

        // Age Chart
        new Chart(document.getElementById('ageChart'), {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(Object.keys(ageStats))},
                datasets: [{
                    label: '人數',
                    data: ${JSON.stringify(Object.values(ageStats))},
                    backgroundColor: '#ffc107'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    </script>
</body>
</html>
        `;

        const outPath = path.join(__dirname, 'A_UniformLions_Order_Analysis_20260309.html');
        fs.writeFileSync(outPath, htmlContent, 'utf8');
        console.log('Report generated at ' + outPath);

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}
main();
