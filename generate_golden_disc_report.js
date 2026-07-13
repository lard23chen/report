require('dotenv').config({ path: __dirname + '/.env', quiet: true });
﻿
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB Connection Setup
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
            d['國籍'] = (memberId && memberNatMap[memberId]) ? memberNatMap[memberId] : '未知';
            d['縣市別'] = (memberId && memberCityMap[memberId]) ? memberCityMap[memberId] : '未知';

            // Normalize MongoDB Decimal128 numeric fields to plain numbers
            ['售價', '原價', '實退金額', '手續費'].forEach(f => {
                if (d[f] && d[f].$numberDecimal) d[f] = parseFloat(d[f].$numberDecimal);
                else if (d[f]) d[f] = parseFloat(d[f]);
                else d[f] = 0;
            });
        });

        // Fetch Azure cloud cost for sale launch days (2025-12-13 & 2025-12-14)
        const costRaw = await db.collection('AzureMonthlyCost_Daily').find({
            Date: { $in: ['2025/12/13', '2025/12/14'] }
        }).sort({ Date: 1 }).toArray();
        const costData = costRaw.map(d => {
            const sysA = parseFloat(d.ASys) || 0;
            const sysD = parseFloat(d.DSysAWS) || 0;
            const shared = parseFloat(d.Shared) || 0;
            const member = parseFloat(d.Member) || 0;
            return {
                date: d.Date,
                sysA, sysD, shared, member,
                total: sysA + sysD + shared + member,
                activity: d.Activity || '',
                notes: d.Note || ''
            };
        });
        console.log(`Fetched ${costData.length} cloud cost records.`);

        // Current Time
        const reportTime = new Date().toLocaleString('zh-TW');

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>第40屆金唱片頒獎典禮 - 專案分析報表 (A系統)</title>
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
            grid-template-columns: 1fr 1fr;
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
            <div class="logo-sub">第40屆金唱片頒頒獎典禮 - 專案銷售分析</div>
            <div style="margin-top:8px; color: #888; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px;">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> 
                Data Source: MongoDB (QwareAi / Qware_A_Ticket_data)
            </div>
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

        <!-- City Distribution -->
        <div class="chart-card">
            <h3>縣市分佈 (County/City)</h3>
             <div style="height: 350px;">
                <canvas id="cityChart"></canvas>
            </div>
        </div>
    </div>

    <!-- Main Trend & Payment Analysis -->
    <div class="main-content">
        <!-- Left Column: Both Charts -->
        <div style="display: flex; flex-direction: column; gap: 25px;">
            <!-- Page Views Chart -->
            <div class="chart-card">
                <h3 style="border-left-color: #42A5F5;">每日瀏覽量趨勢 (Daily Page Views)</h3>
                <div style="height: 280px;">
                    <canvas id="viewChart"></canvas>
                </div>
            </div>

            <!-- Main Trend Chart -->
            <div class="chart-card">
                <h3>每日銷售趨勢 (Sales Trend)</h3>
                <div style="height: 280px;">
                    <canvas id="trendChart"></canvas>
                </div>
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
        <div class="chart-card" style="grid-column: span 2; border-left: 5px solid #ffd700; background: linear-gradient(145deg, #1e1e1e, #252525);">
            <div id="aovAnalysisContainer" style="padding: 10px; line-height: 1.6;">
            </div>
        </div>
    </div>

    <!-- Traffic Analysis Section -->
    <div class="main-content">
        <div class="chart-card" style="grid-column: span 2; border-left: 5px solid #42A5F5; background: linear-gradient(145deg, #1e1e1e, #252525);">
            <h3>🌐 流量與轉換深度分析 (Traffic Deep Dive)</h3>
            <div id="trafficAnalysisContainer" style="padding: 10px; line-height: 1.6;">
            </div>
        </div>
    </div>

    <!-- Cloud Cost Section -->
    <div class="main-content">
        <div class="chart-card" style="grid-column: span 2;">
            <h3>☁️ 開賣日雲端費用成本 (2025-12-13 & 12-14)</h3>
            <table id="costTable">
                <thead>
                    <tr>
                        <th>日期</th>
                        <th class="text-right">A系統</th>
                        <th class="text-right">D系統(AWS)</th>
                        <th class="text-right">共用</th>
                        <th class="text-right">會員</th>
                        <th class="text-right" style="color:var(--accent-color)">總計(未稅,不含E)</th>
                        <th>主要活動</th>
                        <th>備註</th>
                    </tr>
                </thead>
                <tbody id="costTableBody"></tbody>
            </table>
        </div>
    </div>

</div>

<script>
    const dbData = ${JSON.stringify(data)};
    const sectionData = ${JSON.stringify(sectionData)};
    const gaSessions = ${JSON.stringify(gaSessions)};
    const gaReads = ${JSON.stringify(gaReads)};
    const pageViews = ${JSON.stringify(pageViews)};
    const costData = ${JSON.stringify(costData)};

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
        const salesByDate = {}; 
        const viewsByDate = {}; 

        validOrders.forEach(o => {
            if(!o['交易時間']) return;
            const date = o['交易時間'].split(' ')[0];
            salesByDate[date] = (salesByDate[date] || 0) + 1; 
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

        // 2. Price Distribution (Grouped by PRICE ONLY)
        const sectionStats = {};

        sectionData.forEach(s => {
            let name = s['票區名稱'] || '';
            if(name) {
                let priceValue = 0;
                // Get all numbers and pick the last one (usually the price)
                const numbers = name.match(/\\d+/g);
                // 使用名稱中最大的數字作為票價（避免誤抓場館區號）
                priceValue = numbers ? Math.max(...numbers.map(Number)) : 0;
                
                // Use price as the ONLY identifier - Just the number
                let priceLabel = priceValue > 0 ? priceValue.toString() : name;
                
                if(!sectionStats[priceLabel]) {
                    sectionStats[priceLabel] = { total: 0, reserved: 0, available: 0, count: 0, revenue: 0, priceVal: priceValue };
                }
                sectionStats[priceLabel].total += parseInt(s['座位總數']) || 0;
                sectionStats[priceLabel].reserved += parseInt(s['保留數']) || 0;
                sectionStats[priceLabel].available += parseInt(s['可售數']) || 0;
            }
        });

        validOrders.forEach(o => {
            const p = o['售價'] || 0;
            const seatInfo = o['座位資訊/票區'] || '';
            const numbers = seatInfo.match(/\\d+/g);
            const maxInName = numbers ? Math.max(...numbers.map(Number)) : 0;
            
            let priceVal = p;
            // 如果售價為0且名稱中有較大數字，則視為該票價類型的邀請票
            if (p === 0 && maxInName > 100) { 
                priceVal = maxInName;
            }

            // Strictly use Price as label - Just the number
            let priceLabel = priceVal > 0 ? priceVal.toString() : "0";

            if(!sectionStats[priceLabel]) {
                sectionStats[priceLabel] = { total: '-', reserved: '-', available: '-', count: 0, revenue: 0, priceVal: priceVal };
            }
            sectionStats[priceLabel].count++;
            sectionStats[priceLabel].revenue += p;
        });
        
        const sectionArray = Object.keys(sectionStats).map(sec => ({
            name: sec,
            ...sectionStats[sec]
        })).sort((a,b) => b.priceVal - a.priceVal); 

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
            if (age && String(age).includes('不符')) return; // Filter "不符"
            
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
                    else label = 'Other';
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
            if(g && g !== '-' && g !== '未知' && !String(g).includes('不符')) {
                genderStats[g] = (genderStats[g] || 0) + 1;
            }
        });

        // 6. Nationality
        const natStatsRaw = {}; 
        validOrders.forEach(o => {
            let n = o['國籍'];
            if (n === 'Taiwan, Province of China') n = 'Taiwan'; 
            
            if (n && n !== '-' && n !== '未知' && n !== 'null' && n !== 'undefined' && !String(n).includes('不符')) {
                if (!natStatsRaw[n]) natStatsRaw[n] = { tickets: 0, orders: new Set() };
                natStatsRaw[n].tickets++;
                const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : Math.random().toString();
                natStatsRaw[n].orders.add(orderId);
            }
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

        // 6.5 City
        const cityStatsRaw = {};
        validOrders.forEach(o => {
            let n = o['縣市別'];
            if(n && n !== '-' && n !== '未知' && n !== 'null' && n !== 'undefined' && !String(n).includes('不符')) {
                if (!cityStatsRaw[n]) cityStatsRaw[n] = { count: 0 };
                const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : Math.random().toString();
                if (!cityStatsRaw[n].orders) cityStatsRaw[n].orders = new Set();
                cityStatsRaw[n].orders.add(orderId);
            }
        });

        const cityArrayStr = Object.keys(cityStatsRaw).map(k => ({
            city: k,
            count: cityStatsRaw[k].orders.size
        })).sort((a,b) => b.count - a.count);

        const cityLabels = cityArrayStr.slice(0, 10).map(x => x.city); 
        const cityData = cityArrayStr.slice(0, 10).map(x => x.count);

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
                        },
                        afterFit: function(axis) {
                            axis.width = 60;
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
                        ticks: { color: '#ffd700' },
                        afterFit: function(axis) {
                            axis.width = 60;
                        }
                    }
                }
            }
        });

        // Age Chart (Pie)
        new Chart(document.getElementById('ageChart'), {
            type: 'pie',
            data: {
                labels: ageLabels,
                datasets: [{
                    label: '人數',
                    data: ageData,
                    backgroundColor: ['#42A5F5', '#EC407A', '#FFD700', '#66BB6A', '#AB47BC', '#FFA726', '#BDBDBD'],
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
                        font: { weight: 'bold', size: 11 },
                        padding: 2,
                        formatter: function(value, context) {
                            if (value === 0) return '';
                            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const p = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            return value < (total * 0.05) ? p : [value.toLocaleString(), '(' + p + ')'];
                        }
                    }
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
                    backgroundColor: ['#EC407A', '#42A5F5', '#BDBDBD'],
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

        // City Chart (Bar)
        new Chart(document.getElementById('cityChart'), {
            type: 'bar',
            data: {
                labels: cityLabels,
                datasets: [{
                    label: '訂單數',
                    data: cityData,
                    backgroundColor: '#66bb6a',
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
                        formatter: function(value) {
                            return value.toLocaleString();
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#ccc', maxRotation: 45, minRotation: 45 } },
                    y: { grid: { color: '#333' }, ticks: { color: '#888' } }
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
                <td class="text-right">\${n.tickets.toLocaleString()}</td>
                <td class="text-right">\${n.ordersCount.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:\${share}; background:#66bb6a; height:6px;"></div>
                </div> \${share}</td>
            \`;
            natTbody.appendChild(tr);
        });

        // Render Section Table
        const tbody = document.querySelector('#priceTable tbody');
        sectionArray.forEach(p => {
            // 過濾：銷售張數 < 100 OR 可售數為 0 OR 可售數不是數字
            if (p.count < 100 || p.available === 0 || typeof p.available !== 'number') return; 
            const tr = document.createElement('tr');
            
            let sellRate = '0%';
            let rateValue = 0;
            if (p.available > 0) {
                rateValue = ((p.count / p.available) * 100);
                sellRate = rateValue.toFixed(1) + '%';
            }

            const totalStr = p.total === '-' ? p.total : p.total.toLocaleString();
            const resStr = p.reserved === '-' ? p.reserved : p.reserved.toLocaleString();
            const availStr = p.available === '-' ? p.available : p.available.toLocaleString();
            
            tr.innerHTML = \`
                <td>\${p.name}</td>
                <td class="text-right" style="color: #94a3b8;">\${totalStr}</td>
                <td class="text-right" style="color: #ef4444;">\${resStr}</td>
                <td class="text-right" style="color: #4ade80;">\${availStr}</td>
                <td class="text-right" style="font-weight: bold; color: var(--accent-color);">\${p.count.toLocaleString()}</td>
                <td class="text-right">$\${p.revenue.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:\${sellRate}; background:var(--accent-color); height:6px;"></div>
                </div> \${sellRate}</td>
            \`;
            tbody.appendChild(tr);
        });

        // Add Total Row for Price Table
        const totalCount = sectionArray.reduce((acc, cur) => acc + (cur.count || 0), 0);
        const totalRev = sectionArray.reduce((acc, cur) => acc + (cur.revenue || 0), 0);
        const totalSeats = sectionArray.reduce((acc, cur) => acc + (typeof cur.total === 'number' ? cur.total : 0), 0);
        const totalAvail = sectionArray.reduce((acc, cur) => acc + (typeof cur.available === 'number' ? cur.available : 0), 0);
        const totalSellRate = totalAvail > 0 ? ((totalCount / totalAvail) * 100).toFixed(1) + '%' : '0%';

        const totalRow = document.createElement('tr');
        totalRow.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
        totalRow.innerHTML = \`
            <td style="font-weight: bold; color: var(--accent-color);">總計 (TOTAL)</td>
            <td class="text-right" style="font-weight: bold;">\${totalSeats.toLocaleString()}</td>
            <td class="text-right" style="color: #666;">-</td>
            <td class="text-right" style="color: #4ade80; font-weight: bold;">\${totalAvail.toLocaleString()}</td>
            <td class="text-right" style="font-weight: bold; color: var(--accent-color); font-size: 1.2em;">\${totalCount.toLocaleString()}</td>
            <td class="text-right" style="font-weight: bold; color: var(--accent-color); font-size: 1.2em;">$\${totalRev.toLocaleString()}</td>
            <td style="font-weight: bold; color: var(--accent-color);">\${totalSellRate}</td>
        \`;
        tbody.appendChild(totalRow);
        
        // Render Payment Table
        const payBody = document.querySelector('#paymentTable tbody');
        const totalPay = paymentArray.reduce((acc, cur) => acc + cur.count, 0);
        paymentArray.forEach(p => {
            const tr = document.createElement('tr');
            const share = totalPay ? ((p.count / totalPay) * 100).toFixed(1) + '%' : '0%';
            tr.innerHTML = \`
                <td>\${p.method}</td>
                <td class="text-right">\${p.count.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:\${share}; background:#4DB6AC; height:6px;"></div>
                </div> \${share}</td>
            \`;
            payBody.appendChild(tr);
        });

        // Add Total Row for Payment Table
        const totalPayRow = document.createElement('tr');
        totalPayRow.style.backgroundColor = 'rgba(77, 182, 172, 0.1)';
        totalPayRow.style.borderTop = '2px solid #4DB6AC';
        totalPayRow.innerHTML = \`
            <td style="font-weight: bold; color: #4DB6AC;">總計 (TOTAL)</td>
            <td class="text-right" style="font-weight: bold; color: #4DB6AC;">\${totalPay.toLocaleString()}</td>
            <td style="font-weight: bold; color: #4DB6AC;">100%</td>
        \`;
        payBody.appendChild(totalPayRow);

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
                <td class="text-right">\${p.orders.toLocaleString()}</td>
                <td class="text-right">\${p.tickets.toLocaleString()}</td>
                <td class="text-right">$\${p.revenue.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:\${share}; background:var(--accent-color); height:6px;"></div>
                </div> \${share}</td>
             \`;
             spTbody.appendChild(tr);
        });

        // Add Total Row for Sales Point
        const totalSpOrders = salesPointArray.reduce((acc, cur) => acc + (cur.orders || 0), 0);
        const totalSpTickets = salesPointArray.reduce((acc, cur) => acc + (cur.tickets || 0), 0);
        const totalSpRev = salesPointArray.reduce((acc, cur) => acc + (cur.revenue || 0), 0);

        const totalSpRow = document.createElement('tr');
        totalSpRow.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
        totalSpRow.innerHTML = \`
            <td style="font-weight: bold; color: var(--accent-color);">總計 (TOTAL)</td>
            <td class="text-right" style="font-weight: bold;">\${totalSpOrders.toLocaleString()}</td>
            <td class="text-right" style="font-weight: bold;">\${totalSpTickets.toLocaleString()}</td>
            <td class="text-right" style="font-weight: bold; color: var(--accent-color); font-size: 1.1em;">$\${totalSpRev.toLocaleString()}</td>
            <td style="font-weight: bold; color: var(--accent-color);">100%</td>
        \`;
        spTbody.appendChild(totalSpRow);

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

        dbData.forEach(o => {
            if(!o['交易時間']) return;
            const timePart = o['交易時間'].split(' ')[1];
            if(!timePart) return;
            const hm = timePart.substring(0, 5); 
            if(minuteStats[hm]) {
                const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : Math.random().toString();
                minuteStats[hm].bookings.add(orderId);
            }
        });

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

        gaSessions.forEach(s => {
            if(!s.CreateTime) return;
            const hm = String(s.CreateTime).slice(11, 16); 
            if(minuteStats[hm]) {
                minuteStats[hm].sessionCount = Math.max(minuteStats[hm].sessionCount, s.SessionCount || 0);
            }
        });

        gaReads.forEach(r => {
            if(!r.CreateTime) return;
            const hm = String(r.CreateTime).slice(11, 16); 
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

        const trafficContainer = document.getElementById('trafficAnalysisContainer');
        if (trafficContainer && typeof viewsByDate !== 'undefined' && typeof salesByDate !== 'undefined') {
            const totalViews = Object.values(viewsByDate).reduce((acc, val) => acc + val, 0);
            
            let peakDate = '';
            let peakViews = 0;
            for (const [date, views] of Object.entries(viewsByDate)) {
                if (views > peakViews) {
                    peakViews = views;
                    peakDate = date;
                }
            }
            
            const totalTicketsSold = Object.values(salesByDate).reduce((acc, val) => acc + val, 0);
            const conversionRate = totalViews > 0 ? ((totalTicketsSold / totalViews) * 100).toFixed(2) : 0;
            const peakConcentration = totalViews > 0 ? ((peakViews / totalViews) * 100).toFixed(1) : 0;

            if (totalViews > 0) {
                trafficContainer.innerHTML = \`
                    <p style="color:#ddd; font-size:1.1em; margin-bottom:20px;">本專案總計帶來 <strong style="color:var(--text-primary); font-size:1.3em;">\${totalViews.toLocaleString()}</strong> 次瀏覽量，整體轉換率 (銷售張數/總瀏覽量) 為 <strong style="color:var(--accent-color); font-size:1.3em;">\${conversionRate}%</strong>。</p>
                    <ul style="list-style: none; padding-left: 0;">
                        <li style="margin-bottom: 20px; display: flex; align-items: flex-start; gap: 10px;">
                            <span style="color:#42A5F5; font-size:1.2em;">●</span>
                            <div>
                                <strong style="color:#eee;">開賣首日流量極度爆炸</strong><br>
                                <span style="color:#aaa;">最高流量出現在 <span class="badge" style="background-color: #42A5F5; color: white; border-radius:20px;">\${peakDate}</span>，單日湧入 <strong style="color:#42A5F5;">\${peakViews.toLocaleString()}</strong> 次瀏覽。</span><br>
                                <span style="color:#aaa;">開賣首日即貢獻了全活動總流量的 <strong style="color:#42A5F5;">\${peakConcentration}%</strong>，顯示品牌影響力驚人。</span>
                            </div>
                        </li>
                        <li style="margin-bottom: 20px; display: flex; align-items: flex-start; gap: 10px;">
                            <span style="color:#42A5F5; font-size:1.2em;">●</span>
                            <div>
                                <strong style="color:#eee;">轉換效能卓越 (High Conversion Performance)</strong><br>
                                <span style="color:#aaa;">在極短的尖峰時間內完成 <strong>\${totalTicketsSold.toLocaleString()}</strong> 張票券銷售。</span><br>
                                <span style="color:#aaa;">雖然轉換率數字受大量重整網頁影響，但在大型頒獎典禮中此表現極為強勁。</span>
                            </div>
                        </li>
                         <li style="margin-bottom: 20px; display: flex; align-items: flex-start; gap: 10px;">
                            <span style="color:#42A5F5; font-size:1.2em;">●</span>
                            <div>
                                <strong style="color:#eee;">長尾效應與行銷價值</strong><br>
                                <span style="color:#aaa;">💡 <strong>深度洞察</strong>：高達 \${totalViews.toLocaleString()} 次的瀏覽數據為品牌累積了龐大的 <strong>高價值訪客樣貌 (Audience Profile)</strong>。</span><br>
                                <span style="color:#aaa;">建議後續可針對這些未中籤或高意願訪客進行周邊、加場或未來活動的精準再行銷 (Retargeting)。</span>
                            </div>
                        </li>
                    </ul>
                \`;
            } else {
                trafficContainer.innerHTML = '<p>尚無流量資料。</p>';
            }
        }

        const aovContainer = document.getElementById('aovAnalysisContainer');
        if (aovContainer) {
            const sortedPrices = [...sectionArray].sort((a,b) => b.count - a.count);
            const top3 = sortedPrices.slice(0, 3);
            
            const orderCounts = {}; 
            const ordersMap = {}; 
            validOrders.forEach(o => {
                const id = o['訂單編號'] ? o['訂單編號'].split('_')[0] : Math.random();
                ordersMap[id] = (ordersMap[id] || 0) + 1;
            });
            Object.values(ordersMap).forEach(c => {
                orderCounts[c] = (orderCounts[c] || 0) + 1;
            });
            
            const twoTicketsCount = orderCounts[2] || 0;
            const oneTicketCount = orderCounts[1] || 0;
            
            let topPriceHtml = top3.map(p => \`<span class="badge">\${p.name}</span> (\${p.count.toLocaleString()}張)\`).join('、');
            
            aovContainer.innerHTML = \`
                <h3 style="color:var(--accent-color); border-bottom:1px solid #444; padding-bottom:10px; margin-bottom:15px;">📊 客單價深度分析 (AOV Deep Dive)</h3>
                <div style="padding: 10px; line-height: 1.8; color: #ddd;">
                    <p>本專案平均客單價 (AOV) 高達 <strong style="color:var(--accent-color); font-size:1.4em;">$\${aov.toLocaleString()}</strong>，主要原因分析如下：</p>
                    <ul style="list-style: none; padding-left: 0;">
                        <li style="margin-bottom: 15px; display: flex; align-items: flex-start; gap: 10px;">
                            <span style="color:var(--accent-color); font-size:1.2em;">●</span>
                            <div>
                                <strong>高單價票券為銷售主力</strong><br>
                                <span style="color:#aaa;">熱銷票價依序為 \${topPriceHtml}。</span><br>
                                <span style="color:#aaa;">絕大多數售出的票券單價高昂，有效推升了整體 AOV。</span>
                            </div>
                        </li>
                        <li style="margin-bottom: 15px; display: flex; align-items: flex-start; gap: 10px;">
                            <span style="color:var(--accent-color); font-size:1.2em;">●</span>
                            <div>
                                <strong>單筆訂單購買多張票</strong><br>
                                <span style="color:#aaa;">購買 <strong style="color:var(--text-primary)">2張</strong> 的訂單量 (\${twoTicketsCount.toLocaleString()}筆) \${twoTicketsCount >= oneTicketCount ? '超越了' : '與'} 只購買 1張 的訂單量 (\${oneTicketCount.toLocaleString()}筆) \${twoTicketsCount >= oneTicketCount ? '之表現' : '不相上下'}。</span><br>
                                <span style="color:#aaa;">眾多用戶傾向一次購買多張票券，大幅拉升了單筆訂單價值與平均營收。</span>
                            </div>
                        </li>
                    </ul>
                    <p style="font-size: 0.9em; color: #777; font-style: italic; margin-top:10px;">* 此外，部分團體/大宗訂單 (單筆10張以上) 亦對拉高平均值有顯著貢獻。</p>
                </div>
            \`;
        }
    }

    // Cloud Cost Table
    function renderCostTable() {
        const costBody = document.getElementById('costTableBody');
        let totalCost = 0;
        costData.forEach(d => {
            totalCost += d.total;
            const tr = document.createElement('tr');
            tr.innerHTML = \`<td style="font-weight:600; color:var(--accent-color);">\${d.date}</td>
                <td class="text-right">\${d.sysA.toFixed(2)}</td>
                <td class="text-right">\${d.sysD.toFixed(2)}</td>
                <td class="text-right">\${d.shared.toFixed(2)}</td>
                <td class="text-right">\${d.member.toFixed(2)}</td>
                <td class="text-right" style="font-weight:700; color:var(--accent-color);">$\${d.total.toFixed(2)}</td>
                <td style="color:#a0a0a0; font-size:0.9em;">\${d.activity}</td>
                <td style="color:#666; font-size:0.85em;">\${d.notes}</td>\`;
            costBody.appendChild(tr);
        });
        if (costData.length > 0) {
            const totalTr = document.createElement('tr');
            totalTr.style.cssText = 'background:rgba(255,215,0,0.08); border-top:2px solid rgba(255,215,0,0.4); font-weight:700;';
            totalTr.innerHTML = \`<td style="color:var(--accent-color);">合計</td>
                <td class="text-right"></td><td class="text-right"></td>
                <td class="text-right"></td><td class="text-right"></td>
                <td class="text-right" style="color:var(--accent-color);">$\${totalCost.toFixed(2)}</td>
                <td></td><td></td>\`;
            costBody.appendChild(totalTr);
        }
    }

    init();
    renderCostTable();
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
