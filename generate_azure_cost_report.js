const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

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
        const collection = db.collection('AzureMonthlyCost');

        // Fetch all data sorted by YearMonth
        const docs = await collection.find({}).sort({ YearMonth: 1 }).toArray();

        // Prepare chart data
        const labels = [];
        const costA = [];
        const costD = [];
        const costE = [];
        const costTotal = [];
        const costOther = [];

        docs.forEach(doc => {
            labels.push(doc.YearMonth);
            costA.push(doc.SystemA_Cost || 0);
            costD.push(doc.SystemD_Cost || 0);
            costE.push(doc.SystemE_Cost || 0);
            costTotal.push(doc.QWARE_Ticket_TotalCost || 0);

            // Calculate other costs
            const others = (doc.PaymentPortal_Cost || 0) +
                (doc.SystemHotel_Cost || 0) +
                (doc.Common_Cost || 0) +
                (doc.PayGateway_Cost || 0) +
                (doc.iSharingGift_Cost || 0) +
                (doc.SystemCloudCard_Cost || 0);
            costOther.push(others);
        });

        // 取得最新一個月的資料作為 Highlight
        const latestDoc = docs[docs.length - 1];
        const prevDoc = docs.length > 1 ? docs[docs.length - 2] : null;

        const reportTime = new Date().toLocaleString('zh-TW');

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Azure 雲端費用分析報表</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #121212;
            --card-bg: #1e1e1e;
            --text-primary: #e0e0e0;
            --text-secondary: #a0a0a0;
            --accent-color: #0078D4; /* Azure Blue */
            --accent-secondary: #50E6FF;
            --shadow: 0 8px 16px rgba(0,0,0,0.3);
            
            --color-total: #0078D4;
            --color-a: #FF7043;
            --color-d: #42A5F5;
            --color-e: #66BB6A;
            --color-other: #AB47BC;
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
            background: linear-gradient(135deg, #0078D4, #50E6FF);
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
        .card.card-total::before { background: var(--color-total); }

        .card:hover { transform: translateY(-3px); }

        .card h3 { margin: 0 0 10px 0; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); }
        .card .value { font-size: 1.8em; font-weight: 700; color: var(--text-primary); }
        .card .sub { font-size: 0.8em; color: #888; margin-top: 5px; display: flex; justify-content: space-between; }

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
            <div class="logo-text">Azure Cost Analytics</div>
            <div class="logo-sub">Azure 雲端費用分析報表</div>
        </div>
        <div class="meta">
            資料月份: ${labels[0]} ~ ${labels[labels.length - 1]}<br>
            產生時間: ${reportTime}
        </div>
    </header>

    <div class="stats-grid">
        <div class="card card-total">
            <h3>最新月份總費用 (${latestDoc.YearMonth})</h3>
            <div class="value">$${(latestDoc.QWARE_Ticket_TotalCost || 0).toLocaleString()}</div>
            <div class="sub">
                ${prevDoc ? (() => {
                const diff = (latestDoc.QWARE_Ticket_TotalCost || 0) - (prevDoc.QWARE_Ticket_TotalCost || 0);
                const pct = ((diff / (prevDoc.QWARE_Ticket_TotalCost || 1)) * 100).toFixed(1);
                return diff >= 0 ?
                    '<span style="color:#ef5350">▲ ' + pct + '% (相較上月)</span>' :
                    '<span style="color:#66BB6A">▼ ' + Math.abs(pct) + '% (相較上月)</span>';
            })() : ''}
            </div>
        </div>
        <div class="card card-a">
            <h3>A系統費用</h3>
            <div class="value" style="color: var(--color-a);">$${(latestDoc.SystemA_Cost || 0).toLocaleString()}</div>
            <div class="sub">佔比: ${(((latestDoc.SystemA_Cost || 0) / (latestDoc.QWARE_Ticket_TotalCost || 1)) * 100).toFixed(1)}%</div>
        </div>
        <div class="card card-d">
            <h3>D系統費用</h3>
            <div class="value" style="color: var(--color-d);">$${(latestDoc.SystemD_Cost || 0).toLocaleString()}</div>
            <div class="sub">佔比: ${(((latestDoc.SystemD_Cost || 0) / (latestDoc.QWARE_Ticket_TotalCost || 1)) * 100).toFixed(1)}%</div>
        </div>
        <div class="card card-e">
            <h3>E系統費用</h3>
            <div class="value" style="color: var(--color-e);">$${(latestDoc.SystemE_Cost || 0).toLocaleString()}</div>
            <div class="sub">佔比: ${(((latestDoc.SystemE_Cost || 0) / (latestDoc.QWARE_Ticket_TotalCost || 1)) * 100).toFixed(1)}%</div>
        </div>
    </div>

    <div class="main-content">
        <div class="chart-card full-width">
            <h3>每月費用趨勢 (Monthly Cost Trend)</h3>
            <div style="height: 400px; width: 100%;">
                <canvas id="trendChart"></canvas>
            </div>
        </div>
    </div>

    <div class="main-content">
        <div class="chart-card full-width">
            <h3>系統費用堆疊圖 (Cost Breakdown)</h3>
            <div style="height: 400px; width: 100%;">
                <canvas id="stackedChart"></canvas>
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
                        <th>總費用 (Total)</th>
                        <th>A系統</th>
                        <th>D系統</th>
                        <th>E系統</th>
                        <th>其他(Other)</th>
                    </tr>
                </thead>
                <tbody>
                    ${[...docs].reverse().map((d, index) => {
                let origIndex = docs.length - 1 - index;
                let prev = origIndex > 0 ? docs[origIndex - 1] : null;

                const getChangeHTML = (currVal, prevVal) => {
                    if (!prevVal) return '';
                    const diff = currVal - prevVal;
                    const pct = ((diff / prevVal) * 100).toFixed(1);
                    // 費用增加顯示紅色，減少顯示綠色
                    if (diff > 0) return '<span style="color: #ef5350; font-size: 1em; font-weight: bold; margin-left: 5px;">▲ ' + pct + '%</span>';
                    if (diff < 0) return '<span style="color: #66BB6A; font-size: 1em; font-weight: bold; margin-left: 5px;">▼ ' + Math.abs(pct) + '%</span>';
                    return '<span style="color: #888; font-size: 1em; font-weight: bold; margin-left: 5px;">- 0%</span>';
                };

                const total = d.QWARE_Ticket_TotalCost || 0;
                const otherCost = (d.PaymentPortal_Cost || 0) + (d.SystemHotel_Cost || 0) + (d.Common_Cost || 0) + (d.PayGateway_Cost || 0) + (d.iSharingGift_Cost || 0) + (d.SystemCloudCard_Cost || 0);

                return '<tr>' +
                    '<td style="font-weight: bold; font-size: 1.1em;">' + d.YearMonth + '</td>' +
                    '<td><span style="font-size: 1.3em; font-weight: bold; color: var(--accent-color);">' + total.toLocaleString() + '</span> ' + getChangeHTML(total, prev?.QWARE_Ticket_TotalCost) + '</td>' +
                    '<td><span style="font-size: 1.1em; font-weight: bold;">' + (d.SystemA_Cost || 0).toLocaleString() + '</span> ' + getChangeHTML(d.SystemA_Cost, prev?.SystemA_Cost) + '</td>' +
                    '<td><span style="font-size: 1.1em; font-weight: bold;">' + (d.SystemD_Cost || 0).toLocaleString() + '</span> ' + getChangeHTML(d.SystemD_Cost, prev?.SystemD_Cost) + '</td>' +
                    '<td><span style="font-size: 1.1em; font-weight: bold;">' + (d.SystemE_Cost || 0).toLocaleString() + '</span> ' + getChangeHTML(d.SystemE_Cost, prev?.SystemE_Cost) + '</td>' +
                    '<td>' + otherCost.toLocaleString() + '</td>' +
                    '</tr>';
            }).join('')}
                </tbody>
            </table>
        </div>
    </div>

</div>

<script>
    const labels = ${JSON.stringify(labels)};
    const costTotal = ${JSON.stringify(costTotal)};
    const costA = ${JSON.stringify(costA)};
    const costD = ${JSON.stringify(costD)};
    const costE = ${JSON.stringify(costE)};
    const costOther = ${JSON.stringify(costOther)};
    
    // 1. 每月總費用折線圖
    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '總費用 (Total Cost)',
                    data: costTotal,
                    borderColor: '#0078D4',
                    backgroundColor: 'rgba(0, 120, 212, 0.1)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4,
                    borderWidth: 2
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
                    formatter: (value) => value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value
                }
            },
            scales: {
                x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                y: { grid: { color: '#333' }, ticks: { color: '#888', callback: v => (v>=1000 ? (v/1000) + 'k' : v) } }
            }
        }
    });

    // 2. 系統費用堆疊長條圖
    new Chart(document.getElementById('stackedChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'A系統',
                    data: costA,
                    backgroundColor: '#FF7043'
                },
                {
                    label: 'D系統',
                    data: costD,
                    backgroundColor: '#42A5F5'
                },
                {
                    label: 'E系統',
                    data: costE,
                    backgroundColor: '#66BB6A'
                },
                {
                    label: '其他費用',
                    data: costOther,
                    backgroundColor: '#AB47BC'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#ccc' } },
                datalabels: { display: false } // Disable datalabels for stacked to avoid clutter
            },
            scales: {
                x: { 
                    stacked: true,
                    grid: { color: '#333' }, 
                    ticks: { color: '#888' } 
                },
                y: { 
                    stacked: true,
                    grid: { color: '#333' }, 
                    ticks: { color: '#888', callback: v => (v>=1000 ? (v/1000) + 'k' : v) } 
                }
            }
        }
    });

</script>

</body>
</html>
        `;

        const outPath = path.join(__dirname, 'Azure_Cost_Analysis_Report.html');
        fs.writeFileSync(outPath, htmlContent, 'utf8');
        console.log(`Report generated successfully at ${outPath}`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

generateReport();
