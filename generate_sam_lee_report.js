
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

        const TARGET_NAME = '2025李聖傑 One Day直到那一天 世界巡迴演唱會 台北站';
        const TARGET_FIELD = '節目/商品名稱';

        console.log(`Fetching data for: ${TARGET_NAME}...`);
        const data = await collection.find({ [TARGET_FIELD]: TARGET_NAME }).toArray();
        console.log(`Fetched ${data.length} records.`);

        // Identify available sessions (場次) based on '演出時間/規格'
        // User requested 12/26 and 12/27 separation.
        const allSpecs = [...new Set(data.map(d => d['演出時間/規格']))].filter(Boolean);
        console.log("Unique Specs found:", allSpecs);

        // We will define sessions aliases for clarity
        const sessions = ['2025/12/26', '2025/12/27'];

        // Current Time
        const reportTime = new Date().toLocaleString('zh-TW');

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>李聖傑世界巡迴演唱會台北站 - 分場次分析報表 (A系統)</title>
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <!-- html2pdf for PDF export -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #121212;
            --card-bg: #1e1e1e;
            --text-primary: #e0e0e0;
            --text-secondary: #a0a0a0;
            --accent-color: #2196f3; /* Blue for this event */
            --accent-secondary: #64b5f6;
            --shadow: 0 8px 16px rgba(0,0,0,0.3);
            --tab-active-bg: rgba(33, 150, 243, 0.2);
            --tab-border: rgba(255, 255, 255, 0.1);
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
            background: linear-gradient(135deg, #2196f3, #64b5f6);
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

        /* Tabs Styles */
        .tabs {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
            border-bottom: 1px solid var(--tab-border);
            padding-bottom: 0.5rem;
            overflow-x: auto;
        }

        .tab-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            font-family: inherit;
            font-size: 1rem;
            font-weight: 500;
            transition: all 0.3s ease;
            white-space: nowrap;
        }

        .tab-btn:hover {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.05);
        }

        .tab-btn.active {
            color: var(--accent-color);
            background: var(--tab-active-bg);
            font-weight: 600;
            border: 1px solid var(--accent-color);
        }

        .tab-content {
            display: none;
            animation: fadeIn 0.5s ease;
        }

        .tab-content.active {
            display: block;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
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
        }
        .card:hover { border-color: var(--accent-color); transform: translateY(-3px); }

        .card h3 { margin: 0 0 10px 0; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); }
        .card .value { font-size: 1.8em; font-weight: 700; color: var(--accent-color); }
        .card .sub { font-size: 0.8em; color: #666; margin-top: 5px; }
        .text-danger { color: #ef5350 !important; }

        .main-content {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 25px;
            margin-bottom: 40px;
        }

        .chart-card {
            background: var(--card-bg);
            border-radius: 20px;
            padding: 25px;
            box-shadow: var(--shadow);
            min-height: 400px;
            position: relative;
        }
        
        .chart-card h3 { 
            margin-top: 0;
            color: var(--text-primary);
            border-left: 4px solid var(--accent-color);
            padding-left: 10px;
        }

        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.95em; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #333; }
        th { color: var(--accent-color); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        tr:hover { background-color: rgba(33, 150, 243, 0.05); }

        .export-btn {
            background: linear-gradient(135deg, #2196f3, #1976d2);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.9rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            margin-top: 10px;
        }
        .export-btn:hover {
            background: linear-gradient(135deg, #1976d2, #1565c0);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
        }
        .export-btn svg { width: 16px; height: 16px; }

        @media screen and (max-width: 900px) {
            .main-content { grid-template-columns: 1fr; }
        }
        
        @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            
            body { 
                background-color: #121212 !important;
                padding: 20px !important;
                margin: 0 !important;
            }
            
            .container { max-width: 100% !important; }
            
            .container { max-width: 100% !important; }
            
            .tabs, .export-btn, button, a[href*="report_index.html"] { display: none !important; }
            
            header {
                background: linear-gradient(to right, #2c2c2c, #1e1e1e) !important;
                margin-bottom: 20px !important;
            }
            
            .card, .chart-card {
                background: #1e1e1e !important;
                border: 1px solid #333 !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }
            
            .stats-grid {
                display: grid !important;
                grid-template-columns: repeat(3, 1fr) !important;
                gap: 15px !important;
            }
            
            .main-content {
                display: grid !important;
                grid-template-columns: 2fr 1fr !important;
                gap: 20px !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
                margin-bottom: 20px !important;
            }
            
            .chart-card {
                min-height: 300px !important;
            }
            
            canvas {
                max-width: 100% !important;
                height: auto !important;
            }
            
            table {
                width: 100% !important;
                font-size: 0.85em !important;
            }
            
            th, td {
                padding: 8px !important;
                border-bottom: 1px solid #444 !important;
            }
            
            .logo-text {
                background: linear-gradient(135deg, #2196f3, #64b5f6) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
            }
            
            @page {
                size: A3 landscape;
                margin: 0.5in;
            }
        }
    </style>
</head>
<body>

<div class="container">
    <header>
        <div>
            <div class="logo-text">Sam Lee Taipei</div>
            <div class="logo-sub">2025李聖傑 世界巡迴演唱會 台北站 - 分場次分析</div>
        </div>
        <div class="meta">
            Generated: ${reportTime}<br>
            Total Records: ${data.length.toLocaleString()}<br>
            <button class="export-btn" onclick="exportPDF()">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                匯出 PDF
            </button>
        </div>
    </header>

    <!-- Tabs Navigation -->
    <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('all')">整體銷售 (All)</button>
        ${sessions.map((s, i) => `<button class="tab-btn" onclick="switchTab('session${i}')">${s}</button>`).join('')}
    </div>

    <!-- Content Wrapper for JS Rendering -->
    <div id="dashboard-content"></div>

</div>

<script>
    const dbData = ${JSON.stringify(data)};
    const sessions = ${JSON.stringify(sessions)};

    // Function to calculate stats and generate HTML for a specific dataset
    function generateDashboard(targetSession) {
        let currentData = dbData;
        
        if (targetSession === '2025/12/26') {
             currentData = dbData.filter(d => (d['演出時間/規格'] || '').includes('2025-12-26'));
        } else if (targetSession === '2025/12/27') {
             currentData = dbData.filter(d => (d['演出時間/規格'] || '').includes('2025-12-27'));
        }

        // Filter Valid Orders
        const validOrders = currentData.filter(d => d['狀態'] === '正常');
        // Refund Data
        const refundOrders = currentData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');
        
        // Stats
        const revenue = validOrders.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
        const tickets = validOrders.length;
        const refundAmount = refundOrders.reduce((acc, cur) => acc + (cur['實退金額'] || 0), 0);
        const refundTickets = refundOrders.length;
        const refundFees = refundOrders.reduce((acc, cur) => acc + (cur['手續費'] || 0), 0);
        
        // Distinct orders
        const orderSet = new Set();
        validOrders.forEach(o => {
            if(o['訂單編號']) orderSet.add(o['訂單編號'].split('_')[0]);
        });
        const orders = orderSet.size;
        const aov = orders > 0 ? Math.round(revenue / orders) : 0;

        // Charts Data Prep
        
        // 1. Daily Trend
        const salesByDate = {};
        validOrders.forEach(o => {
            if(!o['交易時間']) return;
            const date = o['交易時間'].split(' ')[0];
            salesByDate[date] = (salesByDate[date] || 0) + (o['售價'] || 0);
        });
        const dates = Object.keys(salesByDate).sort();
        const dailyRevenues = dates.map(d => salesByDate[d]);

        // 2. Price Distribution
        const priceStats = {};
        validOrders.forEach(o => {
            const p = o['售價'] || 0;
            if(!priceStats[p]) priceStats[p] = { count: 0, revenue: 0 };
            priceStats[p].count++;
            priceStats[p].revenue += p;
        });
        const priceArray = Object.keys(priceStats).map(p => ({
            price: parseInt(p),
            ...priceStats[p]
        })).sort((a,b) => b.price - a.price);

        // 3. Payment Methods
        const paymentStats = {};
        validOrders.forEach(o => {
            const m = o['付款方式'] || 'Other';
            paymentStats[m] = (paymentStats[m] || 0) + 1;
        });
        const paymentArray = Object.keys(paymentStats).map(k => ({ method: k, count: paymentStats[k] })).sort((a,b) => b.count - a.count);

        // 4. Age
        const ageStats = {};
        validOrders.forEach(o => {
            let age = o['年齡'];
            let label = 'Unknown';
            if (typeof age === 'number') {
                if(age < 18) label = '<18';
                else if(age >= 18 && age <= 24) label = '18-24';
                else if(age >= 25 && age <= 34) label = '25-34';
                else if(age >= 35 && age <= 44) label = '35-44';
                else if(age >= 45 && age <= 54) label = '45-54';
                else if(age >= 55) label = '55+';
                else label = 'Other';
            } else if (age) {
                 const n = parseInt(age);
                 if(!isNaN(n)) {
                    if(n < 18) label = '<18';
                    else if(n >= 18 && n <= 24) label = '18-24';
                    else if(n >= 25 && n <= 34) label = '25-34';
                    else if(n >= 35 && n <= 44) label = '35-44';
                    else if(n >= 45 && n <= 54) label = '45-54';
                    else if(n >= 55) label = '55+';
                 } else {
                     label = 'Unknown';
                 }
            } else {
                 label = 'Unknown';
            }
            ageStats[label] = (ageStats[label] || 0) + 1;
        });
        const ageOrder = ['<18', '18-24', '25-34', '35-44', '45-54', '55+', 'Unknown'];
        const ageLabels = ageOrder.filter(a => ageStats[a] !== undefined);
        const ageData = ageLabels.map(a => ageStats[a]);

        // 5. Gender
        const genderStats = {};
        validOrders.forEach(o => {
            let g = o['性別'];
            if(!g || g === '-') g = '未知';
            genderStats[g] = (genderStats[g] || 0) + 1;
        });

        // 6. Sales Point Analysis
        const salesPointStats = {};
        validOrders.forEach(o => {
            const point = o['銷售點'] || 'Unknown';
            const price = o['售價'] || 0;
            if(!salesPointStats[point]) salesPointStats[point] = { orders: new Set(), tickets: 0, revenue: 0 };
            const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : 'u';
            salesPointStats[point].orders.add(orderId);
            salesPointStats[point].tickets++;
            salesPointStats[point].revenue += price;
        });

        const salesPointArray = Object.keys(salesPointStats).map(k => ({ 
            point: k, 
            orders: salesPointStats[k].orders.size,
            tickets: salesPointStats[k].tickets,
            revenue: salesPointStats[k].revenue
        })).sort((a,b) => b.revenue - a.revenue);

        // --- Generate HTML for this session ---
        return \`
            <div class="stats-grid animate-fade">
                <div class="card">
                    <h3>總營收 (Total Revenue)</h3>
                    <div class="value">$\${revenue.toLocaleString()}</div>
                    <div class="sub">Valid Orders Only</div>
                </div>
                <div class="card">
                    <h3>銷售張數 (Tickets)</h3>
                    <div class="value">\${tickets.toLocaleString()}</div>
                    <div class="sub">Total Seats</div>
                </div>
                 <div class="card">
                    <h3>客單價 (AOV)</h3>
                    <div class="value">$\${aov.toLocaleString()}</div>
                </div>
                <div class="card">
                    <h3>退票金額 (Refunds)</h3>
                    <div class="value text-danger">$\${refundAmount.toLocaleString()}</div>
                     <div class="sub">實退金額</div>
                </div>
                <div class="card">
                    <h3>退票張數 (Ref. Tix)</h3>
                    <div class="value text-danger">\${refundTickets.toLocaleString()}</div>
                </div>
                <div class="card">
                    <h3>退票手續費 (Fees)</h3>
                    <div class="value text-danger">$\${refundFees.toLocaleString()}</div>
                </div>
            </div>

            <div class="main-content">
                 <div class="chart-card">
                    <h3>年齡分佈 (Age)</h3>
                    <div style="height: 350px;"><canvas id="ageChart-\${targetSession}"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3>性別分佈 (Gender)</h3>
                     <div style="height: 350px;"><canvas id="genderChart-\${targetSession}"></canvas></div>
                </div>
            </div>

            <div class="main-content">
                <div class="chart-card">
                    <h3>每日銷售趨勢 (Sales Trend)</h3>
                    <div style="height: 350px;"><canvas id="trendChart-\${targetSession}"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3>付款方式 (Payment)</h3>
                     <table id="paymentTable-\${targetSession}">
                        <thead><tr><th>付款方式</th><th>筆數</th><th>佔比</th></tr></thead>
                        <tbody>\${paymentArray.map(p => {
                            const share = tickets ? ((p.count / tickets) * 100).toFixed(1) + '%' : '0%'; // Approximate share base
                            const totalPay = paymentArray.reduce((acc, cur) => acc + cur.count, 0);
                            const realShare = totalPay ? ((p.count / totalPay) * 100).toFixed(1) + '%' : '0%';
                            return \`<tr>
                                <td>\${p.method}</td>
                                <td>\${p.count.toLocaleString()}</td>
                                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;"><div style="width:\${realShare}; background:#4DB6AC; height:6px;"></div></div> \${realShare}</td>
                            </tr>\`;
                        }).join('')}</tbody>
                    </table>
                </div>
            </div>

            <div class="main-content">
                <div class="chart-card" style="grid-column: span 2;">
                    <h3>銷售點分析 (Sales Point)</h3>
                     <table id="salesPointTable-\${targetSession}">
                        <thead><tr><th>銷售點</th><th>筆數</th><th>張數</th><th>營收</th><th>佔比</th></tr></thead>
                        <tbody>\${salesPointArray.map(p => {
                            const share = revenue ? ((p.revenue / revenue) * 100).toFixed(1) + '%' : '0%';
                            return \`<tr>
                                <td>\${p.point}</td>
                                <td>\${p.orders.toLocaleString()}</td>
                                <td>\${p.tickets.toLocaleString()}</td>
                                <td>$\${p.revenue.toLocaleString()}</td>
                                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;"><div style="width:\${share}; background:var(--accent-color); height:6px;"></div></div> \${share}</td>
                            </tr>\`;
                        }).join('')}</tbody>
                    </table>
                </div>
            </div>

            <div class="main-content">
                <div class="chart-card" style="grid-column: span 2;">
                    <h3>各票價銷售詳情 (Sales by Price)</h3>
                    <table>
                        <thead><tr><th>票價 (Price)</th><th>銷售張數 (Qty)</th><th>營收 (Revenue)</th><th>佔比 (Share)</th></tr></thead>
                        <tbody>\${priceArray.map(p => {
                             const share = revenue ? ((p.revenue / revenue) * 100).toFixed(1) + '%' : '0%';
                             return \`<tr>
                                <td>\${p.price === 0 ? '公關/免費票' : '$' + p.price.toLocaleString()}</td>
                                <td>\${p.count.toLocaleString()}</td>
                                <td>$\${p.revenue.toLocaleString()}</td>
                                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;"><div style="width:\${share}; background:var(--accent-color); height:6px;"></div></div> \${share}</td>
                            </tr>\`;
                        }).join('')}</tbody>
                    </table>
                </div>
            </div>
        \`;
    }

    // Function to initialize charts after HTML insertion
    function initCharts(targetSession) {
        let currentData = dbData;
        if (targetSession === '2025/12/26') {
             currentData = dbData.filter(d => (d['演出時間/規格'] || '').includes('2025-12-26'));
        } else if (targetSession === '2025/12/27') {
             currentData = dbData.filter(d => (d['演出時間/規格'] || '').includes('2025-12-27'));
        }
        const validOrders = currentData.filter(d => d['狀態'] === '正常');

        // Prepare Data again for charts (Can be optimized but kept separate for clarity)
        const salesByDate = {};
        validOrders.forEach(o => {
            if(!o['交易時間']) return;
            const date = o['交易時間'].split(' ')[0];
            salesByDate[date] = (salesByDate[date] || 0) + (o['售價'] || 0);
        });
        const dates = Object.keys(salesByDate).sort();
        const dailyRevenues = dates.map(d => salesByDate[d]);

        const ageStats = {};
        validOrders.forEach(o => {
            let age = o['年齡'];
            let label = 'Unknown';
            if (typeof age === 'number') {
                if(age < 18) label = '<18';
                else if(age >= 18 && age <= 24) label = '18-24';
                else if(age >= 25 && age <= 34) label = '25-34';
                else if(age >= 35 && age <= 44) label = '35-44';
                else if(age >= 45 && age <= 54) label = '45-54';
                else if(age >= 55) label = '55+';
                else label = 'Other';
            } else if (age) {
                 const n = parseInt(age);
                 if(!isNaN(n)) {
                    if(n < 18) label = '<18';
                    else if(n >= 18 && n <= 24) label = '18-24';
                    else if(n >= 25 && n <= 34) label = '25-34';
                    else if(n >= 35 && n <= 44) label = '35-44';
                    else if(n >= 45 && n <= 54) label = '45-54';
                    else if(n >= 55) label = '55+';
                 } else {
                     label = 'Unknown';
                 }
            } else {
                 label = 'Unknown';
            }
            ageStats[label] = (ageStats[label] || 0) + 1;
        });
        const ageOrder = ['<18', '18-24', '25-34', '35-44', '45-54', '55+', 'Unknown'];
        const ageLabels = ageOrder.filter(a => ageStats[a] !== undefined);
        const ageData = ageLabels.map(a => ageStats[a]);

        const genderStats = {};
        validOrders.forEach(o => {
            let g = o['性別'];
            if(!g || g === '-') g = '未知';
            genderStats[g] = (genderStats[g] || 0) + 1;
        });

        // 1. Trend
        new Chart(document.getElementById(\`trendChart-\${targetSession}\`), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Revenue',
                    data: dailyRevenues,
                    borderColor: '#2196f3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                    y: { grid: { color: '#333' }, ticks: { color: '#888', callback: (v) => '$' + v/1000 + 'k' } }
                }
            }
        });

        // 2. Age
        new Chart(document.getElementById(\`ageChart-\${targetSession}\`), {
            type: 'bar',
            data: {
                labels: ageLabels,
                datasets: [{
                    label: '人數',
                    data: ageData,
                    backgroundColor: '#2196f3',
                    borderRadius: 4
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    datalabels: {
                        color: '#eee',
                        anchor: 'end',
                        align: 'top',
                        font: { size: 12 },
                        formatter: Math.round
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#ccc' } },
                    y: { grid: { color: '#333' }, ticks: { color: '#888' } }
                }
            }
        });

        // 3. Gender
        new Chart(document.getElementById(\`genderChart-\${targetSession}\`), {
            type: 'pie',
            data: {
                labels: Object.keys(genderStats),
                datasets: [{
                    data: Object.values(genderStats),
                    backgroundColor: ['#42A5F5', '#EC407A', '#BDBDBD'],
                    borderWidth: 0
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { position: 'bottom', labels: { color: '#ccc' } },
                    datalabels: {
                        color: 'white',
                        font: { weight: 'bold', size: 14 },
                        formatter: function(value, context) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        });
    }

    // Tab Switching Logic
    window.switchTab = function(sessionKey) {
        let target = sessionKey;
        // Map sessionKey to actual session name if needed (for session0, session1 etc)
        if(sessionKey !== 'all') {
            const index = parseInt(sessionKey.replace('session', ''));
            target = sessions[index];
        }

        // Update Buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const clickedBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => btn.getAttribute('onclick').includes(sessionKey));
        if(clickedBtn) clickedBtn.classList.add('active');

        // Render Content
        const contentDiv = document.getElementById('dashboard-content');
        
        // Use timeout to allow UI to refresh if heavy
        contentDiv.innerHTML = '<div style="text-align:center; padding:50px; color:#666;">Loading data...</div>';
        
        setTimeout(() => {
            // Generate HTML for specific session or all
            // We pass a sanitized ID for charts to avoid issues with special logic, but here we just append targetSession
            // For charting ID, we just use the unique key passed to function to avoid complex selector issues
            
            // Re-render HTML
            contentDiv.innerHTML = generateDashboard(target === 'all' ? 'all' : target);
            
            // Note: The generateDashboard returns HTML with chart IDs containing the raw session string? 
            // Better to use the safe key (session0, session1) for IDs.
            // Let's modify generateDashboard/initCharts to accept a Safe Key and a Data Filter separately if needed.
            // Simplification: We will regenerate IDs based on the passed key "sessionKey" to be safe.
            
            // FIX: Let's slightly adjust the logic to use sessionKey for DOM IDs and target for Data filtering.
            renderSafe(sessionKey, target === 'all' ? 'all' : target);

        }, 10);
    };

    function renderSafe(domKey, dataFilterValue) {
        const contentDiv = document.getElementById('dashboard-content');
        
        // 1. Generate HTML with Safe IDs
        const html = generateDashboardHTML(domKey, dataFilterValue);
        contentDiv.innerHTML = html;

        // 2. Init Charts with Safe IDs
        initChartsSafe(domKey, dataFilterValue);
    }

    function generateDashboardHTML(domKey, targetSession) {
         let currentData = dbData;
        
        if (targetSession === '2025/12/26') {
             currentData = dbData.filter(d => (d['演出時間/規格'] || '').includes('2025-12-26'));
        } else if (targetSession === '2025/12/27') {
             currentData = dbData.filter(d => (d['演出時間/規格'] || '').includes('2025-12-27'));
        }

        const validOrders = currentData.filter(d => d['狀態'] === '正常');
        const refundOrders = currentData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');
        
        const revenue = validOrders.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
        const tickets = validOrders.length;
        const refundAmount = refundOrders.reduce((acc, cur) => acc + (cur['實退金額'] || 0), 0);
        const refundTickets = refundOrders.length;
        const refundFees = refundOrders.reduce((acc, cur) => acc + (cur['手續費'] || 0), 0);
        
        const orderSet = new Set();
        validOrders.forEach(o => { if(o['訂單編號']) orderSet.add(o['訂單編號'].split('_')[0]); });
        const orders = orderSet.size;
        const aov = orders > 0 ? Math.round(revenue / orders) : 0;

        // Payment Array calculation for table
        const paymentStats = {};
        validOrders.forEach(o => {
            const m = o['付款方式'] || 'Other';
            paymentStats[m] = (paymentStats[m] || 0) + 1;
        });
        const paymentArray = Object.keys(paymentStats).map(k => ({ method: k, count: paymentStats[k] })).sort((a,b) => b.count - a.count);

        // Price Array
        const priceStats = {};
        validOrders.forEach(o => {
            const p = o['售價'] || 0;
            if(!priceStats[p]) priceStats[p] = { count: 0, revenue: 0 };
            priceStats[p].count++;
            priceStats[p].revenue += p;
        });
        const priceArray = Object.keys(priceStats).map(p => ({
            price: parseInt(p),
            ...priceStats[p]
        })).sort((a,b) => b.price - a.price);

        // Sales Point Analysis
        const salesPointStats = {};
        validOrders.forEach(o => {
            const point = o['銷售點'] || 'Unknown';
            const price = o['售價'] || 0;
            if(!salesPointStats[point]) salesPointStats[point] = { orders: new Set(), tickets: 0, revenue: 0 };
            const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : 'u';
            salesPointStats[point].orders.add(orderId);
            salesPointStats[point].tickets++;
            salesPointStats[point].revenue += price;
        });

        const salesPointArray = Object.keys(salesPointStats).map(k => ({
            point: k,
            orders: salesPointStats[k].orders.size,
            tickets: salesPointStats[k].tickets,
            revenue: salesPointStats[k].revenue
        })).sort((a,b) => b.revenue - a.revenue);


        return \`
            <div class="stats-grid animate-fade">
                <div class="card">
                    <h3>總營收 (Total Revenue)</h3>
                    <div class="value">$\${revenue.toLocaleString()}</div>
                    <div class="sub">Valid Orders Only</div>
                </div>
                <div class="card">
                    <h3>銷售張數 (Tickets)</h3>
                    <div class="value">\${tickets.toLocaleString()}</div>
                    <div class="sub">Total Seats</div>
                </div>
                 <div class="card">
                    <h3>客單價 (AOV)</h3>
                    <div class="value">$\${aov.toLocaleString()}</div>
                </div>
                <div class="card">
                    <h3>退票金額 (Refunds)</h3>
                    <div class="value text-danger">$\${refundAmount.toLocaleString()}</div>
                     <div class="sub">實退金額</div>
                </div>
                <div class="card">
                    <h3>退票張數 (Ref. Tix)</h3>
                    <div class="value text-danger">\${refundTickets.toLocaleString()}</div>
                </div>
                <div class="card">
                    <h3>退票手續費 (Fees)</h3>
                    <div class="value text-danger">$\${refundFees.toLocaleString()}</div>
                </div>
            </div>

            <div class="main-content">
                 <div class="chart-card">
                    <h3>年齡分佈 (Age)</h3>
                    <div style="height: 350px;"><canvas id="ageChart-\${domKey}"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3>性別分佈 (Gender)</h3>
                     <div style="height: 350px;"><canvas id="genderChart-\${domKey}"></canvas></div>
                </div>
            </div>

            <div class="main-content">
                <div class="chart-card">
                    <h3>每日銷售趨勢 (Sales Trend)</h3>
                    <div style="height: 350px;"><canvas id="trendChart-\${domKey}"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3>付款方式 (Payment)</h3>
                     <table id="paymentTable-\${domKey}">
                        <thead><tr><th>付款方式</th><th>筆數</th><th>佔比</th></tr></thead>
                        <tbody>\${paymentArray.map(p => {
                            const totalPay = paymentArray.reduce((acc, cur) => acc + cur.count, 0);
                            const realShare = totalPay ? ((p.count / totalPay) * 100).toFixed(1) + '%' : '0%';
                            return \`<tr>
                                <td>\${p.method}</td>
                                <td>\${p.count.toLocaleString()}</td>
                                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;"><div style="width:\${realShare}; background:#4DB6AC; height:6px;"></div></div> \${realShare}</td>
                            </tr>\`;
                        }).join('')}</tbody>
                    </table>
                </div>
            </div>

            <div class="main-content">
                <div class="chart-card" style="grid-column: span 2;">
                    <h3>銷售點分析 (Sales Point)</h3>
                     <table id="salesPointTable-\${domKey}">
                        <thead><tr><th>銷售點</th><th>筆數</th><th>張數</th><th>營收</th><th>佔比</th></tr></thead>
                        <tbody>\${salesPointArray.map(p => {
                            const share = revenue ? ((p.revenue / revenue) * 100).toFixed(1) + '%' : '0%';
                            return \`<tr>
                                <td>\${p.point}</td>
                                <td>\${p.orders.toLocaleString()}</td>
                                <td>\${p.tickets.toLocaleString()}</td>
                                <td>$\${p.revenue.toLocaleString()}</td>
                                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;"><div style="width:\${share}; background:var(--accent-color); height:6px;"></div></div> \${share}</td>
                            </tr>\`;
                        }).join('')}</tbody>
                    </table>
                </div>
            </div>

            <div class="main-content">
                <div class="chart-card" style="grid-column: span 2;">
                    <h3>各票價銷售詳情 (Sales by Price)</h3>
                    <table>
                        <thead><tr><th>票價 (Price)</th><th>銷售張數 (Qty)</th><th>營收 (Revenue)</th><th>佔比 (Share)</th></tr></thead>
                        <tbody>\${priceArray.map(p => {
                             const share = revenue ? ((p.revenue / revenue) * 100).toFixed(1) + '%' : '0%';
                             return \`<tr>
                                <td>\${p.price === 0 ? '公關/免費票' : '$' + p.price.toLocaleString()}</td>
                                <td>\${p.count.toLocaleString()}</td>
                                <td>$\${p.revenue.toLocaleString()}</td>
                                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;"><div style="width:\${share}; background:var(--accent-color); height:6px;"></div></div> \${share}</td>
                            </tr>\`;
                        }).join('')}</tbody>
                    </table>
                </div>
            </div>
        \`;
    }

    function initChartsSafe(domKey, targetSession) {
         let currentData = dbData;
        
        if (targetSession === '2025/12/26') {
             currentData = dbData.filter(d => (d['演出時間/規格'] || '').includes('2025-12-26'));
        } else if (targetSession === '2025/12/27') {
             currentData = dbData.filter(d => (d['演出時間/規格'] || '').includes('2025-12-27'));
        }
        const validOrders = currentData.filter(d => d['狀態'] === '正常');

        // Prepare Data
        const salesByDate = {};
        validOrders.forEach(o => {
            if(!o['交易時間']) return;
            const date = o['交易時間'].split(' ')[0];
            salesByDate[date] = (salesByDate[date] || 0) + (o['售價'] || 0);
        });
        const dates = Object.keys(salesByDate).sort();
        const dailyRevenues = dates.map(d => salesByDate[d]);

        const ageStats = {};
        validOrders.forEach(o => {
            let age = o['年齡'];
            let label = 'Unknown';
            if (typeof age === 'number') {
                if(age < 18) label = '<18';
                else if(age >= 18 && age <= 24) label = '18-24';
                else if(age >= 25 && age <= 34) label = '25-34';
                else if(age >= 35 && age <= 44) label = '35-44';
                else if(age >= 45 && age <= 54) label = '45-54';
                else if(age >= 55) label = '55+';
                else label = 'Other';
            } else if (age) {
                 const n = parseInt(age);
                 if(!isNaN(n)) {
                    if(n < 18) label = '<18';
                    else if(n >= 18 && n <= 24) label = '18-24';
                    else if(n >= 25 && n <= 34) label = '25-34';
                    else if(n >= 35 && n <= 44) label = '35-44';
                    else if(n >= 45 && n <= 54) label = '45-54';
                    else if(n >= 55) label = '55+';
                 } else {
                     label = 'Unknown';
                 }
            }
            ageStats[label] = (ageStats[label] || 0) + 1;
        });
        const ageOrder = ['<18', '18-24', '25-34', '35-44', '45-54', '55+', 'Unknown'];
        const ageLabels = ageOrder.filter(a => ageStats[a] !== undefined);
        const ageData = ageLabels.map(a => ageStats[a]);

        const genderStats = {};
        validOrders.forEach(o => {
            let g = o['性別'];
            if(!g || g === '-') g = '未知';
            genderStats[g] = (genderStats[g] || 0) + 1;
        });

        // 1. Trend
        new Chart(document.getElementById(\`trendChart-\${domKey}\`), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Revenue',
                    data: dailyRevenues,
                    borderColor: '#2196f3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                    y: { grid: { color: '#333' }, ticks: { color: '#888', callback: (v) => '$' + v/1000 + 'k' } }
                }
            }
        });

        // 2. Age
        new Chart(document.getElementById(\`ageChart-\${domKey}\`), {
            type: 'bar',
            data: {
                labels: ageLabels,
                datasets: [{
                    label: '人數',
                    data: ageData,
                    backgroundColor: '#2196f3',
                    borderRadius: 4
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    datalabels: {
                        color: '#eee',
                        anchor: 'end',
                        align: 'top',
                        font: { size: 12 },
                        formatter: Math.round
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#ccc' } },
                    y: { grid: { color: '#333' }, ticks: { color: '#888' } }
                }
            }
        });

        // 3. Gender
        new Chart(document.getElementById(\`genderChart-\${domKey}\`), {
            type: 'pie',
            data: {
                labels: Object.keys(genderStats),
                datasets: [{
                    data: Object.values(genderStats),
                    backgroundColor: ['#42A5F5', '#EC407A', '#BDBDBD'],
                    borderWidth: 0
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { position: 'bottom', labels: { color: '#ccc' } },
                    datalabels: {
                        color: 'white',
                        font: { weight: 'bold', size: 14 },
                        formatter: function(value, context) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        });
    }

    // Init Default
    switchTab('all');

    // PDF Export Function - Uses browser print for accurate layout
    function exportPDF() {
        // Hide tabs and export button
        const tabs = document.querySelector('.tabs');
        const exportBtn = document.querySelector('.export-btn');
        if(tabs) tabs.style.display = 'none';
        if(exportBtn) exportBtn.style.display = 'none';
        
        // Trigger browser print dialog
        setTimeout(() => {
            window.print();
            
            // Restore elements after print dialog
            setTimeout(() => {
                if(tabs) tabs.style.display = 'flex';
                if(exportBtn) exportBtn.style.display = 'inline-flex';
            }, 500);
        }, 100);
    }

</script>


<!-- Fixed PDF Button -->
<button onclick="downloadPDF()" style="
    position: fixed;
    bottom: 90px;
    right: 30px;
    background: linear-gradient(135deg, #1e88e5, #1565c0);
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(30, 136, 229, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    z-index: 1000;
" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 20px rgba(30, 136, 229, 0.5)';" 
   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(30, 136, 229, 0.4)';">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
    下載 PDF
</button>

<script>
    function downloadPDF() {
        window.print();
    }
</script>


<!-- Fixed Home Button -->
<a href="report_index.html" class="home-btn" style="
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: linear-gradient(135deg, #2196f3, #1976d2);
    color: white;
    padding: 12px 24px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(33, 150, 243, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    z-index: 1000;
" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 20px rgba(33, 150, 243, 0.5)';" 
   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(33, 150, 243, 0.4)';">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
    </svg>
    回首頁
</a>

</body>
</html>
        `;

        const fileName = 'A_SamLee_Report_2025_Taipei.html';
        const reportDir = path.join(__dirname, 'report');
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir);
        }
        const filePath = path.join(reportDir, fileName);

        fs.writeFileSync(filePath, htmlContent);
        console.log(`Report generated successfully: ${filePath}`);

    } catch (e) {
        console.error("Error generating report:", e);
    } finally {
        await client.close();
    }
}

generateReport();
