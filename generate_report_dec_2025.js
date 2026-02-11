
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB Connection Setup
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
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
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Fetching data for Dec 2025 and Jan 2026...");
        const dataDec = await collection.find({ "交易時間": { $regex: "^2025-12" } }).toArray();
        const dataJan = await collection.find({ "交易時間": { $regex: "^2026-01" } }).toArray();

        console.log(`Fetched Dec 2025: ${dataDec.length} records.`);
        console.log(`Fetched Jan 2026: ${dataJan.length} records.`);

        // Helper to calculate stats
        function calcStats(data) {
            const validOrders = data.filter(d => d['狀態'] === '正常');

            const revenue = validOrders.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
            const tickets = validOrders.length;

            const uniqueOrders = new Set();
            validOrders.forEach(o => {
                if (o['訂單編號']) uniqueOrders.add(o['訂單編號'].split('_')[0]);
            });
            const orders = uniqueOrders.size;
            const aov = orders ? Math.round(revenue / orders) : 0;

            return { revenue, tickets, orders, aov };
        }

        const statsDec = calcStats(dataDec);
        const statsJan = calcStats(dataJan);

        // Calculate Growth Rates
        function calcGrowth(current, previous) {
            if (!previous) return 'N/A';
            const diff = current - previous;
            const pct = (diff / previous) * 100;
            return {
                diff: diff,
                pct: pct.toFixed(1) + '%',
                isPositive: diff >= 0
            };
        }

        const growth = {
            revenue: calcGrowth(statsJan.revenue, statsDec.revenue),
            tickets: calcGrowth(statsJan.tickets, statsDec.tickets),
            orders: calcGrowth(statsJan.orders, statsDec.orders),
            aov: calcGrowth(statsJan.aov, statsDec.aov)
        };

        // Prepare Chart Data (Daily Revenue Overlay)
        function getDailyRevenue(data) {
            const daily = {}; // key: day (1-31)
            for (let i = 1; i <= 31; i++) daily[i] = 0;

            data.filter(d => d['狀態'] === '正常').forEach(d => {
                if (!d['交易時間']) return;
                const datePart = d['交易時間'].split(' ')[0]; // YYYY-MM-DD
                const day = parseInt(datePart.split('-')[2]);
                daily[day] += (d['售價'] || 0);
            });
            return Object.values(daily);
        }

        const dailyDec = getDailyRevenue(dataDec);
        const dailyJan = getDailyRevenue(dataJan);
        const days = Array.from({ length: 31 }, (_, i) => i + 1);

        // Load Logo Base64
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, 'ibon_logo.png');
            if (fs.existsSync(logoPath)) {
                const logoBuffer = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            }
        } catch (err) { }

        const reportTime = new Date().toLocaleString('zh-TW');

        // HTML Template
        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>銷售比較分析: 2025/12 vs 2026/01</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #f5f7fa;
            --card-bg: #ffffff;
            --text-primary: #333;
            --accent-pos: #2e7d32;
            --accent-neg: #c62828;
            --shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        body { font-family: 'Inter', sans-serif; background: var(--bg-color); color: var(--text-primary); padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        
        header { 
            background: white; padding: 20px; border-radius: 12px; box-shadow: var(--shadow); margin-bottom: 30px; 
            display: flex; justify-content: space-between; align-items: center;
        }
        .header-title h1 { margin: 0; font-size: 1.5em; color: #1a237e; }
        .meta { font-size: 0.9em; color: #666; text-align: right; }

        .comp-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white; padding: 20px; border-radius: 12px; box-shadow: var(--shadow);
            position: relative;
        }
        .card h3 { margin: 0 0 10px 0; font-size: 0.9em; color: #666; }
        .card .value { font-size: 1.6em; font-weight: bold; color: #333; }
        .card .prev-val { font-size: 0.85em; color: #999; margin-top: 5px; }
        .card .badge {
            position: absolute; top: 20px; right: 20px;
            padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.85em;
        }
        .pos { background: #e8f5e9; color: var(--accent-pos); }
        .neg { background: #ffebee; color: var(--accent-neg); }

        .chart-container {
            background: white; padding: 20px; border-radius: 12px; box-shadow: var(--shadow);
            height: 400px; margin-bottom: 30px;
        }

        table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; border-radius: 12px; overflow: hidden; box-shadow: var(--shadow); }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; color: #555; }
        .text-right { text-align: right; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div style="display:flex; align-items:center; gap:15px;">
                <img src="${logoBase64}" style="height:40px;">
                <div class="header-title">
                    <h1>銷售比較分析報告 (Sales Comparison)</h1>
                    <div style="color:#666; margin-top:4px;">2025年12月 vs 2026年01月</div>
                </div>
            </div>
            <div class="meta">
                產出時間: ${reportTime}<br>
                製表者: 陳俊良
            </div>
        </header>

        <!-- KPI Cards -->
        <div class="comp-grid">
            <div class="card">
                <h3>總營收 (Revenue)</h3>
                <div class="value">NT$ ${statsJan.revenue.toLocaleString()}</div>
                <div class="prev-val">前月: NT$ ${statsDec.revenue.toLocaleString()}</div>
                <div class="badge ${growth.revenue.isPositive ? 'pos' : 'neg'}">
                    ${growth.revenue.isPositive ? '▲' : '▼'} ${growth.revenue.pct}
                </div>
            </div>
            <div class="card">
                <h3>客單價 (AOV)</h3>
                <div class="value">NT$ ${statsJan.aov.toLocaleString()}</div>
                <div class="prev-val">前月: NT$ ${statsDec.aov.toLocaleString()}</div>
                <div class="badge ${growth.aov.isPositive ? 'pos' : 'neg'}">
                    ${growth.aov.isPositive ? '▲' : '▼'} ${growth.aov.pct}
                </div>
            </div>
            <div class="card">
                <h3>總交易張數 (Tickets)</h3>
                <div class="value">${statsJan.tickets.toLocaleString()}</div>
                <div class="prev-val">前月: ${statsDec.tickets.toLocaleString()}</div>
                <div class="badge ${growth.tickets.isPositive ? 'pos' : 'neg'}">
                    ${growth.tickets.isPositive ? '▲' : '▼'} ${growth.tickets.pct}
                </div>
            </div>
            <div class="card">
                <h3>總訂單筆數 (Orders)</h3>
                <div class="value">${statsJan.orders.toLocaleString()}</div>
                <div class="prev-val">前月: ${statsDec.orders.toLocaleString()}</div>
                <div class="badge ${growth.orders.isPositive ? 'pos' : 'neg'}">
                    ${growth.orders.isPositive ? '▲' : '▼'} ${growth.orders.pct}
                </div>
            </div>
        </div>

        <!-- Chart -->
        <div class="chart-container">
            <canvas id="compChart"></canvas>
        </div>

        <!-- Summary Table -->
         <h3 style="margin-bottom:10px; color:#333;">詳細數據對比 (Detailed Statistics)</h3>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th class="text-right">Dec 2025</th>
                    <th class="text-right">Jan 2026</th>
                    <th class="text-right">Difference</th>
                    <th class="text-right">Growth %</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>總營收 (Total Revenue)</td>
                    <td class="text-right">$${statsDec.revenue.toLocaleString()}</td>
                    <td class="text-right">$${statsJan.revenue.toLocaleString()}</td>
                    <td class="text-right" style="color:${growth.revenue.isPositive ? 'green' : 'red'}">${growth.revenue.diff > 0 ? '+' : ''}${growth.revenue.diff.toLocaleString()}</td>
                    <td class="text-right" style="font-weight:bold; color:${growth.revenue.isPositive ? 'green' : 'red'}">${growth.revenue.pct}</td>
                </tr>
                 <tr>
                    <td>客單價 (Avg Order Value)</td>
                    <td class="text-right">$${statsDec.aov.toLocaleString()}</td>
                    <td class="text-right">$${statsJan.aov.toLocaleString()}</td>
                     <td class="text-right" style="color:${growth.aov.isPositive ? 'green' : 'red'}">${growth.aov.diff > 0 ? '+' : ''}${growth.aov.diff.toLocaleString()}</td>
                    <td class="text-right" style="font-weight:bold; color:${growth.aov.isPositive ? 'green' : 'red'}">${growth.aov.pct}</td>
                </tr>
                <tr>
                    <td>交易張數 (Total Tickets)</td>
                    <td class="text-right">${statsDec.tickets.toLocaleString()}</td>
                    <td class="text-right">${statsJan.tickets.toLocaleString()}</td>
                     <td class="text-right" style="color:${growth.tickets.isPositive ? 'green' : 'red'}">${growth.tickets.diff > 0 ? '+' : ''}${growth.tickets.diff.toLocaleString()}</td>
                    <td class="text-right" style="font-weight:bold; color:${growth.tickets.isPositive ? 'green' : 'red'}">${growth.tickets.pct}</td>
                </tr>
                <tr>
                    <td>訂單筆數 (Total Orders)</td>
                    <td class="text-right">${statsDec.orders.toLocaleString()}</td>
                    <td class="text-right">${statsJan.orders.toLocaleString()}</td>
                     <td class="text-right" style="color:${growth.orders.isPositive ? 'green' : 'red'}">${growth.orders.diff > 0 ? '+' : ''}${growth.orders.diff.toLocaleString()}</td>
                    <td class="text-right" style="font-weight:bold; color:${growth.orders.isPositive ? 'green' : 'red'}">${growth.orders.pct}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <script>
        // Data from Server
        const labels = ${JSON.stringify(days)};
        const dataDec = ${JSON.stringify(dailyDec)};
        const dataJan = ${JSON.stringify(dailyJan)};

        new Chart(document.getElementById('compChart'), {
            type: 'line',
            data: {
                labels: labels.map(d => d + '日'),
                datasets: [
                    {
                        label: '2025年12月 (Dec)',
                        data: dataDec,
                        borderColor: '#9e9e9e',
                        backgroundColor: 'rgba(158, 158, 158, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: '2026年01月 (Jan)',
                        data: dataJan,
                        borderColor: '#2196f3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: { display: true, text: '每日營收疊加比較 (Daily Revenue Comparison)' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' + context.raw.toLocaleString();
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: v => '$' + v/1000 + 'k' } }
                }
            }
        });
    </script>
</body>
</html>
        `;

        const fileName = "Qware_Sales_Comparison_2025-12_vs_2026-01.html";
        const filePath = path.join(__dirname, fileName);
        fs.writeFileSync(filePath, htmlContent);
        console.log(`Report generated: ${filePath}`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

generateReport();
