
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
        
        // Using Daily collection as the event is current
        const collection = db.collection('Qware_A_Ticket_data_Daily');

        const TARGET_NAME = '國泰世華銀行2026韋禮安「 HI WE1 韋，您好 巡迴演唱會」台北場';
        const TARGET_FIELD = '節目/商品名稱';

        console.log(`Fetching data for: ${TARGET_NAME}...`);
        const data = await collection.find({ [TARGET_FIELD]: TARGET_NAME }).toArray();
        console.log(`Fetched ${data.length} records.`);

        // Sections data - if empty, we'll handle gracefully
        const sectionData = await db.collection('Qware_A_Section_number').find({ '節目名稱': TARGET_NAME }).toArray();
        console.log(`Fetched ${sectionData.length} section records.`);

        const topEventId = 39484;
        console.log(`Fetching GA Data for ActivityID: ${topEventId}`);
        const gaSessions = await db.collection("QwareTrafficSession").find({ ActivityID: topEventId }).toArray();
        const gaReads = await db.collection("QwareTrafficGAReadTime").find({ ActivityID: topEventId }).toArray();

        console.log("Fetching Session/Pageview Data (Qware_A_Traffic_session_data)...");
        const pageViews = await db.collection("Qware_A_Traffic_session_data").find({ '節目名稱': TARGET_NAME }).toArray();

        // Map member nationality
        console.log("Fetching Member Data for Nationalities...");
        const memberIds = [...new Set(data.map(d => d['會員編號']).filter(id => id && id !== '-'))];
        const memberColl = db.collection('Qware_Member_data');
        
        // Fetch in batches if necessary, but 14k might be okay for one go
        const members = await memberColl.find({ '會員編號': { $in: memberIds } }).toArray();

        const memberNatMap = {};
        const memberCityMap = {};
        members.forEach(m => {
            if (m['會員編號']) {
                if (m['國家']) memberNatMap[m['會員編號']] = m['國家'];
                if (m['縣市別']) memberCityMap[m['會員編號']] = m['縣市別'];
            }
        });

        // Attach nationality and city to ticket data
        data.forEach(d => {
            const memberId = d['會員編號'];
            if (memberId && memberNatMap[memberId]) {
                d['國籍'] = memberNatMap[memberId];
            } else {
                d['國籍'] = '未知';
            }
            if (memberId && memberCityMap[memberId]) {
                d['縣市別'] = memberCityMap[memberId];
            } else {
                d['縣市別'] = '未知';
            }
        });

        // Current Time
        const reportTime = new Date().toLocaleString('zh-TW');

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>韋禮安「HI WE1 巡迴演唱會」台北場 - 專案分析報表</title>
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-color: #38bdf8; /* Blue Theme for WeiBird */
            --accent-secondary: #0ea5e9;
            --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            --success: #22c55e;
            --danger: #ef4444;
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
            margin-bottom: 40px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            background: linear-gradient(to right, #1e293b, #0f172a);
            padding: 40px;
            border-radius: 24px;
            box-shadow: var(--shadow);
            border-bottom: 4px solid var(--accent-color);
        }

        .logo-text {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #38bdf8, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0;
            letter-spacing: -1px;
        }
        
        .logo-sub {
            font-size: 1.1rem;
            color: var(--accent-color);
            margin-top: 8px;
            font-weight: 600;
        }

        .meta { 
            text-align: right;
            font-size: 0.95rem;
            color: var(--text-secondary);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }

        .card {
            background: var(--card-bg);
            border-radius: 20px;
            padding: 25px;
            box-shadow: var(--shadow);
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card:hover { 
            border-color: var(--accent-color); 
            transform: translateY(-5px);
            background: #243147;
        }

        .card h3 { margin: 0 0 15px 0; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-secondary); }
        .card .value { font-size: 2.2em; font-weight: 700; color: var(--accent-color); }
        .card .sub { font-size: 0.85em; color: #64748b; margin-top: 8px; }

        .show-split {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-bottom: 40px;
        }

        .main-content {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 25px;
            margin-bottom: 40px;
        }

        .demo-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-bottom: 40px;
        }

        .chart-card {
            background: var(--card-bg);
            border-radius: 24px;
            padding: 30px;
            box-shadow: var(--shadow);
            min-height: 400px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .chart-card h3 { 
            margin-top: 0;
            color: var(--text-primary);
            border-left: 5px solid var(--accent-color);
            padding-left: 15px;
            margin-bottom: 25px;
            font-size: 1.25rem;
        }

        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.95em; }
        th, td { padding: 16px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        th { color: var(--accent-color); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem; }
        tr:hover { background-color: rgba(56, 189, 248, 0.05); }
        
        .badge {
            padding: 6px 12px;
            border-radius: 6px;
            background: rgba(56, 189, 248, 0.1);
            color: var(--accent-color);
            font-size: 0.8em;
            font-weight: 600;
        }

        .text-right { text-align: right; }
        .text-success { color: var(--success) !important; }
        .text-danger { color: var(--danger) !important; }

        .progress-bar {
            background: rgba(255, 255, 255, 0.05);
            width: 100%;
            border-radius: 10px;
            overflow: hidden;
            height: 8px;
            margin-top: 8px;
        }
        .progress-fill {
            height: 100%;
            background: var(--accent-color);
            border-radius: 10px;
        }

        /* Peak Hour Table Style */
        .peak-table-container {
            width: 100%;
            overflow-x: auto;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            background: rgba(15, 23, 42, 0.5);
        }
        #minuteTable { margin-top: 0; white-space: nowrap; min-width: 100%; border: none; }
        #minuteTable thead tr { background: rgba(56, 189, 248, 0.1); }
        #minuteTable th { text-align: center; border: none; padding: 12px; }
        #minuteTable td { border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 12px; }

        @media screen and (max-width: 1100px) {
            .main-content, .demo-content, .show-split { grid-template-columns: 1fr; }
        }

        @media print {
            body { background: white !important; color: black !important; padding: 0; }
            .container { max-width: none; }
            .card, .chart-card { break-inside: avoid; border: 1px solid #ddd !important; box-shadow: none !important; color: black !important; }
            .logo-text { -webkit-text-fill-color: black; }
            header { border-bottom: 2px solid #333; background: #f8fafc !important; }
            .chart-card h3 { border-left-color: #333; }
            button, a[href*="report_index.html"] { display: none !important; }
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
</head>
<body>

<div class="container">
    <header>
        <div>
            <div class="logo-text">WeiBird HI WE1 Concert</div>
            <div class="logo-sub">國泰世華銀行2026韋禮安「 HI WE1 韋，您好 巡迴演唱會」台北場專案銷售分析</div>
            <div style="margin-top:12px; color: var(--text-secondary); font-size: 0.9em; display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> 
                Data Source: MongoDB (QwareAi / Qware_A_Ticket_data_Daily)
            </div>
        </div>
        <div class="meta">
            報表生成時間: ${reportTime}<br>
            總銷售紀錄: ${data.length.toLocaleString()} 筆
        </div>
    </header>

    <div class="stats-grid">
        <div class="card">
            <h3>總成交金額</h3>
            <div class="value" id="val-revenue">--</div>
            <div class="sub">Valid Orders (已付款)</div>
        </div>
        <div class="card">
            <h3>總銷售張數</h3>
            <div class="value" id="val-tickets">--</div>
            <div class="sub">Total Seats Sold</div>
        </div>
        <div class="card">
            <h3>平均客單價 (AOV)</h3>
            <div class="value" id="val-aov">--</div>
            <div class="sub">Per Transaction</div>
        </div>
        <div class="card">
            <h3>淨營收 (Net)</h3>
            <div class="value text-success" id="val-net-revenue">--</div>
            <div class="sub">總成交 - 已退款</div>
        </div>
        <div class="card">
            <h3>退票總額</h3>
            <div class="value text-danger" id="val-refunds">--</div>
            <div class="sub">Refunded Amount</div>
        </div>
        <div class="card">
            <h3>退票張數</h3>
            <div class="value text-danger" id="val-refund-tickets">--</div>
            <div class="sub">Total Cancellations</div>
        </div>
    </div>

    <!-- Multi-Show Comparison Cards -->
    <div class="show-split">
        <div class="chart-card" style="min-height: 200px;">
            <h3>場次 A: 2026-05-30 (Sat)</h3>
            <div style="display: flex; justify-content: space-around; align-items: center; margin-top: 20px;">
                <div style="text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">銷售張數</div>
                    <div id="show1-tickets" style="font-size: 1.8rem; font-weight: 700; color: var(--accent-color);">0</div>
                </div>
                <div style="text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">銷售金額</div>
                    <div id="show1-revenue" style="font-size: 1.8rem; font-weight: 700; color: var(--accent-color);">$0</div>
                </div>
                <div style="text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">佔比</div>
                    <div id="show1-pct" style="font-size: 1.8rem; font-weight: 700; color: #94a3b8;">0%</div>
                </div>
            </div>
        </div>
        <div class="chart-card" style="min-height: 200px;">
            <h3>場次 B: 2026-05-31 (Sun)</h3>
            <div style="display: flex; justify-content: space-around; align-items: center; margin-top: 20px;">
                <div style="text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">銷售張數</div>
                    <div id="show2-tickets" style="font-size: 1.8rem; font-weight: 700; color: #818cf8;">0</div>
                </div>
                <div style="text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">銷售金額</div>
                    <div id="show2-revenue" style="font-size: 1.8rem; font-weight: 700; color: #818cf8;">$0</div>
                </div>
                <div style="text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">佔比</div>
                    <div id="show2-pct" style="font-size: 1.8rem; font-weight: 700; color: #94a3b8;">0%</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Demographics -->
    <div class="demo-content">
        <div class="chart-card">
            <h3>性別分佈 (Gender)</h3>
            <div style="height: 350px;">
                <canvas id="genderChart"></canvas>
            </div>
        </div>
        <div class="chart-card">
            <h3>年齡分佈 (Age)</h3>
            <div style="height: 350px;">
                <canvas id="ageChart"></canvas>
            </div>
        </div>
    </div>

    <div class="demo-content">
         <div class="chart-card">
            <h3>縣市分佈 Top 10 (Geography)</h3>
            <div style="height: 350px;">
                <canvas id="cityChart"></canvas>
            </div>
        </div>
        <div class="chart-card">
            <h3>付款方式 (Payment)</h3>
             <table id="paymentTable">
                <thead>
                    <tr>
                        <th>付款方式</th>
                        <th class="text-right">成交量</th>
                        <th class="text-right">佔比</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    </div>

    <!-- Trend Analysis -->
    <div class="main-content">
        <div class="chart-card">
            <h3>銷售趨勢 (Sales Trend)</h3>
            <div style="height: 300px;">
                <canvas id="trendChart"></canvas>
            </div>
        </div>
        <div class="chart-card">
            <h3>國籍統計 Top 5</h3>
            <table id="natTable">
                <thead>
                    <tr>
                        <th>國籍</th>
                        <th class="text-right">張數</th>
                        <th class="text-right">比例</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    </div>

    <!-- Price Point Table -->
    <div class="main-content">
        <div class="chart-card" style="grid-column: span 2;">
            <h3>各票價銷售概況 (Sales by Price)</h3>
            <table id="priceTable">
                <thead>
                    <tr>
                        <th>票價</th>
                        <th class="text-right">銷售張數</th>
                        <th class="text-right">總成交金額</th>
                        <th>銷售進度</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    </div>

    <!-- Peak Hour Analysis -->
    <div class="main-content">
        <div class="chart-card" style="grid-column: span 2;">
            <h3>開賣尖峰時段分析 (Peak Hour: 12:00 - 13:00)</h3>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">檢視開賣第一小時內的系統請求與成交動態。</p>
            <div class="peak-table-container">
                <table id="minuteTable">
                    <thead>
                        <tr>
                            <th>時間</th>
                            <th class="text-right">排隊人數 (D)</th>
                            <th class="text-right">搶票人數 (A)</th>
                            <th class="text-right">Session</th>
                            <th class="text-right">新增訂單</th>
                            <th class="text-right">累計成交</th>
                            <th class="text-right">信用卡</th>
                            <th class="text-right">ATM</th>
                            <th class="text-right">轉換率 (Est.)</th>
                        </tr>
                    </thead>
                    <tbody style="text-align: right;"></tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Qualitative Insights -->
    <div class="main-content">
        <div class="chart-card" style="grid-column: span 2; border-left-color: var(--success);">
            <h3>💡 銷售數據洞察 (Insights)</h3>
            <div id="insightContainer" style="line-height: 1.8; color: #cbd5e1;">
                <!-- Dynamically populated -->
            </div>
        </div>
    </div>
</div>

<script>
    const dbData = ${JSON.stringify(data)};
    const gaSessions = ${JSON.stringify(gaSessions)};
    const gaReads = ${JSON.stringify(gaReads)};
    const pageViews = ${JSON.stringify(pageViews)};

    function init() {
        const validOrders = dbData.filter(d => d['狀態'] === '正常');
        const refundOrders = dbData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');
        
        const revenue = validOrders.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
        const tickets = validOrders.length;
        const refundAmount = refundOrders.reduce((acc, cur) => acc + (cur['實退金額'] || 0), 0);
        const refundTickets = refundOrders.length;
        
        const orderSet = new Set();
        validOrders.forEach(o => {
            if(o['訂單編號']) orderSet.add(o['訂單編號'].split('_')[0]);
        });
        const orderCount = orderSet.size;
        const aov = orderCount > 0 ? Math.round(revenue / orderCount) : 0;
        
        // Update Stats UI
        document.getElementById('val-revenue').innerText = '$' + revenue.toLocaleString();
        document.getElementById('val-tickets').innerText = tickets.toLocaleString();
        document.getElementById('val-aov').innerText = '$' + aov.toLocaleString();
        document.getElementById('val-net-revenue').innerText = '$' + (revenue - refundAmount).toLocaleString();
        document.getElementById('val-refunds').innerText = '$' + refundAmount.toLocaleString();
        document.getElementById('val-refund-tickets').innerText = refundTickets.toLocaleString();

        // Show splitting
        const show1Data = validOrders.filter(d => d['演出時間/規格'] && d['演出時間/規格'].includes('2026-05-30'));
        const show2Data = validOrders.filter(d => d['演出時間/規格'] && d['演出時間/規格'].includes('2026-05-31'));
        
        const s1Rev = show1Data.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
        const s2Rev = show2Data.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
        
        document.getElementById('show1-tickets').innerText = show1Data.length.toLocaleString();
        document.getElementById('show1-revenue').innerText = '$' + s1Rev.toLocaleString();
        document.getElementById('show1-pct').innerText = tickets > 0 ? Math.round((show1Data.length / tickets) * 100) + '%' : '0%';
        
        document.getElementById('show2-tickets').innerText = show2Data.length.toLocaleString();
        document.getElementById('show2-revenue').innerText = '$' + s2Rev.toLocaleString();
        document.getElementById('show2-pct').innerText = tickets > 0 ? Math.round((show2Data.length / tickets) * 100) + '%' : '0%';

        // Chart 1: Gender
        const genderStats = {};
        validOrders.forEach(o => {
            const g = o['性別'] || '未知';
            if (g !== '未知' && g !== '-') genderStats[g] = (genderStats[g] || 0) + 1;
        });
        new Chart(document.getElementById('genderChart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(genderStats),
                datasets: [{
                    data: Object.values(genderStats),
                    backgroundColor: ['#38bdf8', '#fb7185', '#94a3b8'],
                    borderWidth: 0
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20 } },
                    datalabels: {
                        color: 'white', font: { weight: 'bold' },
                        formatter: (val, ctx) => {
                            const sum = ctx.chart.data.datasets[0].data.reduce((a,b) => a+b, 0);
                            return Math.round(val/sum*100) + '%';
                        }
                    }
                }
            }
        });

        // Chart 2: Age
        const ageStats = {};
        validOrders.forEach(o => {
            const age = parseInt(o['年齡']);
            let label = '未知';
            if (!isNaN(age)) {
                if (age < 20) label = '< 20';
                else if (age <= 29) label = '20-29';
                else if (age <= 39) label = '30-39';
                else if (age <= 49) label = '40-49';
                else label = '50+';
            }
            ageStats[label] = (ageStats[label] || 0) + 1;
        });
        const ageLabels = ['< 20', '20-29', '30-39', '40-49', '50+', '未知'];
        new Chart(document.getElementById('ageChart'), {
            type: 'bar',
            data: {
                labels: ageLabels.filter(l => ageStats[l]),
                datasets: [{
                    data: ageLabels.filter(l => ageStats[l]).map(l => ageStats[l]),
                    backgroundColor: '#38bdf8',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });

        // Trend Chart
        const trend = {};
        validOrders.forEach(o => {
            const date = o['交易時間'] ? o['交易時間'].split(' ')[0] : 'Unknown';
            trend[date] = (trend[date] || 0) + 1;
        });
        const sortedDates = Object.keys(trend).sort();
        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: [{
                    label: '張數',
                    data: sortedDates.map(d => trend[d]),
                    borderColor: '#38bdf8',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(56, 189, 248, 0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });

        // Payment Table
        const payStats = {};
        validOrders.forEach(o => { payStats[o['付款方式'] || '其他'] = (payStats[o['付款方式'] || '其他'] || 0) + 1; });
        const payBody = document.querySelector('#paymentTable tbody');
        Object.entries(payStats).sort((a,b) => b[1] - a[1]).forEach(([k, v]) => {
            const tr = document.createElement('tr');
            const pct = Math.round(v / tickets * 100) + '%';
            tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${v.toLocaleString()}</td><td class="text-right">\${pct}</td>\`;
            payBody.appendChild(tr);
        });

        // Nationality Table
        const natStats = {};
        validOrders.forEach(o => { natStats[o['國籍'] || '未知'] = (natStats[o['國籍'] || '未知'] || 0) + 1; });
        const natBody = document.querySelector('#natTable tbody');
        Object.entries(natStats).sort((a,b) => b[1] - a[1]).slice(0, 5).forEach(([k, v]) => {
            const tr = document.createElement('tr');
            const pct = Math.round(v / tickets * 100) + '%';
            tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${v.toLocaleString()}</td><td class="text-right">\${pct}</td>\`;
            natBody.appendChild(tr);
        });

        // Price Table
        const priceStats = {};
        validOrders.forEach(o => {
            const p = o['售價'] || 0;
            if(!priceStats[p]) priceStats[p] = { count: 0, revenue: 0 };
            priceStats[p].count++;
            priceStats[p].revenue += p;
        });
        const priceBody = document.querySelector('#priceTable tbody');
        Object.entries(priceStats).sort((a,b) => b[0] - a[0]).forEach(([p, s]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
                <td>$\${parseInt(p).toLocaleString()}</td>
                <td class="text-right">\${s.count.toLocaleString()}</td>
                <td class="text-right">$\${s.revenue.toLocaleString()}</td>
                <td><div class="progress-bar"><div class="progress-fill" style="width: 100%"></div></div></td>
            \`;
            priceBody.appendChild(tr);
        });

        // Minute Analysis (Simplified for template)
        // Assume peak hour 12:00 - 13:00 on the first sales day
        const minuteStats = {};
        // Find most frequent sales hour as peak
        const hours = {};
        validOrders.forEach(o => { if(o['交易時間']) { const h = o['交易時間'].split(' ')[1].split(':')[0]; hours[h] = (hours[h]||0)+1; } });
        const peakHour = Object.entries(hours).sort((a,b) => b[1]-a[1])[0][0];

        validOrders.forEach(o => {
            if(o['交易時間']) {
                const parts = o['交易時間'].split(' ')[1].split(':');
                if(parts[0] === peakHour) {
                    const m = parts[0] + ":" + parts[1];
                    if(!minuteStats[m]) minuteStats[m] = { tickets: 0, credit: 0, atm: 0 };
                    minuteStats[m].tickets++;
                    if(o['付款方式'] && o['付款方式'].includes('信用卡')) minuteStats[m].credit++;
                    else if(o['付款方式'] && o['付款方式'].includes('ATM')) minuteStats[m].atm++;
                }
            }
        });

        const minBody = document.querySelector('#minuteTable tbody');
        let cum = 0;
        Object.keys(minuteStats).sort().forEach(m => {
            const s = minuteStats[m];
            cum += s.tickets;
            const tr = document.createElement('tr');
            tr.innerHTML = \`
                <td>\${m}</td>
                <td class="text-right">--</td>
                <td class="text-right">--</td>
                <td class="text-right">--</td>
                <td class="text-right">\${s.tickets}</td>
                <td class="text-right">\${cum}</td>
                <td class="text-right">\${s.credit}</td>
                <td class="text-right">\${s.atm}</td>
                <td class="text-right">--</td>
            \`;
            minBody.appendChild(tr);
        });

        // Insights
        const insightDiv = document.getElementById('insightContainer');
        const mainShow = show1Data.length >= show2Data.length ? '第一場 (5/30)' : '第二場 (5/31)';
        const mainPrice = Object.entries(priceStats).sort((a,b) => b[1].count - a[1].count)[0][0];
        const ageGroup = Object.entries(ageStats).sort((a,b) => b[1] - a[1])[0][0];

        insightDiv.innerHTML = \`
            <ul style="padding-left: 20px;">
                <li><strong>場次表現</strong>：目前銷售重心集中於 <strong>\${mainShow}</strong>，佔整體銷量約 \${Math.round(Math.max(show1Data.length, show2Data.length)/tickets*100)}%。</li>
                <li><strong>熱門票價</strong>：價格 <strong>$\${parseInt(mainPrice).toLocaleString()}</strong> 為最受歡迎的區位，顯示該價位具備極高市場吸引力。</li>
                <li><strong>主力客群</strong>：年齡層以 <strong>\${ageGroup}</strong> 為絕對主力，性別比例以 <strong>\${Object.entries(genderStats).sort((a,b) => b[1]-a[1])[0][0]}性</strong> 居多。</li>
                <li><strong>金流趨向</strong>：超過 \${Math.round(Object.values(payStats).sort((a,b) => b-a)[0]/tickets*100)}% 的用戶選擇 <strong>\${Object.entries(payStats).sort((a,b) => b[1]-a[1])[0][0]}</strong>，建議金流通道需維持高穩定性。</li>
            </ul>
        \`;
    }

    init();
</script>

<!-- PDF/HOME BUTTONS FIXED -->
<div style="position: fixed; bottom: 30px; right: 30px; display: flex; flex-direction: column; gap: 10px; z-index: 1000;">
    <button onclick="window.print()" style="background: var(--accent-color); color: #121212; border: none; padding: 12px 24px; border-radius: 50px; cursor: pointer; font-weight: 700; box-shadow: 0 4px 15px rgba(56, 189, 248, 0.4);">
        下載 PDF
    </button>
    <a href="report_index.html" style="background: #e2e8f0; color: #121212; padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: 700; text-align: center;">
        回報表首頁
    </a>
</div>

</body>
</html>
        `;

        const fileName = 'A_WeiBird_Report_2026.html';
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, htmlContent);
        console.log(`Report generated successfully: ${filePath}`);

    } catch (e) {
        console.error("Error generating report:", e);
    } finally {
        await client.close();
    }
}

generateReport();
