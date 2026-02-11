
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

        const TARGET_NAME = '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards';
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
    <title>第40屆金唱片頒獎典禮 - 專案分析報表 (A系統)</title>
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #121212;
            --card-bg: #1e1e1e;
            --text-primary: #e0e0e0;
            --text-secondary: #a0a0a0;
            --accent-color: #ffd700; /* Gold */
            --accent-secondary: #ffb300;
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
            background: linear-gradient(135deg, #ffd700, #bf953f);
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
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
</head>
<body>

<div class="container">
    <header>
        <div>
            <div class="logo-text">GOLDEN DISC AWARDS</div>
            <div class="logo-sub">第40屆金唱片頒獎典禮 - 專案銷售分析</div>
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

    <!-- AOV Analysis Section -->
    <div class="main-content">
        <div class="chart-card" style="grid-column: span 2; border-left: 5px solid #ef5350;">
            <h3>📊 客單價深度分析 (AOV Deep Dive)</h3>
            <div style="padding: 10px; line-height: 1.6; color: #bbb;">
                <p>本專案平均客單價 (AOV) 高達 <strong style="color:var(--accent-color); font-size:1.2em;">$10,699</strong>，主要原因分析如下：</p>
                <ul style="list-style: none; padding-left: 0;">
                    <li style="margin-bottom: 12px;">✅ <strong>高單價票券為銷售主力</strong>：
                        <br>熱銷票價依序為 
                        <span class="badge">$6,980</span> (12,096張)、
                        <span class="badge">$5,980</span> (7,860張)、
                        <span class="badge">$8,980</span> (3,988張)。
                        <br>絕大多數售出的票券單價都在 $5,000 以上，墊高了基礎金額。
                    </li>
                    <li style="margin-bottom: 12px;">✅ <strong>單筆訂單購買多張票</strong>：
                        <br>購買 <strong style="color:var(--text-primary)">2張</strong> 的訂單量 (9,546筆) 超越了只買 1張 的訂單量 (9,266筆)。
                        <br>眾多用戶一次購買兩張高價票 (例如: $6,980 x 2 = $13,960)，直接大幅拉升了平均客單價。
                    </li>
                </ul>
                <p style="font-size: 0.9em; color: #888;">* 此外，部分團體/大宗訂單 (單筆10張以上) 亦對拉高平均值有貢獻。</p>
            </div>
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
        const salesByDate = {}; // { YYYY-MM-DD: revenue }
        validOrders.forEach(o => {
            if(!o['交易時間']) return;
            const date = o['交易時間'].split(' ')[0];
            salesByDate[date] = (salesByDate[date] || 0) + (o['售價'] || 0);
        });
        const dates = Object.keys(salesByDate).sort();
        const dailyRevenues = dates.map(d => salesByDate[d]);

        // 2. Price Distribution
        const priceStats = {}; // { price: { count, revenue } }
        validOrders.forEach(o => {
            const p = o['售價'] || 0;
            if(!priceStats[p]) priceStats[p] = { count: 0, revenue: 0 };
            priceStats[p].count++;
            priceStats[p].revenue += p;
        });
        
        const priceArray = Object.keys(priceStats).map(p => ({
            price: parseInt(p),
            ...priceStats[p]
        })).sort((a,b) => b.price - a.price); // High to Low price

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
                    borderColor: '#ffd700',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }, // minimalist
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
                    backgroundColor: '#FFD700',
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
                    backgroundColor: ['#42A5F5', '#EC407A', '#BDBDBD'], // Blue, Pink, Grey
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
    }

    init();
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
<a href="report_index.html" style="
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: linear-gradient(135deg, #ffd700, #bf953f);
    color: #121212;
    padding: 12px 24px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    z-index: 1000;
" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 20px rgba(255, 215, 0, 0.5)';" 
   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(255, 215, 0, 0.4)';">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
    </svg>
    回首頁
</a>

</body>
</html>
        `;

        const fileName = 'A_GoldenDisc_Report_2026-02-06.html';
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
