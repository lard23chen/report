
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

        const TARGET_NAME = /deca joins 2026 world tour/i;
        const TARGET_FIELD = '節目/商品名稱';

        console.log(`Fetching data for: ${TARGET_NAME}...`);
        const data = await collection.find({ [TARGET_FIELD]: TARGET_NAME }).toArray();
        console.log(`Fetched ${data.length} records.`);

        // Current Time
        const reportTime = new Date().toLocaleString('zh-TW');

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>deca joins 2026 world tour - 專案分析報表 (A系統)</title>
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #121212;
            --card-bg: #1e1e1e;
            --text-primary: #e0e0e0;
            --text-secondary: #a0a0a0;
            --accent-color: #4DB6AC; /* Teal */
            --accent-secondary: #80cbc4;
            --shadow: 0 8px 16px rgba(0,0,0,0.3);
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
            background: linear-gradient(to right, #2c2c2c, #1e1e1e);
            padding: 30px;
            border-radius: 20px;
            box-shadow: var(--shadow);
            border-bottom: 2px solid var(--accent-color);
        }

        .logo-text {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #4DB6AC, #26A69A);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0;
            letter-spacing: -1px;
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
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }

        .card {
            background: var(--card-bg);
            border-radius: 16px;
            padding: 25px;
            box-shadow: var(--shadow);
            border: 1px solid #333;
            transition: transform 0.2s;
        }
        .card:hover { border-color: var(--accent-color); transform: translateY(-3px); }

        .card h3 { margin: 0 0 15px 0; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); }
        .card .value { font-size: 2.2em; font-weight: 700; color: var(--accent-color); }
        .card .sub { font-size: 0.85em; color: #666; margin-top: 8px; }

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
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid #333; }
        th { color: var(--accent-color); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        tr:hover { background-color: rgba(255, 215, 0, 0.05); }
        
        .badge {
            padding: 5px 10px;
            border-radius: 4px;
            background: #333;
            color: #fff;
            font-size: 0.8em;
        }

        .text-right { text-align: right; }

        @media screen and (max-width: 900px) {
            .main-content { grid-template-columns: 1fr; }
        }

        /* Print Styles */
        @media print {
            @page { size: landscape; margin: 5mm; }
            body { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
                background-color: #121212 !important; 
                color: #e0e0e0 !important; 
                margin: 0;
                padding: 10px;
            }
            .container { width: 100%; max-width: none; margin: 0; padding: 0; }
            .card, .chart-card { 
                break-inside: avoid; 
                page-break-inside: avoid; 
                box-shadow: none; 
                border: 1px solid #333;
                background-color: #1e1e1e !important;
                margin-bottom: 20px;
            }
            header { background: #1e1e1e !important; box-shadow: none; border-bottom: 2px solid var(--accent-color); }
            /* Hide Buttons */
            button, a[href*="report_index.html"] { display: none !important; }
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
</head>
<body>

<div class="container">
    <header>
        <div>
            <div class="logo-text">DECA JOINS 2026</div>
            <div class="logo-sub">world tour － 在這裡停一下 - 專案銷售分析</div>
        </div>
        <div class="meta">
            Generated: ${reportTime}<br>
            Total Records: ${data.length.toLocaleString()}
        </div>
    </header>

    <div class="stats-grid">
        <div class="card">
            <h3>總營收 (Total Revenue)</h3>
            <div class="value" id="val-revenue">--</div>
            <div class="sub">Valid Orders Only</div>
        </div>
        <div class="card">
            <h3>銷售張數 (Tickets Sold)</h3>
            <div class="value" id="val-tickets">--</div>
            <div class="sub">Total Seats</div>
        </div>
        <div class="card">
            <h3>客單價 (AOV)</h3>
            <div class="value" id="val-aov">--</div>
        </div>
        <div class="card">
            <h3>退票金額 (Refunds)</h3>
            <div class="value text-danger" id="val-refunds" style="color: #ef5350;">--</div>
            <div class="sub">實退金額 (Refunded Amount)</div>
        </div>
        <div class="card">
            <h3>退票張數 (Refunded Tickets)</h3>
            <div class="value text-danger" id="val-refund-tickets" style="color: #ef5350;">--</div>
        </div>
        <div class="card">
            <h3>退票手續費 (Refund Fees)</h3>
            <div class="value text-danger" id="val-refund-fees" style="color: #ef5350;">--</div>
        </div>
    </div>

    <!-- Demographics -->
    <div class="main-content">
        <!-- Age Distribution -->
        <div class="chart-card">
            <h3>年齡分佈 (Age Distribution)</h3>
            <div style="height: 350px;">
                <canvas id="ageChart"></canvas>
            </div>
        </div>

        <!-- Gender Distribution -->
        <div class="chart-card">
            <h3>性別分佈 (Gender Distribution)</h3>
             <div style="height: 350px;">
                <canvas id="genderChart"></canvas>
            </div>
        </div>
    </div>

    <!-- Main Trend & Payment Analysis -->
    <div class="main-content">
        <!-- Main Trend Chart -->
        <div class="chart-card">
            <h3>每日銷售趨勢 (Sales Trend)</h3>
            <div style="height: 350px;">
                <canvas id="trendChart"></canvas>
            </div>
        </div>
        
        <!-- Payment Methods Table -->
        <div class="chart-card">
            <h3>付款方式 (Payment Methods)</h3>
             <table id="paymentTable">
                <thead>
                    <tr>
                        <th>付款方式</th>
                        <th>筆數</th>
                        <th>佔比</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    </div>

    <!-- Detailed Price Table (Full Width) -->
    <div class="main-content">
        <div class="chart-card" style="grid-column: span 2;">
            <h3>各票價銷售詳情 (Sales by Price)</h3>
            <table id="priceTable">
                <thead>
                    <tr>
                        <th>票價 (Price)</th>
                        <th>銷售張數 (Qty)</th>
                        <th>營收 (Revenue)</th>
                        <th>佔比 (Share)</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    </div>

    <!-- Sales Point Table (Full Width) -->
    <div class="main-content">
        <div class="chart-card" style="grid-column: span 2;">
            <h3>各銷售點分析 (Sales by Point)</h3>
             <table id="salesPointTable">
                <thead>
                    <tr>
                        <th>銷售點 (Point)</th>
                        <th>筆數 (Orders)</th>
                        <th>張數 (Tickets)</th>
                        <th>營收 (Revenue)</th>
                        <th>佔比 (Share)</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    </div>

    <!-- Minute-by-Minute Table (11:28 - 12:30) -->
    <div class="main-content">
        <div class="chart-card" style="grid-column: span 2;">
            <h3 style="border-left-color: #70ad47;">尖峰時段銷售狀況 (Peak Hour 11:58 - 12:30)</h3>
            <div style="width: 100%; overflow-x: auto; border: 1px solid #333; border-radius: 8px;">
                <table id="minuteTable" style="margin-top: 0; white-space: nowrap; min-width: 100%;">
                    <thead>
                        <tr style="background-color: #70ad47; color: white;">
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center;">時間</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center; background-color:#5a9bd5;">每分鐘D<br>(排隊)</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center; background-color:#5a9bd5;">每分鐘A<br>(搶票)</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center; background-color:#5a9bd5;">Session<br>(連線)</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center;">booking數</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center;">booking累加</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center;">訂單張數</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center;">訂單累加</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center;">刷卡張數</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center;">刷卡累加</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center;">ATM張數</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center;">ATM累加</th>
                            <th style="color: white !important; border-bottom: 1px solid #548235; text-align: center;">銷售率</th>
                        </tr>
                    </thead>
                    <tbody style="text-align: right;"></tbody>
                </table>
            </div>
        </div>
    </div>

    
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

</div>

<script>
    const dbData = ${JSON.stringify(data)};

    function init() {
        // Filter Valid Orders
        const validOrders = dbData.filter(d => d['狀態'] === '正常');
        // Refund Data
        const refundOrders = dbData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');
        
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

        // Update Stats UI
        document.getElementById('val-revenue').innerText = '$' + revenue.toLocaleString();
        document.getElementById('val-tickets').innerText = tickets.toLocaleString();
        document.getElementById('val-aov').innerText = '$' + aov.toLocaleString();
        document.getElementById('val-refunds').innerText = '$' + refundAmount.toLocaleString();
        document.getElementById('val-refund-tickets').innerText = refundTickets.toLocaleString();
        document.getElementById('val-refund-fees').innerText = '$' + refundFees.toLocaleString();

        // --- Data Processing for Charts ---
        
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

        // 4. Age Distribution
        const ageStats = {};
        validOrders.forEach(o => {
            let age = o['年齡'];
            let label = 'Unknown';
            if (typeof age === 'number' && age > 0) {
                if(age < 18) label = '<18';
                else if(age >= 18 && age <= 24) label = '18-24';
                else if(age >= 25 && age <= 34) label = '25-34';
                else if(age >= 35 && age <= 44) label = '35-44';
                else if(age >= 45 && age <= 54) label = '45-54';
                else if(age >= 55) label = '55+';
            } else if (age && typeof age === 'string') {
                 const n = parseInt(age);
                 if(!isNaN(n) && n > 0) {
                    if(n < 18) label = '<18';
                    else if(n >= 18 && n <= 24) label = '18-24';
                    else if(n >= 25 && n <= 34) label = '25-34';
                    else if(n >= 35 && n <= 44) label = '35-44';
                    else if(n >= 45 && n <= 54) label = '45-54';
                    else if(n >= 55) label = '55+';
                 }
            }
            ageStats[label] = (ageStats[label] || 0) + 1;
        });

        const ageOrder = ['<18', '18-24', '25-34', '35-44', '45-54', '55+', 'Unknown'];
        const ageLabels = ageOrder.filter(a => ageStats[a] !== undefined);
        const ageData = ageLabels.map(a => ageStats[a]);

        // 5. Gender Distribution
        const genderStats = {};
        validOrders.forEach(o => {
            let g = o['性別'];
            if(!g || g === '-') g = '未知';
            genderStats[g] = (genderStats[g] || 0) + 1;
        });

        // --- Render Charts ---

        // Trend Chart
        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Revenue',
                    data: dailyRevenues,
                    borderColor: '#4DB6AC',
                    backgroundColor: 'rgba(77, 182, 172, 0.1)',
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

        // Age Chart (Bar)
        new Chart(document.getElementById('ageChart'), {
            type: 'bar',
            data: {
                labels: ageLabels,
                datasets: [{
                    label: '人數',
                    data: ageData,
                    backgroundColor: '#4DB6AC',
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

        // Gender Chart (Pie)
        new Chart(document.getElementById('genderChart'), {
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

        // Render Price Table
        const tbody = document.querySelector('#priceTable tbody');
        priceArray.forEach(p => {
            const tr = document.createElement('tr');
            const share = revenue ? ((p.revenue / revenue) * 100).toFixed(1) + '%' : '0%';
            tr.innerHTML = \`
                <td>\${p.price === 0 ? '公關/免費票' : '$' + p.price.toLocaleString()}</td>
                <td>\${p.count.toLocaleString()}</td>
                <td>$\${p.revenue.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:\${share}; background:var(--accent-color); height:6px;"></div>
                </div> \${share}</td>
            \`;
            tbody.appendChild(tr);
        });
        
        // Render Payment Table
        const payBody = document.querySelector('#paymentTable tbody');
        const totalPay = paymentArray.reduce((acc, cur) => acc + cur.count, 0);
        paymentArray.forEach(p => {
            const tr = document.createElement('tr');
            const share = totalPay ? ((p.count / totalPay) * 100).toFixed(1) + '%' : '0%';
            tr.innerHTML = \`
                <td>\${p.method}</td>
                <td>\${p.count.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:\${share}; background:#4DB6AC; height:6px;"></div>
                </div> \${share}</td>
            \`;
            payBody.appendChild(tr);
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

        const spTbody = document.querySelector('#salesPointTable tbody');
        salesPointArray.forEach(p => {
             const share = revenue ? ((p.revenue / revenue) * 100).toFixed(1) + '%' : '0%';
             const tr = document.createElement('tr');
             tr.innerHTML = \`
                <td>\${p.point}</td>
                <td>\${p.orders.toLocaleString()}</td>
                <td>\${p.tickets.toLocaleString()}</td>
                <td>$\${p.revenue.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:\${share}; background:var(--accent-color); height:6px;"></div>
                </div> \${share}</td>
             \`;
             spTbody.appendChild(tr);
        });

        // 7. Peak Hour Analysis (11:28 - 12:30)
        let totalValidTicketsForRate = tickets > 0 ? tickets : 1; 
        const minuteStats = {};
        for(let h = 11; h <= 12; h++) {
            for(let m = 0; m < 60; m++) {
                if(h === 11 && m < 58) continue;
                if(h === 12 && m > 30) continue;
                const minStr = (h < 10 ? '0'+h : h) + ':' + (m < 10 ? '0'+m : m);
                minuteStats[minStr] = { 
                    bookings: new Set(),
                    tickets: 0,
                    creditTickets: 0,
                    atmTickets: 0,
                    activeDMin: 0,
                    activeAMin: 0,
                    sessionCount: 0
                };
            }
        }

        // DbData includes all orders (for bookings) 
        dbData.forEach(o => {
            if(!o['交易時間']) return;
            const timePart = o['交易時間'].split(' ')[1];
            if(!timePart) return;
            const hm = timePart.substring(0, 5); // HH:mm
            if(minuteStats[hm]) {
                const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : Math.random().toString();
                minuteStats[hm].bookings.add(orderId);
            }
        });

        // ValidOrders (for tickets and revenue)
        validOrders.forEach(o => {
            if(!o['交易時間']) return;
            const timePart = o['交易時間'].split(' ')[1];
            if(!timePart) return;
            const hm = timePart.substring(0, 5);
            if(minuteStats[hm]) {
                const method = o['付款方式'] || '';
                minuteStats[hm].tickets += 1;
                
                if(method.includes('信用卡') || method.includes('Credit')) {
                    minuteStats[hm].creditTickets += 1;
                } else if (method.includes('ATM')) {
                    minuteStats[hm].atmTickets += 1;
                }
            }
        });

        const minBody = document.querySelector('#minuteTable tbody');
        let cumB = 0, cumT = 0, cumC = 0, cumA = 0;

        Object.keys(minuteStats).sort().forEach(hm => {
            const stat = minuteStats[hm];
            const b = stat.bookings.size;
            const t = stat.tickets;
            const c = stat.creditTickets;
            const a = stat.atmTickets;

            cumB += b;
            cumT += t;
            cumC += c;
            cumA += a;

            const rate = Math.round((cumT / totalValidTicketsForRate) * 100) + '%';
            
            const tr = document.createElement('tr');
            tr.innerHTML = \`
                <td style="text-align: center; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary);">\${hm}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: #f59e0b; font-weight: 600;">\${stat.activeDMin.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: #10b981; font-weight: 600;">\${stat.activeAMin.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: #3b82f6; font-weight: 600;">\${stat.sessionCount.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary);">\${b.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary); font-weight: 600;">\${cumB.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary);">\${t.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary); font-weight: 600;">\${cumT.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary);">\${c.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary); font-weight: 600;">\${cumC.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary);">\${a.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary); font-weight: 600;">\${cumA.toLocaleString()}</td>
                <td style="text-align: center; border-bottom: 1px solid #444; color: #4DB6AC; font-weight: 600;">\${rate}</td>
            \`;
            minBody.appendChild(tr);
        });

        // 8. Sessions Analysis
        const sessionStats = {};
        validOrders.forEach(o => {
            const session = o['場次名稱'] || 'Unknown';
            const price = o['售價'] || 0;
            if(!sessionStats[session]) sessionStats[session] = { orders: new Set(), tickets: 0, revenue: 0 };
            const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : 'u';
            sessionStats[session].orders.add(orderId);
            sessionStats[session].tickets++;
            sessionStats[session].revenue += price;
        });

        const sessionArray = Object.keys(sessionStats).map(k => ({
            session: k,
            orders: sessionStats[k].orders.size,
            tickets: sessionStats[k].tickets,
            revenue: sessionStats[k].revenue
        })).sort((a,b) => b.revenue - a.revenue);

        const sessTbody = document.querySelector('#sessionTable tbody');
        sessionArray.forEach(s => {
            const share = revenue ? ((s.revenue / revenue) * 100).toFixed(1) + '%' : '0%';
            const sessAov = s.orders > 0 ? Math.round(s.revenue / s.orders) : 0;
            const tr = document.createElement('tr');
            tr.innerHTML = \`
                <td>\${s.session}</td>
                <td class="text-right">\${s.orders.toLocaleString()}</td>
                <td class="text-right">\${s.tickets.toLocaleString()}</td>
                <td class="text-right">$\${s.revenue.toLocaleString()}</td>
                <td class="text-right">$\${sessAov.toLocaleString()}</td>
                <td class="text-right"><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:\${share}; background:#AB47BC; height:6px;"></div>
                </div> \${share}</td>
            \`;
            sessTbody.appendChild(tr);
        });
    }

    init();
<\/script>


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
<\/script>


<!-- Fixed Home Button -->
<a href="report_index.html" style="
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: linear-gradient(135deg, #4DB6AC, #26A69A);
    color: #121212;
    padding: 12px 24px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(38, 166, 154, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    z-index: 1000;
" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 20px rgba(38, 166, 154, 0.5)';" 
   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(38, 166, 154, 0.4)';">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
    </svg>
    回首頁
</a>

\n<!-- Data Source Footer -->\n<div style="text-align:center; padding: 20px; color: #888; font-size: 0.9em; border-top: 1px solid rgba(0,0,0,0.1); margin-top: 40px; font-family: sans-serif;">\n    Data Source: System Data Excerpts\n</div>\n</body>
</html>
        `;

        const fileName = 'A_DecaJoins_Report_2026-02.html';
        const filePath = path.join(__dirname, 'report', fileName);

        fs.writeFileSync(filePath, htmlContent);
        console.log(`Report generated successfully: ${filePath}`);

        const indexHtmlPath = path.join(__dirname, 'report', 'report_index.html');
        if (fs.existsSync(indexHtmlPath)) {
            let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
            if (!indexHtml.includes(fileName)) {
                const injectContent = `
                <div class="card">
                    <div class="card-icon icon-comparison">🎤</div>
                    <div class="card-content">
                        <h3>deca joins 2026 world tour (A系統)</h3>
                        <p>專案銷售數據分析，包含客單價、年齡性別分佈與各場次(台北/台中/高雄)表現分析。</p>
                    </div>
                    <div class="card-meta">
                        <span class="badge">Event</span>
                        <a href="${fileName}" class="btn-link">查看報表
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </a>
                    </div>
                </div>`;
                indexHtml = indexHtml.replace(/<div class="grid" id="tab4-grid">/, '<div class="grid" id="tab4-grid">' + injectContent);
                indexHtml = indexHtml.replace(/<div style="grid-column: 1\/-1; text-align: center; color: var\(--text-secondary\); padding: 2rem;">\s*暫無專案報表.*?<\/div>/, '');
                fs.writeFileSync(indexHtmlPath, indexHtml);
                console.log("Updated report_index.html");
            }
        }

        const rootIndexHtmlPath = path.join(__dirname, 'report_index.html');
        if (fs.existsSync(rootIndexHtmlPath)) {
            let indexHtml = fs.readFileSync(rootIndexHtmlPath, 'utf8');
            if (!indexHtml.includes(fileName)) {
                const injectContent = `
                <div class="card">
                    <div class="card-icon icon-comparison">🎤</div>
                    <div class="card-content">
                        <h3>deca joins 2026 world tour (A系統)</h3>
                        <p>專案銷售數據分析，包含客單價、年齡性別分佈與各場次(台北/台中/高雄)表現分析。</p>
                    </div>
                    <div class="card-meta">
                        <span class="badge">Event</span>
                        <a href="report/${fileName}" class="btn-link">查看報表
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </a>
                    </div>
                </div>`;
                indexHtml = indexHtml.replace(/<div class="grid" id="tab4-grid">/, '<div class="grid" id="tab4-grid">' + injectContent);
                indexHtml = indexHtml.replace(/<div style="grid-column: 1\/-1; text-align: center; color: var\(--text-secondary\); padding: 2rem;">\s*暫無專案報表.*?<\/div>/, '');
                fs.writeFileSync(rootIndexHtmlPath, indexHtml);
                console.log("Updated root report_index.html");
            }
        }


    } catch (e) {
        console.error("Error generating report:", e);
    } finally {
        await client.close();
    }
}

generateReport();
