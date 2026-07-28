require('dotenv').config({ path: __dirname + '/.env', quiet: true });
﻿const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

function parsePrice(val) {
    if (!val) return 0;
    if (val.$numberDecimal) return parseFloat(val.$numberDecimal);
    if (typeof val === 'number') return val;
    return parseFloat(val) || 0;
}

async function generateDailyReport() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_A_Ticket_data_Daily');

        console.log("Fetching all data from Qware_A_Ticket_data_Daily (excluding B-prefix orders)...");
        const data = await collection.find({ "訂單編號": { $not: /^B/ } }).toArray();
        console.log(`Fetched ${data.length} records.`);

        // Normalize date format
        data.forEach(d => {
            if (d['交易時間'] && d['交易時間'].includes('/')) {
                d['交易時間'] = d['交易時間'].replace(/\//g, '-');
            }
        });

        // ============ SERVER-SIDE AGGREGATION ============
        const totalRows = data.length;
        const validOrders = data.filter(d => d['狀態'] === '正常');
        const refundDocs = data.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');

        // Summary stats
        let totalRevenue = 0;
        const uniqueOrdersAll = new Set();
        validOrders.forEach(o => {
            totalRevenue += parsePrice(o['售價']);
            if (o['訂單編號']) uniqueOrdersAll.add(o['訂單編號'].split('_')[0]);
        });
        const totalTickets = validOrders.length;
        const totalOrders = uniqueOrdersAll.size;
        const aov = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;
        const totalRefundedTickets = refundDocs.length;
        const totalRefundFees = refundDocs.reduce((a, c) => a + parsePrice(c['手續費']), 0);

        // Daily stats
        const dailyMap = {};
        data.forEach(item => {
            if (!item['交易時間']) return;
            const date = item['交易時間'].split(' ')[0];
            if (!dailyMap[date]) dailyMap[date] = { orders: new Set(), tickets: 0, revenue: 0, eTickets: 0, paperTickets: 0, refundTickets: 0, refundFees: 0 };
            const d = dailyMap[date];
            const price = parsePrice(item['售價']);
            const orderId = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'unknown';
            if (item['狀態'] === '正常') {
                d.orders.add(orderId);
                d.tickets += 1;
                d.revenue += price;
                // 取票方式：未列印=電子票、已取=紙票（與銷售排行/週報/月報判定一致）
                if (item['取票方式'] === '未列印') d.eTickets += 1;
                else if (item['取票方式'] === '已取') d.paperTickets += 1;
            } else if (item['狀態'] === '已退票' || item['狀態'] === '退票') {
                d.refundTickets += 1;
                d.refundFees += parsePrice(item['手續費']);
            }
        });
        const dailyStats = Object.keys(dailyMap).sort().reverse().map(date => ({
            date,
            orders: dailyMap[date].orders.size,
            tickets: dailyMap[date].tickets,
            eTickets: dailyMap[date].eTickets,
            paperTickets: dailyMap[date].paperTickets,
            revenue: dailyMap[date].revenue,
            refundTickets: dailyMap[date].refundTickets,
            refundFees: dailyMap[date].refundFees
        }));

        // Sales by date (for trend chart, ascending)
        const salesByDate = {};
        validOrders.forEach(item => {
            if (!item['交易時間']) return;
            const date = item['交易時間'].split(' ')[0];
            salesByDate[date] = (salesByDate[date] || 0) + parsePrice(item['售價']);
        });
        const trendDates = Object.keys(salesByDate).sort();
        const trendSales = trendDates.map(d => salesByDate[d]);

        // Daily top ticket event (by transaction date)
        const dailyEventTicketMap = {};
        validOrders.forEach(item => {
            if (!item['交易時間']) return;
            const date = item['交易時間'].split(' ')[0];
            const name = item['節目/商品名稱'] || 'Unknown';
            if (!dailyEventTicketMap[date]) dailyEventTicketMap[date] = {};
            dailyEventTicketMap[date][name] = (dailyEventTicketMap[date][name] || 0) + 1;
        });
        const dailyTopTicketEvent = trendDates.map(date => {
            const events = dailyEventTicketMap[date];
            if (!events) return { name: '', tickets: 0 };
            const top = Object.entries(events).sort((a, b) => b[1] - a[1])[0];
            return { name: top[0], tickets: top[1] };
        });

        // Refund trend
        const dailyRefundsMap = {};
        refundDocs.forEach(item => {
            let dateStr = item['退票時間'];
            if (!dateStr || dateStr === '-') dateStr = item['交易時間'];
            if (!dateStr) return;
            const date = dateStr.split(' ')[0];
            dailyRefundsMap[date] = (dailyRefundsMap[date] || 0) + parsePrice(item['手續費']);
        });
        const refundTrendDates = Object.keys(dailyRefundsMap).sort();
        const refundTrendAmounts = refundTrendDates.map(d => dailyRefundsMap[d]);

                // Top 5 events by revenue
        const eventStats = {};
        const eventSessions = {}; // Store dates for session analysis
        validOrders.forEach(item => {
            const name = item['節目/商品名稱'] || 'Unknown';
            const price = parsePrice(item['售價']);
            const orderId = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'unknown';
            if (!eventStats[name]) eventStats[name] = { orders: new Set(), tickets: 0, revenue: 0, eTickets: 0, paperTickets: 0 };
            eventStats[name].orders.add(orderId);
            eventStats[name].tickets += 1;
            eventStats[name].revenue += price;
            // 取票方式：未列印=電子票、已取=紙票（與週報/月報/report_index 判定一致）
            if (item['取票方式'] === '未列印') eventStats[name].eTickets += 1;
            else if (item['取票方式'] === '已取') eventStats[name].paperTickets += 1;

            // Session tracking
            if (!eventSessions[name]) eventSessions[name] = {};
            if (item['場次名稱']) {
               let sName = item['場次名稱'];
               let sDate = '';
               if (item['演出時間/規格'] && item['演出時間/規格'].trim() !== '') {
                   // Split by space to just get the YYYY-MM-DD part, or keep full if needed
                   sDate = item['演出時間/規格'].split(' ')[0];
                   sName += ` (${sDate})`;
               }
               if (!eventSessions[name][sName]) eventSessions[name][sName] = { orders: new Set(), tickets: 0, revenue: 0, date: sDate };
               eventSessions[name][sName].orders.add(orderId);
               eventSessions[name][sName].tickets += 1;
               eventSessions[name][sName].revenue += price;
               if (!eventSessions[name][sName].date && sDate) eventSessions[name][sName].date = sDate;
            }
        });
        const topByRevenue = Object.entries(eventStats)
            .map(([name, s]) => {
                let sessions = [];
                if (eventSessions[name] && Object.keys(eventSessions[name]).length > 0) {
                    sessions = Object.entries(eventSessions[name])
                        .map(([sName, ss]) => ({ name: sName, orders: ss.orders.size, tickets: ss.tickets, revenue: ss.revenue, shareName: s.revenue ? (ss.revenue / s.revenue * 100).toFixed(1) : '0', date: ss.date }))
                        .sort((a,b) => {
                            if (a.date && b.date) {
                                if (a.date === b.date) return b.revenue - a.revenue;
                                return a.date.localeCompare(b.date); // ASC (由近到遠)
                            }
                            if (a.date) return -1;
                            if (b.date) return 1;
                            return b.revenue - a.revenue;
                        });
                }
                return { name, orders: s.orders.size, tickets: s.tickets, eTickets: s.eTickets, paperTickets: s.paperTickets, revenue: s.revenue, share: totalRevenue ? (s.revenue / totalRevenue * 100).toFixed(1) : '0', sessions };
            })
            .sort((a, b) => b.revenue - a.revenue).slice(0, 5);
        const topByTickets = Object.entries(eventStats)
            .map(([name, s]) => ({ name, orders: s.orders.size, tickets: s.tickets, eTickets: s.eTickets, paperTickets: s.paperTickets, revenue: s.revenue }))
            .sort((a, b) => b.tickets - a.tickets).slice(0, 5);

        // Top 5 refund events
        const refStats = {};
        refundDocs.forEach(item => {
            const name = item['節目/商品名稱'] || 'Unknown';
            const fee = parsePrice(item['手續費']);
            const orderId = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'unknown';
            if (!refStats[name]) refStats[name] = { orders: new Set(), tickets: 0, amount: 0 };
            refStats[name].orders.add(orderId);
            refStats[name].tickets += 1;
            refStats[name].amount += fee;
        });
        const topRefunds = Object.entries(refStats)
            .map(([name, s]) => ({ name, orders: s.orders.size, tickets: s.tickets, amount: s.amount }))
            .sort((a, b) => b.amount - a.amount).slice(0, 5);

        // Payment methods
        const paymentStats = {};
        validOrders.forEach(item => {
            const method = item['付款方式'] || 'Unknown';
            const price = parsePrice(item['售價']);
            const orderId = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'unknown';
            if (!paymentStats[method]) paymentStats[method] = { orders: new Set(), tickets: 0, revenue: 0 };
            paymentStats[method].orders.add(orderId);
            paymentStats[method].tickets += 1;
            paymentStats[method].revenue += price;
        });
        const paymentList = Object.entries(paymentStats)
            .map(([name, s]) => ({ name, orders: s.orders.size, tickets: s.tickets, revenue: s.revenue, share: totalRevenue ? (s.revenue / totalRevenue * 100).toFixed(1) : '0' }))
            .sort((a, b) => b.revenue - a.revenue);

        // Sales points
        const spStats = {};
        validOrders.forEach(item => {
            const point = item['銷售點'] || 'Unknown';
            const price = parsePrice(item['售價']);
            const orderId = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'unknown';
            if (!spStats[point]) spStats[point] = { orders: new Set(), tickets: 0, revenue: 0 };
            spStats[point].orders.add(orderId);
            spStats[point].tickets += 1;
            spStats[point].revenue += price;
        });
        const salesPointList = Object.entries(spStats)
            .map(([name, s]) => ({ name, orders: s.orders.size, tickets: s.tickets, revenue: s.revenue, share: totalRevenue ? (s.revenue / totalRevenue * 100).toFixed(1) : '0' }))
            .sort((a, b) => b.revenue - a.revenue);

        // Build the aggregated data object (small ~10KB)
        const aggData = {
            totalRows, totalRevenue, totalTickets, totalOrders, aov, totalRefundedTickets, totalRefundFees,
            dailyStats,
            trendDates, trendSales, dailyTopTicketEvent,
            refundTrendDates, refundTrendAmounts,
            topByRevenue, topByTickets, topRefunds,
            paymentList, salesPointList
        };

        // Date range for title
        const allDates = data.map(d => d['交易時間'] ? new Date(d['交易時間'].split(' ')[0]) : null).filter(d => d && !isNaN(d.getTime()));
        let dateTitle = "每日分析報表 (A系統)";
        if (allDates.length > 0) {
            const minDate = new Date(allDates.reduce((min, d) => d < min ? d : min, allDates[0]));
            const maxDate = new Date(allDates.reduce((max, d) => d > max ? d : max, allDates[0]));
            const fmt = (d) => `${d.getFullYear()}年${String(d.getMonth()+1).padStart(2,'0')}月${String(d.getDate()).padStart(2,'0')}日`;
            dateTitle = `${fmt(minDate)} - ${fmt(maxDate)} 每日分析報表 (A系統)`;
        }

        const reportTime = new Date().toLocaleString('zh-TW');

        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, 'ibon_logo.png');
            if (fs.existsSync(logoPath)) {
                logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
            }
        } catch (err) {}

        const logoSrc = logoBase64 || 'https://ticket.ibon.com.tw/assets/img/logo.png';

        // ============ HTML TEMPLATE ============
        const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ibon售票系統 ${dateTitle} - ${reportTime}</title>
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
    <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #e0f7fa;
            --card-bg: #ffffff;
            --text-primary: #006064;
            --text-secondary: #00838f;
            --accent-color: #00acc1;
            --shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        body { font-family: 'Inter', sans-serif; background-color: var(--bg-color); color: var(--text-primary); margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        header { margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; background: white; padding: 20px; border-radius: 16px; box-shadow: var(--shadow); }
        h1 { margin: 0; font-weight: 600; color: var(--accent-color); }
        .meta { color: var(--text-secondary); font-size: 0.9em; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: var(--card-bg); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); border-left: 5px solid var(--accent-color); }
        .card h3 { margin: 0 0 10px 0; font-size: 0.85em; color: var(--text-secondary); opacity: 0.8; }
        .card .value { font-size: 1.8em; font-weight: 700; color: var(--accent-color); }
        .card .sub { font-size: 0.8em; color: #888; margin-top: 5px; }
        .charts-row { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
        .chart-container { background: var(--card-bg); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); flex: 1; min-width: 400px; min-height: 400px; }
        .table-container { background: var(--card-bg); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); overflow-x: auto; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #b2ebf2; font-size: 0.9em; }
        th { color: var(--text-secondary); font-weight: 600; white-space: nowrap; }
        td { white-space: nowrap; }
        tr:hover { background-color: #e0f7fa; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        @media print {
            @page { size: landscape; margin: 5mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
            .card, .chart-container, .table-container { box-shadow: none; border: 1px solid #ddd; break-inside: avoid; }
            button, a.fixed-btn { display: none !important; }
        }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div style="display: flex; align-items: center; gap: 20px;">
            <img src="${logoSrc}" alt="ibon Logo" style="height: 45px;">
            <div>
                <h1>ibon售票系統 ${dateTitle}</h1>\n<!-- Data Source Header -->\n<div style="margin-top:8px; color: #888; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px;">\n    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> \n    Data Source: MongoDB (QwareAi / Qware_A_Ticket_data_Daily) &middot; 已排除訂單編號 B 開頭之訂單\n</div>
                
            </div>
        </div>
        <div class="meta">
            產出時間: ${reportTime}<br>
            總資料筆數: <span id="meta-total-rows">--</span><br>
            製表者: 自動產出
        </div>
    </header>

    <div class="stats-grid">
        <div class="card"><h3>總營收 (Total Revenue)</h3><div class="value" id="val-revenue">--</div><div class="sub">含正常交易</div></div>
        <div class="card"><h3>客單價 (AOV)</h3><div class="value" id="val-aov">--</div><div class="sub">營收 / 訂單筆數</div></div>
        <div class="card"><h3>總交易張數 (Total Tickets)</h3><div class="value" id="val-tickets">--</div><div class="sub">總售出票券數量</div></div>
        <div class="card"><h3>總訂單筆數 (Distinct Orders)</h3><div class="value" id="val-orders">--</div><div class="sub">不重複訂單編號</div></div>
        <div class="card"><h3>總退票張數 (Refunded Tickets)</h3><div class="value" id="val-refund-tickets">--</div><div class="sub" style="color:#c62828;">已退票/退票狀態</div></div>
        <div class="card"><h3>退票手續費 (Refund Fees)</h3><div class="value" id="val-refund-fees">--</div><div class="sub">退票產生之營收</div></div>
    </div>

    <!-- Daily Transaction Stats Table -->
    <div class="table-container">
        <h3 style="color: var(--text-secondary); border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">📊 每日交易統計 (Daily Transaction Statistics)</h3>
        <table id="dailyStatsTable">
            <thead><tr>
                <th>日期 (Date)</th>
                <th class="text-right">購票筆數 (Orders)</th>
                <th class="text-right">購票張數 (Tickets)</th>
                <th class="text-right">電子票 (E-Ticket)</th>
                <th class="text-right">紙票 (Paper)</th>
                <th class="text-right">購票金額 (Revenue)</th>
                <th class="text-right">退票張數 (Refund)</th>
                <th class="text-right">退票手續費 (Fees)</th>
            </tr></thead>
            <tbody></tbody>
        </table>
        <div style="margin-top: 8px; text-align: right; font-size: 0.8em; color: #888;">* 購票筆數: 不重複訂單編號數 / 購票張數: 實際票券數量 / 電子票=取票方式「未列印」、紙票=「已取」，占比為占當日購票張數比例</div>
    </div>

    <div class="charts-row"><div class="chart-container" style="flex:100%;"><canvas id="trendChart"></canvas></div></div>
    <div class="charts-row"><div class="chart-container" style="flex:100%;"><canvas id="refundTrendChart"></canvas></div></div>

        <div class="table-container">
        <h3 style="color: var(--text-secondary); border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">🏆 銷售排行 Top 5 (By Revenue)</h3>
        <table id="topEventsTable"><thead><tr>
            <th style="width:50px;">Rank</th><th>節目名稱</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">電子票</th><th class="text-right">紙票</th><th class="text-right">金額</th><th class="text-right">佔比</th>
        </tr></thead><tbody></tbody></table>
        <div id="eventDetailModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:2000; justify-content:center; align-items:center;">
           <div style="background:white; margin:auto; margin-top:5%; padding:20px; border-radius:12px; max-width:800px; width:90%; max-height:80vh; overflow-y:auto; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
               <span onclick="document.getElementById('eventDetailModal').style.display='none'" style="position:absolute; right:20px; top:20px; font-size:24px; cursor:pointer; color:#888;">&times;</span>
               <h2 id="modalTitle" style="color:var(--text-primary); margin-top:0; border-bottom:2px solid var(--accent-color); padding-bottom:10px; font-size:1.2rem;">場次分析</h2>
               <table style="width:100%; margin-top:15px;">
                   <thead><tr><th style="text-align:left;">場次名稱</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">佔該節目比例</th></tr></thead>
                   <tbody id="modalBody"></tbody>
               </table>
           </div>
        </div>
    </div>

    <div class="table-container">
        <h3 style="color: var(--text-secondary); border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">🎟️ 銷售排行 Top 5 (By Tickets)</h3>
        <table id="topTicketsTable"><thead><tr>
            <th style="width:50px;">Rank</th><th>節目名稱</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">電子票</th><th class="text-right">紙票</th><th class="text-right">金額</th>
        </tr></thead><tbody></tbody></table>
    </div>

    <div class="table-container">
        <h3 style="color: #c62828; border-bottom: 2px solid #c62828; padding-bottom: 10px;">📉 退票手續費排行 Top 5</h3>
        <table id="topRefundTable"><thead><tr>
            <th style="width:50px;">Rank</th><th>節目名稱</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">手續費</th>
        </tr></thead><tbody></tbody></table>
    </div>

    <div class="table-container">
        <h3 style="color: var(--text-secondary); border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">💳 付款方式分析 (Payment Methods)</h3>
        <table id="paymentTable"><thead><tr>
            <th>付款方式</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">佔比</th>
        </tr></thead><tbody></tbody></table>
    </div>

    <div class="table-container">
        <h3 style="color: var(--text-secondary); border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">🏪 銷售點分析 (Sales Points)</h3>
        <table id="salesPointTable"><thead><tr>
            <th>銷售點</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">佔比</th>
        </tr></thead><tbody></tbody></table>
    </div>
</div>

<script>
const D = '__AGG_DATA__';

function fmt(n) { return n.toLocaleString(); }
function ntd(n) { return 'NT$ ' + fmt(n); }
function wan(n) { return 'NT$ ' + (n / 10000).toFixed(1) + ' 萬'; }
// 電子票/紙票儲存格：張數 + 占比小字
function ttc(cnt, total) { var p = total ? ((cnt||0)/total*100).toFixed(1) : '0.0'; return fmt(cnt||0)+'<span style="color:#888; font-size:0.85em;"> ('+p+'%)</span>'; }

function init() {
    document.getElementById('meta-total-rows').innerText = fmt(D.totalRows);
    document.getElementById('val-revenue').innerText = wan(D.totalRevenue);
    document.getElementById('val-tickets').innerText = fmt(D.totalTickets);
    document.getElementById('val-orders').innerText = fmt(D.totalOrders);
    document.getElementById('val-aov').innerText = ntd(D.aov);
    document.getElementById('val-refund-tickets').innerText = fmt(D.totalRefundedTickets);
    document.getElementById('val-refund-fees').innerText = ntd(D.totalRefundFees);

    // Daily Stats Table
    const dtb = document.querySelector('#dailyStatsTable tbody');
    let sO=0,sT=0,sR=0,sE=0,sP=0,sRT=0,sRF=0;
    D.dailyStats.forEach(d => {
        sO+=d.orders; sT+=d.tickets; sR+=d.revenue; sE+=(d.eTickets||0); sP+=(d.paperTickets||0); sRT+=d.refundTickets; sRF+=d.refundFees;
        const tr = document.createElement('tr');
        tr.innerHTML = '<td style="font-weight:500;">'+d.date+'</td>'
            +'<td class="text-right">'+fmt(d.orders)+'</td>'
            +'<td class="text-right">'+fmt(d.tickets)+'</td>'
            +'<td class="text-right">'+ttc(d.eTickets, d.tickets)+'</td>'
            +'<td class="text-right">'+ttc(d.paperTickets, d.tickets)+'</td>'
            +'<td class="text-right">'+wan(d.revenue)+'</td>'
            +'<td class="text-right" style="color:#c62828;">'+fmt(d.refundTickets)+'</td>'
            +'<td class="text-right" style="color:#c62828;">'+(d.refundFees>0?ntd(d.refundFees):'-')+'</td>';
        dtb.appendChild(tr);
    });
    const ttr = document.createElement('tr');
    ttr.style.fontWeight='bold'; ttr.style.borderTop='2px solid var(--accent-color)';
    ttr.innerHTML = '<td style="font-weight:700;">總計 (Total)</td>'
        +'<td class="text-right" style="color:var(--accent-color);">'+fmt(sO)+'</td>'
        +'<td class="text-right" style="color:var(--accent-color);">'+fmt(sT)+'</td>'
        +'<td class="text-right" style="color:var(--accent-color);">'+ttc(sE, sT)+'</td>'
        +'<td class="text-right" style="color:var(--accent-color);">'+ttc(sP, sT)+'</td>'
        +'<td class="text-right" style="color:var(--accent-color);">'+wan(sR)+'</td>'
        +'<td class="text-right" style="color:#c62828;">'+fmt(sRT)+'</td>'
        +'<td class="text-right" style="color:#c62828;">'+(sRF>0?ntd(sRF):'-')+'</td>';
    dtb.appendChild(ttr);

    // Register datalabels plugin
    Chart.register(ChartDataLabels);

    // Trend Chart
    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: { labels: D.trendDates, datasets: [{ label: '每日營收走勢', data: D.trendSales, borderColor: '#00acc1', backgroundColor: 'rgba(0,172,193,0.1)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: '營收趨勢圖 (Sales Trend)' }, tooltip: { mode: 'index', intersect: false, callbacks: { afterBody: items => { const top = D.dailyTopTicketEvent && D.dailyTopTicketEvent[items[0].dataIndex]; if (top && top.name) { const n = top.name.length > 22 ? top.name.substring(0,22)+'...' : top.name; return ['🎟 最高張數: '+n+' ('+top.tickets+'張)']; } return []; } } }, datalabels: { display: true, align: 'top', anchor: 'end', color: '#00acc1', font: { size: 10 }, formatter: (v, ctx) => { const revLabel = v >= 1000 ? '$'+(v/1000).toFixed(0)+'K' : '$'+v.toLocaleString(); const top = D.dailyTopTicketEvent && D.dailyTopTicketEvent[ctx.dataIndex]; if (top && top.name) { const n = top.name.length > 10 ? top.name.substring(0,10)+'…' : top.name; return [revLabel, n]; } return revLabel; } } } }
    });

    // Refund Chart
    new Chart(document.getElementById('refundTrendChart'), {
        type: 'line',
        data: { labels: D.refundTrendDates, datasets: [{ label: '每日退票手續費', data: D.refundTrendAmounts, borderColor: '#757575', backgroundColor: 'rgba(117,117,117,0.1)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: '每日退票走勢 (Daily Refund Trend)' } }, scales: { y: { beginAtZero: true, ticks: { callback: v => '$'+v.toLocaleString() } } } }
    });

    // Top Events by Revenue
    renderRankTable('#topEventsTable', D.topByRevenue, ['orders','tickets','eTickets','paperTickets','revenue','share'], 'var(--accent-color)');
    // Top Events by Tickets
    renderRankTable('#topTicketsTable', D.topByTickets, ['orders','tickets','eTickets','paperTickets','revenue'], 'var(--accent-color)');
    // Top Refunds
    renderRankTable('#topRefundTable', D.topRefunds, ['orders','tickets','amount'], '#c62828');

    // Payment Methods
    renderListTable('#paymentTable', D.paymentList, ['orders','tickets','revenue','share']);
    // Sales Points
    renderListTable('#salesPointTable', D.salesPointList, ['orders','tickets','revenue','share']);
}

function renderRankTable(sel, items, fields, color) {
    const tb = document.querySelector(sel+' tbody');
    if (!items.length) { tb.innerHTML = '<tr><td colspan="'+(fields.length+2)+'" style="text-align:center;">無資料</td></tr>'; return; }
    items.forEach((ev,i) => {
        const tr = document.createElement('tr');
        let html = '<td><span style="background:'+color+'; color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">'+(i+1)+'</span></td>';
        
        let linkStyle = sel==='#topEventsTable' && ev.sessions && ev.sessions.length > 0 ? 'color:var(--accent-color); text-decoration:underline; cursor:pointer;' : 'color:inherit;';
        let onClickAttr = sel==='#topEventsTable' && ev.sessions && ev.sessions.length > 0 ? 'onclick="showEventDetail(' + i + ')"' : '';
        
        html += '<td><span style="'+linkStyle+'" '+onClickAttr+'>'+ev.name+'</span></td>';
        fields.forEach(f => {
            if (f==='revenue'||f==='amount') html += '<td class="text-right" style="color:'+color+'; font-weight:bold;">'+ntd(ev[f])+'</td>';
            else if (f==='share') html += '<td class="text-right" style="color:#888;">'+ev[f]+'%</td>';
            else if (f==='eTickets'||f==='paperTickets') { var ttPct = ev.tickets ? ((ev[f]||0)/ev.tickets*100).toFixed(1) : '0.0'; html += '<td class="text-right">'+fmt(ev[f]||0)+'<span style="color:#888; font-size:0.85em;"> ('+ttPct+'%)</span></td>'; }
            else html += '<td class="text-right">'+fmt(ev[f])+'</td>';
        });
        tr.innerHTML = html;
        tb.appendChild(tr);
    });
}

function showEventDetail(index) {
    const ev = D.topByRevenue[index];
    if(!ev || !ev.sessions) return;
    document.getElementById('modalTitle').innerText = '場次分析 - ' + ev.name;
    const mb = document.getElementById('modalBody');
    mb.innerHTML = '';
    ev.sessions.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = 
            '<td style="font-weight:500;">' + s.name + '</td>' +
            '<td class="text-right">' + fmt(s.orders) + '</td>' +
            '<td class="text-right">' + fmt(s.tickets) + '</td>' +
            '<td class="text-right" style="color:var(--accent-color); font-weight:bold;">' + ntd(s.revenue) + '</td>' +
            '<td class="text-right" style="color:#888;">' + s.shareName + '%</td>';
        mb.appendChild(tr);
    });
    document.getElementById('eventDetailModal').style.display = 'flex';
}


function renderListTable(sel, items, fields) {
    const tb = document.querySelector(sel+' tbody');
    items.forEach(p => {
        const tr = document.createElement('tr');
        let html = '<td class="font-bold">'+p.name+'</td>';
        fields.forEach(f => {
            if (f==='revenue') html += '<td class="text-right">'+ntd(p[f])+'</td>';
            else if (f==='share') html += '<td class="text-right" style="color:#888;">'+p[f]+'%</td>';
            else html += '<td class="text-right">'+fmt(p[f])+'</td>';
        });
        tr.innerHTML = html;
        tb.appendChild(tr);
    });
}

init();
<\/script>

<button onclick="window.print()" class="fixed-btn" style="position:fixed; bottom:90px; right:30px; background:linear-gradient(135deg,#00838f,#006064); color:white; padding:12px 24px; border:none; border-radius:50px; cursor:pointer; font-weight:600; box-shadow:0 4px 15px rgba(0,131,143,0.4); display:flex; align-items:center; gap:8px; z-index:1000;">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> 下載 PDF
</button>
<a href="report_index.html" class="fixed-btn" style="position:fixed; bottom:30px; right:30px; background:linear-gradient(135deg,#00acc1,#00838f); color:white; padding:12px 24px; border-radius:50px; text-decoration:none; font-weight:600; box-shadow:0 4px 15px rgba(0,172,193,0.4); display:flex; align-items:center; gap:8px; z-index:1000;">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg> 回首頁
</a>
</body>
</html>`;

        const fileName = 'A_Qware_Revenue_Report_Daily.html';
        const filePath = path.join(__dirname, fileName);

        const safeAggData = JSON.stringify(aggData);
        const finalHtml = htmlContent.replace("'__AGG_DATA__'", safeAggData);

        fs.writeFileSync(filePath, finalHtml);
        console.log(`Report generated: ${filePath} (${(Buffer.byteLength(finalHtml) / 1024).toFixed(0)} KB)`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

generateDailyReport();
