
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

        console.log("Fetching data for 2026-01...");
        const data = await collection.find({ "交易時間": { $regex: "^2026-01" } }).toArray();
        console.log(`Fetched ${data.length} records.`);

        // Calculate Date Range
        const dates = data
            .map(d => d['交易時間'] ? new Date(d['交易時間'].split(' ')[0]) : null)
            .filter(d => d !== null);

        let fileTitle = "分析報表";
        let dateTitle = "分析報表 (A系統)";
        if (dates.length > 0) {
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));

            const startYear = minDate.getFullYear();
            const startMonth = String(minDate.getMonth() + 1).padStart(2, '0');
            const endYear = maxDate.getFullYear();
            const endMonth = String(maxDate.getMonth() + 1).padStart(2, '0');

            if (startYear === endYear && startMonth === endMonth) {
                fileTitle = `${startYear}年${startMonth}月 分析報表`;
                dateTitle = `${startYear}年${startMonth}月 分析報表 (A系統)`;
            } else if (startYear === endYear) {
                fileTitle = `${startYear}年${startMonth}月-${endMonth}月 分析報表`;
                dateTitle = `${startYear}年${startMonth}月-${endMonth}月 分析報表 (A系統)`;
            } else {
                fileTitle = `${startYear}年${startMonth}月 - ${endYear}年${endMonth}月 分析報表`;
                dateTitle = `${startYear}年${startMonth}月 - ${endYear}年${endMonth}月 分析報表 (A系統)`;
            }
        }

        // Current Time for the report
        const reportTime = new Date().toLocaleString('zh-TW');

        // Load Logo Base64
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, 'ibon_logo.png');
            if (fs.existsSync(logoPath)) {
                const logoBuffer = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            } else {
                console.warn("Logo file 'ibon_logo.png' not found locally.");
            }
        } catch (err) {
            console.warn("Error reading logo file:", err);
        }

        // HTML Template with embedded data
        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ibon售票系統 ${dateTitle} - ${reportTime}</title>
    <!-- Chart.js and Annotation Plugin -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #fce4ec;
            --card-bg: #ffffff;
            --text-primary: #880e4f;
            --text-secondary: #ad1457;
            --accent-color: #d81b60;
            --shadow: 0 4px 6px rgba(0,0,0,0.05);
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        header {
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
            padding: 20px;
            border-radius: 16px;
            box-shadow: var(--shadow);
        }

        h1 { margin: 0; font-weight: 600; color: var(--accent-color); }
        .meta { color: var(--text-secondary); font-size: 0.9em; }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .card {
            background: var(--card-bg);
            border-radius: 16px;
            padding: 20px;
            box-shadow: var(--shadow);
            border-left: 5px solid var(--accent-color);
        }

        .card h3 { margin: 0 0 10px 0; font-size: 0.85em; color: var(--text-secondary); opacity: 0.8; }
        .card .value { font-size: 1.8em; font-weight: 700; color: var(--accent-color); }
        .card .sub { font-size: 0.8em; color: #888; margin-top: 5px; }

        .charts-row {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }

        .chart-container {
            background: var(--card-bg);
            border-radius: 16px;
            padding: 20px;
            box-shadow: var(--shadow);
            flex: 1;
            min-width: 400px;
            min-height: 400px;
        }

        .table-container {
            background: var(--card-bg);
            border-radius: 16px;
            padding: 20px;
            box-shadow: var(--shadow);
            overflow-x: auto;
            margin-bottom: 30px;
        }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #f8bbd0; }
        th { color: var(--text-secondary); font-weight: 600; white-space: nowrap; }
        td { white-space: nowrap; }
        tr:hover { background-color: #fff0f5; }
        
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
        }
        .status-ok { background: #e8f5e9; color: #2e7d32; }
        .status-void { background: #ffebee; color: #c62828; }

        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }

        @media print {
            body { background: white; }
            .card, .chart-container, .table-container { box-shadow: none; border: 1px solid #ddd; }
        }
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        
        .modal-content {
            background: #fff;
            width: 95%;
            max-width: 1100px;
            height: 90vh;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }

        .modal-header {
            padding: 20px;
            background: var(--text-primary);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-body {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background: #fcfcfc;
        }

        .close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
        }
        
        .analysis-link {
            color: var(--accent-color);
            cursor: pointer;
            text-decoration: underline;
            font-weight: bold;
        }
        .analysis-link:hover {
            color: #880e4f;
        }

        .chart-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        /* Print Styles */
        @media print {
            @page { size: landscape; margin: 5mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
            .container { width: 100%; max-width: none; margin: 0; padding: 0; }
            .card, .chart-container, .table-container { 
                break-inside: avoid; 
                page-break-inside: avoid; 
                box-shadow: none; 
                border: 1px solid #ddd;
                margin-bottom: 20px;
            }
            header { box-shadow: none; border-bottom: 2px solid var(--accent-color); }
            /* Hide Buttons */
            button, a[href*="report_index.html"], .close-btn { display: none !important; }
        }
    </style>
</head>
<body>

<div class="container">
    <header>
        <div style="display: flex; align-items: center; gap: 20px;">
            <img src="${logoBase64 ? logoBase64 : 'https://ticket.ibon.com.tw/assets/img/logo.png'}" alt="ibon Logo" style="height: 45px;">
            <div>
                <h1>ibon售票系統 ${dateTitle}</h1>
                <div style="margin-top:5px; color: #666;">Data Source: MongoDB (QwareAi / Qware_Ticket_Data)</div>
            </div>
        </div>
        <div class="meta">
            產出時間: ${reportTime}<br>
            總資料筆數 (Total Rows): <span id="meta-total-rows">--</span><br>
            製表者: 陳俊良
        </div>
    </header>

    <div class="stats-grid">
        <div class="card">
            <h3>總營收 (Total Revenue)</h3>
            <div class="value" id="val-revenue">--</div>
            <div class="sub">含正常交易</div>
        </div>
        <div class="card">
            <h3>客單價 (AOV)</h3>
            <div class="value" id="val-aov">--</div>
            <div class="sub">營收 / 訂單筆數</div>
        </div>
        <div class="card">
            <h3>總交易張數 (Total Tickets)</h3>
            <div class="value" id="val-tickets">--</div>
            <div class="sub">總售出票券數量</div>
        </div>
        <div class="card">
            <h3>總訂單筆數 (Distinct Orders)</h3>
            <div class="value" id="val-orders">--</div>
            <div class="sub">不重複訂單編號</div>
        </div>
        <div class="card">
            <h3>總退票張數 (Total Refunded Tickets)</h3>
            <div class="value" id="val-refund-tickets">--</div>
            <div class="sub" style="color: #c62828;">已退票/退票狀態</div>
        </div>
        <div class="card">
            <h3>總退票金額 (Refunded Amt)</h3>
            <div class="value" id="val-refunded-amount">--</div>
            <div class="sub">退票票券原總價</div>
        </div>
        <div class="card">
            <h3>退票手續費 (Refund Fees)</h3>
            <div class="value" id="val-refund-fees">--</div>
            <div class="sub">退票產生之營收</div>
        </div>
    </div>

    <div class="charts-row">
        <div class="chart-container" style="flex:100%;">
            <canvas id="trendChart"></canvas>
        </div>
    </div>

    <!-- Refund Trend Chart -->
    <div class="charts-row">
        <div class="chart-container" style="flex:100%;">
            <canvas id="refundTrendChart"></canvas>
        </div>
    </div>
    
    <!-- Top 5 Events Table -->
    <div class="table-container">
        <h3 style="color: var(--text-secondary); border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">🏆 銷售排行 Top 5 (By Revenue)</h3>
        <table id="topEventsTable">
            <thead>
                <tr>
                    <th style="width: 50px;">Rank</th>
                    <th>節目名稱</th>
                    <th class="text-right">筆數 (Orders)</th>
                    <th class="text-right">張數 (Tickets)</th>
                    <th class="text-right">金額 (Revenue)</th>
                    <th class="text-right">佔比 (Share)</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>

    <!-- Top 5 Refund Events Table -->
    <div class="table-container">
        <h3 style="color: #c62828; border-bottom: 2px solid #c62828; padding-bottom: 10px;">📉 退票排行 Top 5 (By Refund Amount)</h3>
        <table id="topRefundTable">
            <thead>
                <tr>
                    <th style="width: 50px;">Rank</th>
                    <th>節目名稱</th>
                    <th class="text-right">筆數 (Orders)</th>
                    <th class="text-right">張數 (Tickets)</th>
                    <th class="text-right">金額 (Amount)</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>

    <!-- Payment Methods Table -->
    <div class="table-container">
        <h3 style="color: var(--text-secondary); border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">💳 付款方式分析 (Payment Methods)</h3>
        <table id="paymentTable">
            <thead>
                <tr>
                    <th>付款方式</th>
                    <th class="text-right">筆數 (Orders)</th>
                    <th class="text-right">張數 (Tickets)</th>
                    <th class="text-right">金額 (Revenue)</th>
                    <th class="text-right">佔比 (Share)</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>

    <!-- Sales Point Analysis Table -->
    <div class="table-container">
        <h3 style="color: var(--text-secondary); border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">🏪 銷售點分析 (Sales Points)</h3>
        <table id="salesPointTable">
            <thead>
                <tr>
                    <th>銷售點 (Sales Point)</th>
                    <th class="text-right">筆數 (Orders)</th>
                    <th class="text-right">張數 (Tickets)</th>
                    <th class="text-right">金額 (Revenue)</th>
                    <th class="text-right">佔比 (Share)</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>

</div>

<!-- Analysis Modal -->
<div id="analysisModal" class="modal-overlay">
    <div class="modal-content">
        <div class="modal-header">
            <h2 id="modalTitle" style="margin:0; font-size:1.2em;">Event Analysis</h2>
            <button class="close-btn" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="stats-grid">
                <div class="card">
                    <h3>總營收</h3>
                    <div class="value" id="m-val-revenue">--</div>
                </div>
                <div class="card">
                    <h3>銷售張數</h3>
                    <div class="value" id="m-val-tickets">--</div>
                </div>
                <div class="card">
                    <h3>客單價 (AOV)</h3>
                    <div class="value" id="m-val-aov">--</div>
                </div>
                <div class="card">
                    <h3>退票金額 (Refunds)</h3>
                    <div class="value" id="m-val-refunds" style="color: #c62828;">--</div>
                </div>
            </div>
            
            <div class="chart-grid">
                 <div class="chart-container" style="height:300px;">
                    <canvas id="modalPriceChart"></canvas>
                </div>
                <div class="chart-container" style="height:300px;">
                    <canvas id="modalTrendChart"></canvas>
                </div>
            </div>

            <div class="table-container" style="margin-top:20px;">
                <h3>銷售點分析 (Sales Points)</h3>
                <table id="modalSalesPointTable">
                    <thead>
                        <tr><th>銷售點</th><th>張數 (Tickets)</th><th>營收 (Revenue)</th><th class="text-right">佔比 (Share)</th></tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>

            <div class="table-container" style="margin-top:20px;">
                <h3>票價銷售詳情</h3>
                <table id="modalPriceTable">
                    <thead>
                        <tr><th>票價</th><th>張數</th><th>營收</th><th class="text-right">佔比</th></tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>

            <div class="table-container" style="margin-top:20px;">
                <h3 style="color:#c62828;">退票分析 (Refund Analysis)</h3>
                <table id="modalRefundTable">
                    <thead>
                        <tr><th>退票因素 (Reason)</th><th>張數 (Tickets)</th><th>手續費 (Fee)</th></tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<script>
    const dbData = ${JSON.stringify(data)};

    // Charts Storage to destroy before reuse
    let modalPriceChart = null;
    let modalTrendChart = null;

    function closeModal() {
        document.getElementById('analysisModal').style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
    }

    // Close on click outside
    window.onclick = function(event) {
        const modal = document.getElementById('analysisModal');
        if (event.target == modal) {
            closeModal();
        }
    }

    function analyzeEvent(eventName) {
        document.body.style.overflow = 'hidden'; // Disable background scroll
        document.getElementById('analysisModal').style.display = 'flex';
        document.getElementById('modalTitle').innerText = eventName;
        
        // Filter Data (ALL)
        const allEventData = dbData.filter(d => d['節目/商品名稱'] === eventName);
        const eventData = allEventData.filter(d => d['狀態'] === '正常'); // Valid Sales
        const refundData = allEventData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票' || (d['手續費'] && d['手續費'] > 0)); 
        
        // 1. Basic Stats
        const revenue = eventData.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
        const tickets = eventData.length;
        const totalRefAmount = allEventData.reduce((acc, cur) => acc + (cur['手續費'] || 0), 0);
        
        const uniqueOrders = new Set();
        eventData.forEach(o => {
            if(o['訂單編號']) uniqueOrders.add(o['訂單編號'].split('_')[0]);
        });
        const orders = uniqueOrders.size;
        const aov = orders ? Math.round(revenue / orders) : 0;
        
        document.getElementById('m-val-revenue').innerText = 'NT$ ' + revenue.toLocaleString();
        document.getElementById('m-val-tickets').innerText = tickets.toLocaleString();
        document.getElementById('m-val-aov').innerText = 'NT$ ' + aov.toLocaleString();
        document.getElementById('m-val-refunds').innerText = 'NT$ ' + totalRefAmount.toLocaleString();
        
        // 2. Pricing Stats
        const priceStats = {};
        eventData.forEach(o => {
            const p = o['售價'] || 0;
            if(!priceStats[p]) priceStats[p] = { count: 0, revenue: 0 };
            priceStats[p].count += 1;
            priceStats[p].revenue += p;
        });
        
        const priceList = Object.keys(priceStats)
            .map(p => ({ price: parseInt(p), ...priceStats[p] }))
            .sort((a,b) => b.price - a.price);
            
        // Table Render
        const tbody = document.querySelector('#modalPriceTable tbody');
        tbody.innerHTML = '';
        priceList.forEach(p => {
             const share = revenue ? ((p.revenue / revenue) * 100).toFixed(1) : 0;
             const tr = document.createElement('tr');
             tr.innerHTML = \`
                <td>\${p.price === 0 ? '免費/公關' : '$'+p.price.toLocaleString()}</td>
                <td>\${p.count.toLocaleString()}</td>
                <td>$\${p.revenue.toLocaleString()}</td>
                <td class="text-right">\${share}%</td>
             \`;
             tbody.appendChild(tr);
        });
        
        // Chart Render (Destroy old first)
        if(modalPriceChart) modalPriceChart.destroy();
        if(modalTrendChart) modalTrendChart.destroy();
        
        // Price Chart
        const pLabels = priceList.map(p => '$'+p.price);
        const pData = priceList.map(p => p.count);
        
        modalPriceChart = new Chart(document.getElementById('modalPriceChart'), {
            type: 'doughnut',
            data: {
                labels: pLabels,
                datasets: [{
                    data: pData,
                    backgroundColor: [
                        '#d81b60', '#e91e63', '#f06292', '#f48fb1', '#f8bbd0', 
                        '#ad1457', '#880e4f', '#c2185b'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    title: { display: true, text: '票價分佈 (Tickets by Price)' },
                    legend: { position: 'right' } 
                }
            }
        });

        // Trend Chart
        const dailyStats = {};
        eventData.forEach(o => {
            if(!o['交易時間']) return;
            const date = o['交易時間'].split(' ')[0];
            dailyStats[date] = (dailyStats[date] || 0) + (o['售價'] || 0);
        });
        const dates = Object.keys(dailyStats).sort();
        const amounts = dates.map(d => dailyStats[d]);
        
        modalTrendChart = new Chart(document.getElementById('modalTrendChart'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: '銷售額',
                    data: amounts,
                    borderColor: '#880e4f',
                    backgroundColor: 'rgba(136, 14, 79, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                 responsive: true,
                 maintainAspectRatio: false,
                 plugins: { 
                    title: { display: true, text: '銷售趨勢 (Sales Trend)' },
                    legend: { display: false } 
                 },
                 scales: {
                     y: { ticks: { callback: v => '$' + v/1000 + 'k' } }
                 }
            }
        });

        // Sales Point Stats
        const pointStats = {};
        eventData.forEach(o => {
            const point = o['銷售點'] || 'Unknown';
            const price = o['售價'] || 0;
            if(!pointStats[point]) pointStats[point] = { tickets: 0, revenue: 0 };
            pointStats[point].tickets += 1;
            pointStats[point].revenue += price;
        });

        const pointList = Object.keys(pointStats)
            .map(p => ({ point: p, ...pointStats[p] }))
            .sort((a,b) => b.revenue - a.revenue);

        // Render Sales Point Table
        const spTbody = document.querySelector('#modalSalesPointTable tbody');
        spTbody.innerHTML = '';
        pointList.forEach(p => {
             const share = revenue ? ((p.revenue / revenue) * 100).toFixed(1) : 0;
             const tr = document.createElement('tr');
             tr.innerHTML = \`
                <td class="font-bold">\${p.point}</td>
                <td>\${p.tickets.toLocaleString()}</td>
                <td>$\${p.revenue.toLocaleString()}</td>
                <td class="text-right">\${share}%</td>
             \`;
             spTbody.appendChild(tr);
        });

        // Refund Stats
        const refundStats = {};
        refundData.forEach(o => {
            const reason = o['退票因素'] || 'Unknown';
            const fee = o['手續費'] || 0;
            if(!refundStats[reason]) refundStats[reason] = { count: 0, fee: 0 };
            refundStats[reason].count += 1;
            refundStats[reason].fee += fee;
        });
        const refundList = Object.keys(refundStats).map(r => ({ reason: r, ...refundStats[r] })).sort((a,b) => b.fee - a.fee);

        const rfTbody = document.querySelector('#modalRefundTable tbody');
        rfTbody.innerHTML = '';
        if(refundList.length === 0) {
            rfTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">無退票紀錄</td></tr>';
        } else {
            refundList.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = \`
                    <td>\${r.reason}</td>
                    <td>\${r.count.toLocaleString()}</td>
                    <td>NT$ \${r.fee.toLocaleString()}</td>
                \`;
                rfTbody.appendChild(tr);
            });
        }
    }

    function init() {
        document.getElementById('meta-total-rows').innerText = dbData.length.toLocaleString();

        // Filter valid orders
        const validOrders = dbData.filter(d => d['狀態'] === '正常');
        
        // 1. Overall Stats Calculation
        const totalRevenue = validOrders.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
        
        // Refund Calculations
        const refundDocs = dbData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');
        const totalRefundedValue = refundDocs.reduce((acc, cur) => acc + (cur['實退金額'] || 0), 0);
        const totalRefundFees = dbData.reduce((acc, cur) => acc + (cur['手續費'] || 0), 0);
        
        const totalTickets = validOrders.length; 
        const totalRefundedTickets = dbData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票' || (d['手續費'] && d['手續費'] > 0)).length; 

        // Count distinct orders
        const uniqueOrdersSet = new Set();
        validOrders.forEach(o => {
            if(o['訂單編號']) {
                const baseOrder = o['訂單編號'].split('_')[0];
                uniqueOrdersSet.add(baseOrder);
            }
        });
        const orderCount = uniqueOrdersSet.size;
        const aov = orderCount ? Math.round(totalRevenue / orderCount) : 0;

        // Render Cards
        document.getElementById('val-revenue').innerText = 'NT$ ' + totalRevenue.toLocaleString();
        document.getElementById('val-tickets').innerText = totalTickets.toLocaleString();
        document.getElementById('val-orders').innerText = orderCount.toLocaleString();
        document.getElementById('val-aov').innerText = 'NT$ ' + aov.toLocaleString();
        document.getElementById('val-refunded-amount').innerText = 'NT$ ' + totalRefundedValue.toLocaleString();
        document.getElementById('val-refund-fees').innerText = 'NT$ ' + totalRefundFees.toLocaleString();
        document.getElementById('val-refund-tickets').innerText = totalRefundedTickets.toLocaleString();

        // 2a. Payment Method Analysis
        const paymentStats = {}; 
        validOrders.forEach(item => {
            const method = item['付款方式'] || 'Unknown';
            const price = item['售價'] || 0;
            const orderId = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'unknown';

            if (!paymentStats[method]) {
                paymentStats[method] = { orders: new Set(), tickets: 0, revenue: 0 };
            }
            paymentStats[method].orders.add(orderId);
            paymentStats[method].tickets += 1;
            paymentStats[method].revenue += price;
        });

        const paymentList = Object.entries(paymentStats)
            .map(([name, stats]) => ({
                name,
                orderCount: stats.orders.size,
                ticketCount: stats.tickets,
                revenue: stats.revenue,
                share: totalRevenue ? (stats.revenue / totalRevenue * 100).toFixed(1) : 0
            }))
            .sort((a, b) => b.revenue - a.revenue);

        const paymentTbody = document.querySelector('#paymentTable tbody');
        paymentList.forEach((p) => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
                <td class="font-bold">\${p.name}</td>
                <td class="text-right">\${p.orderCount.toLocaleString()}</td>
                <td class="text-right">\${p.ticketCount.toLocaleString()}</td>
                <td class="text-right">NT$ \${p.revenue.toLocaleString()}</td>
                <td class="text-right" style="color:#888;">\${p.share}%</td>
            \`;
            paymentTbody.appendChild(tr);
        });

        // 2a-2. Sales Point Analysis
        const salesPointStats = {};
        validOrders.forEach(item => {
            const point = item['銷售點'] || 'Unknown';
            const price = item['售價'] || 0;
            const orderId = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'unknown';

            if (!salesPointStats[point]) {
                salesPointStats[point] = { orders: new Set(), tickets: 0, revenue: 0 };
            }
            salesPointStats[point].orders.add(orderId);
            salesPointStats[point].tickets += 1;
            salesPointStats[point].revenue += price;
        });

        const salesPointList = Object.entries(salesPointStats)
            .map(([name, stats]) => ({
                name,
                orderCount: stats.orders.size,
                ticketCount: stats.tickets,
                revenue: stats.revenue,
                share: totalRevenue ? (stats.revenue / totalRevenue * 100).toFixed(1) : 0
            }))
            .sort((a, b) => b.revenue - a.revenue);

        const salesPointTbody = document.querySelector('#salesPointTable tbody');
        salesPointList.forEach((p) => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
                <td class="font-bold">\${p.name}</td>
                <td class="text-right">\${p.orderCount.toLocaleString()}</td>
                <td class="text-right">\${p.ticketCount.toLocaleString()}</td>
                <td class="text-right">NT$ \${p.revenue.toLocaleString()}</td>
                <td class="text-right" style="color:#888;">\${p.share}%</td>
            \`;
            salesPointTbody.appendChild(tr);
        });

        // 2b. Top 5 Events Logic
        const eventStats = {}; 
        validOrders.forEach(item => {
            const name = item['節目/商品名稱'] || 'Unknown';
            const price = item['售價'] || 0;
            const orderId = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'unknown';

            if (!eventStats[name]) {
                eventStats[name] = { orders: new Set(), tickets: 0, revenue: 0 };
            }
            eventStats[name].orders.add(orderId);
            eventStats[name].tickets += 1;
            eventStats[name].revenue += price;
        });

        const topEvents = Object.entries(eventStats)
            .map(([name, stats]) => ({
                name,
                orderCount: stats.orders.size,
                ticketCount: stats.tickets,
                revenue: stats.revenue,
                share: totalRevenue ? (stats.revenue / totalRevenue * 100).toFixed(1) : 0
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        const topTableBody = document.querySelector('#topEventsTable tbody');
        topEvents.forEach((ev, index) => {
            const tr = document.createElement('tr');
            // Modified to add Link
            tr.innerHTML = \`
                <td><span style="background:var(--accent-color); color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">\${index + 1}</span></td>
                <td>
                    <span class="analysis-link" onclick="analyzeEvent('\${ev.name}')">\${ev.name}</span>
                </td>
                <td class="text-right">\${ev.orderCount.toLocaleString()}</td>
                <td class="text-right">\${ev.ticketCount.toLocaleString()}</td>
                <td class="text-right" style="color: var(--accent-color); font-weight:bold;">NT$ \${ev.revenue.toLocaleString()}</td>
                <td class="text-right" style="color:#888;">\${ev.share}%</td>
            \`;
            topTableBody.appendChild(tr);
        });

        // 2c. Top 5 Refund Events Logic
        const refundStats = {};
        const refundRecords = dbData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票' || (d['手續費'] && d['手續費'] > 0)); 
        
        refundRecords.forEach(item => {
            const name = item['節目/商品名稱'] || 'Unknown';
            const fee = item['手續費'] || 0;
            const orderId = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'unknown';

            if (!refundStats[name]) {
                refundStats[name] = { orders: new Set(), tickets: 0, amount: 0 };
            }
            refundStats[name].orders.add(orderId);
            refundStats[name].tickets += 1;
            refundStats[name].amount += fee;
        });

        const topRefunds = Object.entries(refundStats)
            .map(([name, stats]) => ({
                name,
                orderCount: stats.orders.size,
                ticketCount: stats.tickets,
                amount: stats.amount
            }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        const topRefundTableBody = document.querySelector('#topRefundTable tbody');
        if(topRefunds.length === 0) {
             topRefundTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">無退票資料</td></tr>';
        } else {
            topRefunds.forEach((ev, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = \`
                    <td><span style="background:#c62828; color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">\${index + 1}</span></td>
                    <td>
                         <span class="analysis-link" onclick="analyzeEvent('\${ev.name}')">\${ev.name}</span>
                    </td>
                    <td class="text-right">\${ev.orderCount.toLocaleString()}</td>
                    <td class="text-right">\${ev.ticketCount.toLocaleString()}</td>
                    <td class="text-right" style="color: #c62828; font-weight:bold;">NT$ \${ev.amount.toLocaleString()}</td>
                \`;
                topRefundTableBody.appendChild(tr);
            });
        }

        // 3. Charts Stats Collection
        const salesByDate = {};
        const dailyProductStats = {}; // { date: { prodName: { revenue, tickets, orders: Set } } }

        validOrders.forEach(item => {
            if (!item['交易時間']) return;
            const date = item['交易時間'].split(' ')[0];
            const price = item['售價'] || 0;
            const name = item['節目/商品名稱'] || '未知';
            const orderId = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'u';

            salesByDate[date] = (salesByDate[date] || 0) + price;

            if(!dailyProductStats[date]) dailyProductStats[date] = {};
            if(!dailyProductStats[date][name]) dailyProductStats[date][name] = { revenue: 0, tickets: 0, orders: new Set() };
            
            const p = dailyProductStats[date][name];
            p.revenue += price;
            p.tickets += 1;
            p.orders.add(orderId);
        });

        const dates = Object.keys(salesByDate).sort();
        const dailySales = dates.map(d => salesByDate[d]);

        // Generate Annotations with Interactions
        const myAnnotations = {};
        dates.forEach((date, index) => {
            if (dailySales[index] > 6000000) {
                // Find max product
                const prods = dailyProductStats[date];
                let maxP = '';
                let maxR = 0;
                for(let pname in prods) {
                    if (prods[pname].revenue > maxR) {
                        maxR = prods[pname].revenue;
                        maxP = pname;
                    }
                }
                
                const stats = prods[maxP];
                const cleanName = maxP.length > 12 ? maxP.substring(0,12)+'...' : maxP;
                const fullInfo = [
                    maxP,
                    '------------------',
                    '筆數: ' + stats.orders.size,
                    '張數: ' + stats.tickets,
                    '金額: $' + stats.revenue.toLocaleString()
                ];

                myAnnotations['note'+index] = {
                    type: 'label',
                    xValue: date,
                    yValue: dailySales[index],
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    borderColor: '#ff9800',
                    borderWidth: 1,
                    borderRadius: 4,
                    // Default Content (Simple Name)
                    content: [cleanName],
                    font: { size: 11, weight: 'bold' },
                    color: '#e65100',
                    position: 'start',
                    yAdjust: -20,
                    
                    // Interactions
                    enter: function(context) {
                        // On hover, expand content
                        context.element.options.content = fullInfo;
                        context.element.options.z = 10; // bring to front
                        context.element.options.backgroundColor = '#fff3e0';
                        context.chart.draw();
                    },
                    leave: function(context) {
                        // On leave, revert
                        context.element.options.content = [cleanName];
                        context.element.options.z = 0;
                        context.element.options.backgroundColor = 'rgba(255,255,255,0.9)';
                        context.chart.draw();
                    }
                };
            }
        });


        // Line Chart
        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: '每日營收走勢',
                    data: dailySales,
                    borderColor: '#d81b60',
                    backgroundColor: 'rgba(216, 27, 96, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    title: { display: true, text: '營收趨勢圖 (Sales Trend)' },
                    annotation: {
                        annotations: myAnnotations
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });

        // 4. Refund Trend Chart
        const dailyRefundsMap = {};
        refundRecords.forEach(item => {
             let dateStr = item['退票時間'];
             // Fallback if missing, though refund time is best
             if (!dateStr || dateStr === '-') dateStr = item['交易時間'];
             if (!dateStr) return;
             
             const date = dateStr.split(' ')[0];
             const val = item['實退金額'] || 0;
             dailyRefundsMap[date] = (dailyRefundsMap[date] || 0) + val;
        });

        const rDates = Object.keys(dailyRefundsMap).sort();
        const rAmounts = rDates.map(d => dailyRefundsMap[d]);

        new Chart(document.getElementById('refundTrendChart'), {
            type: 'line',
            data: {
                labels: rDates,
                datasets: [{
                    label: '每日退票金額 (Refund Amount)',
                    data: rAmounts,
                    borderColor: '#757575',
                    backgroundColor: 'rgba(117, 117, 117, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    title: { display: true, text: '每日退票走勢 (Daily Refund Trend)' },
                    tooltip: {
                         callbacks: {
                             label: function(context) {
                                 return context.dataset.label + ': $' + context.raw.toLocaleString();
                             }
                         }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: { callback: v => '$' + v.toLocaleString() } 
                    }
                }
            }
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
    background: linear-gradient(135deg, #d81b60, #ad1457);
    color: white;
    padding: 12px 24px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(216, 27, 96, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    z-index: 1000;
" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 20px rgba(216, 27, 96, 0.5)';" 
   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(216, 27, 96, 0.4)';">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
    </svg>
    回首頁
</a>

</body>
</html>
        `;

        const safeTitle = fileTitle.replace(/ /g, '_').replace(/[\u4e00-\u9fa5]/g, (match) => match).replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '');
        const fileName = `A_Qware_Revenue_Report_${safeTitle}.html`;
        const filePath = path.join(__dirname, 'report', fileName);

        fs.writeFileSync(filePath, htmlContent);
        console.log(`Report generated successfully: ${filePath}`);

    } catch (e) {
        console.error("Error generating report:", e);
    } finally {
        await client.close();
    }
}

generateReport();
