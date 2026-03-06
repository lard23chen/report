
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

        console.log("Fetching Section Data...");
        const sectionData = await db.collection('Qware_A_Section_number').find({ '場次名稱': TARGET_NAME }).toArray();

        const topEventId = 39311;
        console.log(`Fetching GA Data for ActivityID: ${topEventId}`);
        const gaSessions = await db.collection("QwareTrafficSession").find({ ActivityID: topEventId }).toArray();
        const gaReads = await db.collection("QwareTrafficGAReadTime").find({ ActivityID: topEventId }).toArray();

        console.log("Fetching Session/Pageview Data (Qware_A_Traffic_session_data)...");
        const pageViews = await db.collection("Qware_A_Traffic_session_data").find({ '節目名稱': TARGET_NAME }).toArray();

        // Map member nationality
        console.log("Fetching Member Data for Nationalities...");
        const memberIds = [...new Set(data.map(d => d['會員編號']).filter(id => id && id !== '-'))];
        const memberColl = db.collection('Qware_Member_data');
        const members = await memberColl.find({ '會員編號': { $in: memberIds } }).toArray();

        const memberNatMap = {};
        members.forEach(m => {
            if (m['會員編號'] && m['國家']) {
                memberNatMap[m['會員編號']] = m['國家'];
            }
        });

        // Attach nationality to ticket data
        data.forEach(d => {
            const memberId = d['會員編號'];
            if (memberId && memberNatMap[memberId]) {
                d['國籍'] = memberNatMap[memberId];
            } else {
                d['國籍'] = '未知';
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

        .demo-content {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
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
            <h3>淨營收 (Net Revenue)</h3>
            <div class="value" id="val-net-revenue" style="color: #66bb6a;">--</div>
            <div class="sub">總營收 - 退票金額</div>
        </div>
        <div class="card">
            <h3>實銷張數 (Actual Sold)</h3>
            <div class="value" id="val-net-tickets" style="color: #66bb6a;">--</div>
            <div class="sub">銷售張數 - 退票張數</div>
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
    <div class="demo-content">
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
        
        <!-- Nationality Distribution -->
        <div class="chart-card">
            <h3>國籍分佈 (Nationality Top 5)</h3>
            <table id="natTable">
                <thead>
                    <tr>
                        <th>國籍</th>
                        <th>人數(張數)</th>
                        <th>筆數</th>
                        <th>佔比(筆數)</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    </div>

    <!-- Main Trend & Payment Analysis -->
    <div class="main-content">
        <!-- Page Views Chart -->
        <div class="chart-card" style="grid-column: span 2;">
            <h3 style="border-left-color: #42A5F5;">每日瀏覽量趨勢 (Daily Page Views)</h3>
            <div style="height: 350px;">
                <canvas id="viewChart"></canvas>
            </div>
        </div>
    </div>

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
            <h3>各票區銷售詳情 (Sales by Section)</h3>
            <table id="priceTable">
                <thead>
                    <tr>
                        <th>票區名稱 (Section)</th>
                        <th>座位總數 (Total)</th>
                        <th>保留數 (Reserved)</th>
                        <th>可售數 (Available)</th>
                        <th>銷售張數 (Sold Qty)</th>
                        <th>營收 (Revenue)</th>
                        <th>實銷率 (Sell-Through Rate)</th>
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
            <h3 style="border-left-color: #70ad47;">尖峰時段銷售狀況 (Peak Hour 11:28 - 12:30)</h3>
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
    const sectionData = ${JSON.stringify(sectionData)};
    const gaSessions = ${JSON.stringify(gaSessions)};
    const gaReads = ${JSON.stringify(gaReads)};
    const pageViews = ${JSON.stringify(pageViews)};

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
        
        const netRevenue = revenue - refundAmount;
        const netTickets = tickets - refundTickets;

        // Update Stats UI
        document.getElementById('val-revenue').innerText = '$' + revenue.toLocaleString();
        document.getElementById('val-tickets').innerText = tickets.toLocaleString();
        document.getElementById('val-aov').innerText = '$' + aov.toLocaleString();
        document.getElementById('val-net-revenue').innerText = '$' + netRevenue.toLocaleString();
        document.getElementById('val-net-tickets').innerText = netTickets.toLocaleString();
        document.getElementById('val-refunds').innerText = '$' + refundAmount.toLocaleString();
        document.getElementById('val-refund-tickets').innerText = refundTickets.toLocaleString();
        document.getElementById('val-refund-fees').innerText = '$' + refundFees.toLocaleString();

        // --- Data Processing for Charts ---
        
        // 1. Daily Trend
        const salesByDate = {}; // { YYYY-MM-DD: tickets }
        const viewsByDate = {}; // { YYYY-MM-DD: views }

        validOrders.forEach(o => {
            if(!o['交易時間']) return;
            const date = o['交易時間'].split(' ')[0];
            salesByDate[date] = (salesByDate[date] || 0) + 1; // 銷售張數
        });

        pageViews.forEach(v => {
            if (!v['瀏覽日期']) return;
            const dStr = typeof v['瀏覽日期'] === 'string' ? v['瀏覽日期'] : new Date(v['瀏覽日期']).toISOString();
            const date = dStr.split('T')[0];
            viewsByDate[date] = (viewsByDate[date] || 0) + (parseInt(v['瀏覽量']) || 0);
        });

        const allDatesSet = new Set([...Object.keys(salesByDate), ...Object.keys(viewsByDate)]);
        const dates = Array.from(allDatesSet).sort();
        
        const dailyTickets = dates.map(d => salesByDate[d] || 0);
        const dailyViews = dates.map(d => viewsByDate[d] || 0);

        // 2. Section Distribution
        const sectionStats = {};
        sectionData.forEach(s => {
            const name = s['票區名稱'];
            if(name) {
                sectionStats[name] = {
                    total: parseInt(s['座位總數']) || 0,
                    reserved: parseInt(s['保留數']) || 0,
                    available: parseInt(s['可售數']) || 0,
                    count: 0,
                    revenue: 0
                };
            }
        });

        validOrders.forEach(o => {
            const seatInfo = o['座位資訊/票區'] || '';
            const secName = seatInfo.split('_')[0] || seatInfo;
            const p = o['售價'] || 0;

            if(!sectionStats[secName]) {
                sectionStats[secName] = { total: '-', reserved: '-', available: '-', count: 0, revenue: 0 };
            }
            sectionStats[secName].count++;
            sectionStats[secName].revenue += p;
        });
        
        const sectionArray = Object.keys(sectionStats).map(sec => ({
            name: sec,
            ...sectionStats[sec]
        })).sort((a,b) => b.revenue - a.revenue); // High to Low revenue by default

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

        // 6. Nationality
        const natStatsRaw = {}; // { nat: { tickets: 0, orders: Set } }
        validOrders.forEach(o => {
            let n = o['國籍'];
            if(!n || n === '-') n = '未知';
            if (n === 'Taiwan, Province of China') n = 'Taiwan'; // Clean up common data entry
            
            if (!natStatsRaw[n]) natStatsRaw[n] = { tickets: 0, orders: new Set() };
            natStatsRaw[n].tickets++;
            const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : Math.random().toString();
            natStatsRaw[n].orders.add(orderId);
        });

        const natArray = Object.keys(natStatsRaw).map(k => ({ 
            nat: k, 
            tickets: natStatsRaw[k].tickets, 
            ordersCount: natStatsRaw[k].orders.size 
        })).sort((a,b) => b.ordersCount - a.ordersCount);

        let topNat = natArray.slice(0, 5);
        let otherNatTickets = natArray.slice(5).reduce((acc, cur) => acc + cur.tickets, 0);
        let otherNatOrders = natArray.slice(5).reduce((acc, cur) => acc + cur.ordersCount, 0);
        
        if (otherNatOrders > 0 || otherNatTickets > 0) {
            topNat.push({ nat: '其他 (Other)', tickets: otherNatTickets, ordersCount: otherNatOrders });
        }
        
        const natLabels = topNat.map(x => x.nat);
        const natData = topNat.map(x => x.ordersCount);

        // --- Render Charts ---

        // Page Views Chart
        new Chart(document.getElementById('viewChart'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: '瀏覽量 (Page Views)',
                        data: dailyViews,
                        borderColor: '#42A5F5',
                        backgroundColor: 'rgba(66, 165, 245, 0.1)',
                        tension: 0.3,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    datalabels: {
                        color: '#eee',
                        align: 'top',
                        font: { weight: 'bold', size: 10 },
                        formatter: function(value, context) {
                            if (value === 0) return '';
                            if (value >= 1000000) return (value/1000000).toFixed(1) + 'M';
                            if (value >= 1000) return (value/1000).toFixed(1) + 'k';
                            return Math.round(value);
                        }
                    }
                },
                scales: {
                    x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                    y: { 
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: '#333' }, 
                        ticks: { 
                            color: '#42A5F5',
                            callback: function(value) {
                                if(value >= 1000000) return value/1000000 + 'M';
                                if(value >= 1000) return value/1000 + 'k';
                                return value;
                            }
                        } 
                    }
                }
            }
        });

        // Trend Chart (Tickets)
        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: '銷售張數 (Tickets)',
                        data: dailyTickets,
                        borderColor: '#ffd700',
                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                        tension: 0.3,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    datalabels: {
                        color: '#eee',
                        align: 'top',
                        font: { weight: 'bold', size: 10 },
                        formatter: function(value, context) {
                            if (value === 0) return '';
                            return Math.round(value);
                        }
                    }
                },
                scales: {
                    x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                    y: { 
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: '#333' }, 
                        ticks: { color: '#ffd700' } 
                    }
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
                        formatter: function(value, context) {
                            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const p = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            return value.toLocaleString() + ' (' + p + ')';
                        }
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
                            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const p = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            return [value.toLocaleString(), '(' + p + ')'];
                        }
                    }
                }
            }
        });

        // Render Nationality Table
        const natTbody = document.querySelector('#natTable tbody');
        const totalValidNatOrders = natArray.reduce((acc, cur) => acc + cur.ordersCount, 0);
        topNat.forEach(n => {
            const tr = document.createElement('tr');
            const share = totalValidNatOrders ? ((n.ordersCount / totalValidNatOrders) * 100).toFixed(1) + '%' : '0%';
            tr.innerHTML = \`
                <td>\${n.nat}</td>
                <td>\${n.tickets.toLocaleString()}</td>
                <td>\${n.ordersCount.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:\${share}; background:#66bb6a; height:6px;"></div>
                </div> \${share}</td>
            \`;
            natTbody.appendChild(tr);
        });

        // Render Section Table
        const tbody = document.querySelector('#priceTable tbody');
        sectionArray.forEach(p => {
            if (p.count === 0 && p.total === 0) return; // Skip completely empty mappings
            const tr = document.createElement('tr');
            
            let sellRate = '0%';
            let rateValue = 0;
            if (p.total !== '-' && p.total > 0) {
                rateValue = ((p.count / p.total) * 100);
                sellRate = rateValue.toFixed(1) + '%';
            }

            const totalStr = p.total === '-' ? p.total : p.total.toLocaleString();
            const resStr = p.reserved === '-' ? p.reserved : p.reserved.toLocaleString();
            const availStr = p.available === '-' ? p.available : p.available.toLocaleString();
            
            tr.innerHTML = \`
                <td>\${p.name}</td>
                <td style="color: #94a3b8;">\${totalStr}</td>
                <td style="color: #ef4444;">\${resStr}</td>
                <td style="color: #4ade80;">\${availStr}</td>
                <td style="font-weight: bold; color: var(--accent-color);">\${p.count.toLocaleString()}</td>
                <td>$\${p.revenue.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:\${sellRate}; background:var(--accent-color); height:6px;"></div>
                </div> \${sellRate}</td>
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
                if(h === 11 && m < 28) continue;
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
                minuteStats[hm].tickets += 1; // Assuming 1 record = 1 ticket
                
                if(method.includes('信用卡') || method.includes('Credit')) {
                    minuteStats[hm].creditTickets += 1;
                } else if (method.includes('ATM')) {
                    minuteStats[hm].atmTickets += 1;
                }
            }
        });

        // 整理 GA 的連線、排隊數量到每分鐘
        gaSessions.forEach(s => {
            if(!s.CreateTime) return;
            const hm = String(s.CreateTime).slice(11, 16); // 抽出 HH:mm
            if(minuteStats[hm]) {
                minuteStats[hm].sessionCount = Math.max(minuteStats[hm].sessionCount, s.SessionCount || 0);
            }
        });

        gaReads.forEach(r => {
            if(!r.CreateTime) return;
            const hm = String(r.CreateTime).slice(11, 16); // 抽出 HH:mm
            if(minuteStats[hm]) {
                const d = r.ActiveUsersDMinCount === 'NULL' ? 0 : Number(r.ActiveUsersDMinCount);
                const a = r.ActiveUsersAMinCount === 'NULL' ? 0 : Number(r.ActiveUsersAMinCount);
                minuteStats[hm].activeDMin = Math.max(minuteStats[hm].activeDMin, d);
                minuteStats[hm].activeAMin = Math.max(minuteStats[hm].activeAMin, a);
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
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--success-color);">\${t.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--success-color); font-weight: 600;">\${cumT.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary);">\${c.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary); font-weight: 600;">\${cumC.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary);">\${a.toLocaleString()}</td>
                <td style="text-align: right; border-bottom: 1px solid #444; border-right: 1px solid #444; color: var(--text-primary); font-weight: 600;">\${cumA.toLocaleString()}</td>
                <td style="text-align: center; border-bottom: 1px solid #444; color: #ffd700; font-weight: 600;">\${rate}</td>
            \`;
            minBody.appendChild(tr);
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
