
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function generateReport() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Fetching data for 2026-03 and aggregating in backend...");
        const rawData = await collection.find(
            { "交易時間": { $regex: "^2026-03" } },
            { projection: { "交易時間": 1, "售價": 1, "狀態": 1, "訂單編號": 1, "節目/商品名稱": 1, "付款方式": 1, "銷售點": 1, "手續費": 1, "實退金額": 1, "退票時間": 1, "退票因素": 1 } }
        ).toArray();

        console.log(`Processing ${rawData.length} records...`);

        // 1. 基本統計
        const validOrders = rawData.filter(d => d['狀態'] === '正常');
        const refundDocs = rawData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票' || (d['手續費'] && d['手續費']['$numberDecimal'] && parseFloat(d['手續費']['$numberDecimal']) > 0));

        const getVal = (v) => (v && v['$numberDecimal'] ? parseFloat(v['$numberDecimal']) : (Number(v) || 0));

        const totalRevenue = validOrders.reduce((acc, cur) => acc + getVal(cur['售價']), 0);
        const totalTickets = validOrders.length;
        const totalRefundTickets = refundDocs.length;
        const totalRefundedValue = rawData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票').reduce((acc, cur) => acc + getVal(cur['實退金額']), 0);
        const totalRefundFees = rawData.reduce((acc, cur) => acc + getVal(cur['手續費']), 0);

        const uniqueOrdersSet = new Set();
        validOrders.forEach(o => { if(o['訂單編號']) uniqueOrdersSet.add(o['訂單編號'].split('_')[0]); });
        const orderCount = uniqueOrdersSet.size;
        const aov = orderCount ? Math.round(totalRevenue / orderCount) : 0;

        // 2. 趨勢圖數據 (Daily Revenue)
        const salesByDate = {};
        validOrders.forEach(item => {
            const date = item['交易時間'].split(' ')[0];
            salesByDate[date] = (salesByDate[date] || 0) + getVal(item['售價']);
        });
        const trendDates = Object.keys(salesByDate).sort();
        const trendSales = trendDates.map(d => salesByDate[d]);

        // 3. 排行榜 (Top 10 by Revenue)
        const eventStats = {};
        validOrders.forEach(item => {
            const name = item['節目/商品名稱'] || 'Unknown';
            if (!eventStats[name]) eventStats[name] = { revenue: 0, tickets: 0, orders: new Set() };
            eventStats[name].revenue += getVal(item['售價']);
            eventStats[name].tickets += 1;
            if(item['訂單編號']) eventStats[name].orders.add(item['訂單編號'].split('_')[0]);
        });
        const topEvents = Object.entries(eventStats)
            .map(([name, s]) => ({ name, revenue: s.revenue, tickets: s.tickets, orders: s.orders.size }))
            .sort((a,b) => b.revenue - a.revenue)
            .slice(0, 10);

        // 4. 付款方式與銷售點佔比
        const payStats = {};
        validOrders.forEach(item => {
            const m = item['付款方式'] || 'Unknown';
            payStats[m] = (payStats[m] || 0) + getVal(item['售價']);
        });
        const paymentList = Object.entries(payStats).map(([name, rev]) => ({ name, revenue: rev, share: (rev/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue);

        const spStats = {};
        validOrders.forEach(item => {
            const p = item['銷售點'] || 'Unknown';
            spStats[p] = (spStats[p] || 0) + getVal(item['售價']);
        });
        const spList = Object.entries(spStats).map(([name, rev]) => ({ name, revenue: rev, share: (rev/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue);

        // 構建彙總數據包，避免注入 30 萬筆明細
        const summaryData = {
            totalRevenue, totalTickets, orderCount, aov, totalRefundTickets, totalRefundedValue, totalRefundFees,
            trendDates, trendSales, topEvents, paymentList, spList,
            meta: { totalRows: rawData.length, reportTime: new Date().toLocaleString('zh-TW') }
        };

        const dateTitle = "2026年03月 分析報表 (A系統)";
        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>ibon售票系統 ${dateTitle}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root { --bg-color: #fce4ec; --card-bg: #ffffff; --text-primary: #880e4f; --text-secondary: #ad1457; --accent-color: #d81b60; --shadow: 0 4px 6px rgba(0,0,0,0.05); }
        body { font-family: 'Inter', sans-serif; background-color: var(--bg-color); color: var(--text-primary); margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        header { margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; background: white; padding: 20px; border-radius: 16px; box-shadow: var(--shadow); }
        h1 { margin: 0; font-weight: 600; color: var(--accent-color); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: var(--card-bg); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); border-left: 5px solid var(--accent-color); }
        .card h3 { margin: 0 0 10px 0; font-size: 0.85em; color: var(--text-secondary); opacity: 0.8; }
        .card .value { font-size: 1.8em; font-weight: 700; color: var(--accent-color); }
        .chart-container { background: white; padding: 20px; border-radius: 16px; box-shadow: var(--shadow); margin-bottom: 30px; height: 400px; }
        .table-container { background: white; padding: 20px; border-radius: 16px; box-shadow: var(--shadow); margin-bottom: 30px; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #f8bbd0; }
        th { color: var(--text-secondary); font-weight: 600; }
        .text-right { text-align: right; }
        .btn-home { position: fixed; bottom: 30px; right: 30px; background: #d81b60; color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: 600; }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div><h1>ibon售票系統 ${dateTitle}</h1><div style="color:#888; font-size:0.85em;">Data Source: MongoDB Backend Aggregated</div></div>
        <div style="text-align:right; font-size:0.9em;">產出時間: \${summaryData.meta.reportTime}<br>製表者: 陳俊良</div>
    </header>

    <div class="stats-grid">
        <div class="card"><h3>總營收</h3><div class="value">NT$ \${summaryData.totalRevenue.toLocaleString()}</div></div>
        <div class="card"><h3>客單價 (AOV)</h3><div class="value">NT$ \${summaryData.aov.toLocaleString()}</div></div>
        <div class="card"><h3>總交易張數</h3><div class="value">\${summaryData.totalTickets.toLocaleString()}</div></div>
        <div class="card"><h3>總訂單筆數</h3><div class="value">\${summaryData.orderCount.toLocaleString()}</div></div>
        <div class="card"><h3>退票張數</h3><div class="value" style="color:#c62828;">\${summaryData.totalRefundTickets.toLocaleString()}</div></div>
        <div class="card"><h3>退票手續費</h3><div class="value">NT$ \${summaryData.totalRefundFees.toLocaleString()}</div></div>
    </div>

    <div class="chart-container"><canvas id="revenueChart"></canvas></div>

    <div class="table-container">
        <h3>🏆 銷售排行 Top 10 (By Revenue)</h3>
        <table>
            <thead><tr><th>Rank</th><th>節目名稱</th><th class="text-right">訂單筆數</th><th class="text-right">張數</th><th class="text-right">金額</th></tr></thead>
            <tbody id="topEventsBody"></tbody>
        </table>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
        <div class="table-container">
            <h3>💳 付款方式</h3>
            <table id="payTable"><thead><tr><th>方式</th><th class="text-right">金額</th><th class="text-right">佔比</th></tr></thead><tbody></tbody></table>
        </div>
        <div class="table-container">
            <h3>🏪 銷售點</h3>
            <table id="spTable"><thead><tr><th>銷售點</th><th class="text-right">金額</th><th class="text-right">佔比</th></tr></thead><tbody></tbody></table>
        </div>
    </div>
</div>
<a href="report_index.html" class="btn-home">回首頁</a>

<script>
    const data = __SUMMARY_DATA__;
    
    // Fill Tables
    const topBody = document.getElementById('topEventsBody');
    data.topEvents.forEach((ev, i) => {
        topBody.innerHTML += \`<tr><td>\${i+1}</td><td>\${ev.name}</td><td class="text-right">\${ev.orders.toLocaleString()}</td><td class="text-right">\${ev.tickets.toLocaleString()}</td><td class="text-right">NT$ \${ev.revenue.toLocaleString()}</td></tr>\`;
    });

    data.paymentList.forEach(p => {
        document.querySelector('#payTable tbody').innerHTML += \`<tr><td>\${p.name}</td><td class="text-right">NT$ \${p.revenue.toLocaleString()}</td><td class="text-right">\${p.share}%</td></tr>\`;
    });

    data.spList.forEach(s => {
        document.querySelector('#spTable tbody').innerHTML += \`<tr><td>\${s.name}</td><td class="text-right">NT$ \${s.revenue.toLocaleString()}</td><td class="text-right">\${s.share}%</td></tr>\`;
    });

    // Chart
    new Chart(document.getElementById('revenueChart'), {
        type: 'line',
        data: {
            labels: data.trendDates,
            datasets: [{ label: '每日營收', data: data.trendSales, borderColor: '#d81b60', fill: false, tension: 0.3 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: '2026年03月 營收趨勢圖' } } }
    });
</script>
</body>
</html>
`;

        const finalHtml = htmlContent
            .replace('__SUMMARY_DATA__', JSON.stringify(summaryData))
            .replace(/\${summaryData\.totalRevenue\.toLocaleString\(\)}/g, summaryData.totalRevenue.toLocaleString())
            .replace(/\${summaryData\.aov\.toLocaleString\(\)}/g, summaryData.aov.toLocaleString())
            .replace(/\${summaryData\.totalTickets\.toLocaleString\(\)}/g, summaryData.totalTickets.toLocaleString())
            .replace(/\${summaryData\.orderCount\.toLocaleString\(\)}/g, summaryData.orderCount.toLocaleString())
            .replace(/\${summaryData\.totalRefundTickets\.toLocaleString\(\)}/g, summaryData.totalRefundTickets.toLocaleString())
            .replace(/\${summaryData\.totalRefundFees\.toLocaleString\(\)}/g, summaryData.totalRefundFees.toLocaleString())
            .replace(/\${summaryData\.meta\.reportTime}/g, summaryData.meta.reportTime);

        const fileName = `A_Qware_Revenue_Report_2026年03月_分析報表.html`;
        fs.writeFileSync(path.join(__dirname, fileName), '\ufeff' + finalHtml);
        console.log(`Fast report generated: ${fileName}`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

generateReport();
