
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function generateReportForMonth(targetMonth) {
    try {
        console.log(`\n>>> Processing ${targetMonth} ...`);
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        const rawData = await collection.find(
            { "交易時間": { $regex: "^" + targetMonth } },
            { projection: { "交易時間": 1, "售價": 1, "狀態": 1, "訂單編號": 1, "節目/商品名稱": 1, "付款方式": 1, "銷售點": 1, "手續費": 1, "實退金額": 1, "退票時間": 1, "退票因素": 1 } }
        ).toArray();

        if (rawData.length === 0) {
            console.log(`No data for ${targetMonth}`);
            return;
        }

        const getVal = (v) => (v && v['$numberDecimal'] ? parseFloat(v['$numberDecimal']) : (Number(v) || 0));

        // 1. Aggregation
        const validOrders = rawData.filter(d => d['狀態'] === '正常');
        const totalRevenue = validOrders.reduce((acc, cur) => acc + getVal(cur['售價']), 0);
        const totalTickets = validOrders.length;
        const totalRefundedTickets = rawData.filter(d => getVal(d['手續費']) > 0).length;
        const totalRefundedValue = rawData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票').reduce((acc, cur) => acc + getVal(cur['實退金額']), 0);
        const totalRefundFees = rawData.reduce((acc, cur) => acc + getVal(cur['手續費']), 0);

        const ordersSet = new Set();
        validOrders.forEach(o => { if(o['訂單編號']) ordersSet.add(o['訂單編號'].split('_')[0]); });
        const orderCount = ordersSet.size;
        const aov = orderCount ? Math.round(totalRevenue / orderCount) : 0;

        // 2. Trends
        const salesByDate = {};
        const dailyTopEvent = {};
        validOrders.forEach(item => {
            const date = item['交易時間'].split(' ')[0];
            const p = getVal(item['售價']);
            const name = item['節目/商品名稱'] || 'Unknown';
            salesByDate[date] = (salesByDate[date] || 0) + p;
            if(!dailyTopEvent[date]) dailyTopEvent[date] = {};
            dailyTopEvent[date][name] = (dailyTopEvent[date][name] || 0) + p;
        });
        const trendDates = Object.keys(salesByDate).sort();
        const trendSales = trendDates.map(d => salesByDate[d]);
        const peakAnnotations = trendDates.filter(d => salesByDate[d] > 6000000).map(d => {
            const top = Object.entries(dailyTopEvent[d]).sort((a,b) => b[1]-a[1])[0][0];
            return { date: d, value: salesByDate[d], label: top.substring(0,15) };
        });

        const refundsByDate = {};
        rawData.filter(d => getVal(d['手續費']) > 0).forEach(item => {
            const date = (item['退票時間'] || item['交易時間']).split(' ')[0];
            refundsByDate[date] = (refundsByDate[date] || 0) + getVal(item['實退金額']);
        });
        const refundDates = Object.keys(refundsByDate).sort();
        const refundAmounts = refundDates.map(d => refundsByDate[d]);

        // 3. Per-Event & Payment/Point
        const eventMap = {};
        const payMap = {};
        const ptMap = {};

        validOrders.forEach(item => {
            const p = getVal(item['售價']);
            const base = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'Unknown';
            const name = item['節目/商品名稱'] || 'Unknown';
            const date = item['交易時間'].split(' ')[0];

            if(!eventMap[name]) eventMap[name] = { revenue: 0, tickets: 0, orders: new Set(), refunds: 0, refundTickets: 0, priceStats: {}, pointStats: {}, refundReasons: {}, refundOrders: new Set(), dailyTrend: {} };
            eventMap[name].revenue += p; eventMap[name].tickets += 1; eventMap[name].orders.add(base);
            eventMap[name].priceStats[p] = (eventMap[name].priceStats[p] || 0) + 1;
            eventMap[name].pointStats[item['銷售點'] || '未知'] = (eventMap[name].pointStats[item['銷售點'] || '未知'] || 0) + p;
            eventMap[name].dailyTrend[date] = (eventMap[name].dailyTrend[date] || 0) + p;

            const pay = item['付款方式'] || '未知';
            if(!payMap[pay]) payMap[pay] = { revenue: 0, tickets: 0, orders: new Set() };
            payMap[pay].revenue += p; payMap[pay].tickets += 1; payMap[pay].orders.add(base);

            const pt = item['銷售點'] || '未知';
            if(!ptMap[pt]) ptMap[pt] = { revenue: 0, tickets: 0, orders: new Set() };
            ptMap[pt].revenue += p; ptMap[pt].tickets += 1; ptMap[pt].orders.add(base);
        });

        rawData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票' || getVal(d['手續費']) > 0).forEach(item => {
            const name = item['節目/商品名稱'] || 'Unknown';
            if(!eventMap[name]) return;
            const f = getVal(item['手續費']);
            eventMap[name].refunds += f; eventMap[name].refundTickets += 1;
            if(item['訂單編號']) eventMap[name].refundOrders.add(item['訂單編號'].split('_')[0]);
            const reason = item['退票因素'] || '未知';
            if(!eventMap[name].refundReasons[reason]) eventMap[name].refundReasons[reason] = { count: 0, fee: 0 };
            eventMap[name].refundReasons[reason].count += 1; eventMap[name].refundReasons[reason].fee += f;
        });

        const eventList = Object.entries(eventMap).map(([name, s]) => {
            const sortedD = Object.keys(s.dailyTrend).sort();
            const res = { name, ...s, orderCount: s.orders.size, refundOrderCount: s.refundOrders.size, trendData: { labels: sortedD, values: sortedD.map(d => s.dailyTrend[d]) } };
            delete res.orders; delete res.refundOrders; delete res.dailyTrend; return res;
        });

        const summaryData = {
            totalRevenue, totalTickets, orderCount, aov, totalRefundTickets: totalRefundedTickets, totalRefundedValue, totalRefundFees,
            trendDates, trendSales, peakAnnotations, refundDates, refundAmounts,
            topByRevenue: [...eventList].sort((a,b) => b.revenue - a.revenue).slice(0, 5),
            topByTickets: [...eventList].sort((a,b) => b.tickets - a.tickets).slice(0, 5),
            topByRefunds: [...eventList].sort((a,b) => b.refunds - b.refunds).slice(0, 5),
            paymentList: Object.entries(payMap).map(([name, s]) => ({ name, revenue: s.revenue, tickets: s.tickets, orderCount: s.orders.size, share: (s.revenue/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue),
            spList: Object.entries(ptMap).map(([name, s]) => ({ name, revenue: s.revenue, tickets: s.tickets, orderCount: s.orders.size, share: (s.revenue/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue),
            eventSummaryMap: Object.fromEntries(eventList.map(e => [e.name, e])),
            meta: { totalRows: rawData.length, reportTime: new Date().toLocaleString('zh-TW') }
        };

        // Build the HTML using a clean template approach
        const displayMonth = targetMonth.replace('-', '年') + '月';
        
        // I will use a hardcoded UI skeleton to ensure it's NEVER broken again
        const htmlOutput = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ibon售票系統 ${displayMonth} 分析報表 (A系統)</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
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
        .analysis-link { color: var(--accent-color); cursor: pointer; text-decoration: underline; font-weight: bold; }
        .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center; }
        .modal-content { background: #fff; width: 90%; max-width: 1000px; height: 85vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
        .modal-header { padding: 15px 20px; background: var(--text-primary); color: white; display: flex; justify-content: space-between; align-items: center; }
        .modal-body { flex: 1; padding: 20px; overflow-y: auto; }
        .btn-home { position: fixed; bottom: 30px; right: 30px; background: #d81b60; color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: 600; z-index: 100; }
        .btn-pdf { position: fixed; bottom: 30px; right: 160px; background: #ad1457; color: white; padding: 12px 24px; border-radius: 50px; cursor: pointer; border: none; font-weight: 600; z-index: 100; }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div><h1>ibon售票系統 ${displayMonth} 分析報表 (A系統)</h1><div style="color:#888; font-size:0.85em;">Data Source: MongoDB Backend Aggregated</div></div>
        <div style="text-align:right; font-size:0.9em; color:var(--text-secondary);">產出時間: \${summaryData.meta.reportTime}<br>製表者: 陳俊良</div>
    </header>

    <div class="stats-grid">
        <div class="card"><h3>總營收</h3><div class="value">NT$ \${summaryData.totalRevenue.toLocaleString()}</div></div>
        <div class="card"><h3>客單價 (AOV)</h3><div class="value">NT$ \${summaryData.aov.toLocaleString()}</div></div>
        <div class="card"><h3>總交易張數</h3><div class="value">\${summaryData.totalTickets.toLocaleString()}</div></div>
        <div class="card"><h3>總訂單筆數</h3><div class="value">\${summaryData.orderCount.toLocaleString()}</div></div>
        <div class="card"><h3>退票張數</h3><div class="value" style="color:#c62828;">\${summaryData.totalRefundTickets.toLocaleString()}</div></div>
        <div class="card"><h3>退票手續費</h3><div class="value">NT$ \${summaryData.totalRefundFees.toLocaleString()}</div></div>
    </div>

    <div class="chart-container"><canvas id="trendChart"></canvas></div>

    <div class="table-container">
        <h3>🏆 銷售排行 Top 5 (By Revenue)</h3>
        <table id="topEventsTable">
            <thead><tr><th>Rank</th><th>節目名稱</th><th class="text-right">訂單筆數</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">佔比</th></tr></thead>
            <tbody></tbody>
        </table>
    </div>

    <div class="table-container">
        <h3>📉 退票排行 Top 5 (By Refund Fees)</h3>
        <table id="topRefundTable">
            <thead><tr><th>Rank</th><th>節目名稱</th><th class="text-right">退票筆數</th><th class="text-right">退票張數</th><th class="text-right">手續費金額</th></tr></thead>
            <tbody></tbody>
        </table>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
        <div class="table-container">
            <h3>💳 付款方式分析</h3>
            <table id="paymentTable"><thead><tr><th>方式</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">佔比</th></tr></thead><tbody></tbody></table>
        </div>
        <div class="table-container">
            <h3>🏪 銷售點分析</h3>
            <table id="salesPointTable"><thead><tr><th>銷售點</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">佔比</th></tr></thead><tbody></tbody></table>
        </div>
    </div>
</div>

<div id="analysisModal" class="modal-overlay">
    <div class="modal-content">
        <div class="modal-header"><h2 id="modalTitle">項目分析</h2><button onclick="closeModal()" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button></div>
        <div class="modal-body">
            <div class="stats-grid">
                <div class="card"><h3>該項營收</h3><div id="m-val-revenue" class="value">-</div></div>
                <div class="card"><h3>成交張數</h3><div id="m-val-tickets" class="value">-</div></div>
                <div class="card"><h3>退票手續費</h3><div id="m-val-refunds" class="value">-</div></div>
            </div>
            <div class="chart-container"><canvas id="modalTrendChart"></canvas></div>
            <div class="table-container"><h3>票價分佈</h3><table id="modalPriceTable"><thead><tr><th>票價</th><th>張數</th><th>營收</th><th class="text-right">佔比</th></tr></thead><tbody></tbody></table></div>
        </div>
    </div>
</div>

<button class="btn-pdf" onclick="exportPDF()">下載 PDF</button>
<a href="report_index.html" class="btn-home">回首頁</a>

<script>
    const summaryData = \${JSON.stringify(summaryData)};
    let modalChart = null;

    window.onload = function() {
        const s = summaryData;
        const renderTable = (sel, list, fn) => { 
            const b = document.querySelector(sel + ' tbody'); 
            if(b) { b.innerHTML = ''; list.forEach((item, i) => b.innerHTML += fn(item, i)); }
        };

        renderTable('#topEventsTable', s.topByRevenue, (item, i) => \`<tr><td>\${i+1}</td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name.replace(/'/g, "\\\\'")}')">\${item.name}</span></td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${(item.revenue/s.totalRevenue*100).toFixed(1)}%</td></tr>\`);
        renderTable('#topRefundTable', s.topByRefunds, (item, i) => \`<tr><td>\${i+1}</td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name.replace(/'/g, "\\\\'")}')">\${item.name}</span></td><td class="text-right">\${item.refundOrderCount.toLocaleString()}</td><td class="text-right">\${item.refundTickets.toLocaleString()}</td><td class="text-right">NT$ \${item.refunds.toLocaleString()}</td></tr>\`);
        renderTable('#paymentTable', s.paymentList, (item) => \`<tr><td>\${item.name}</td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${item.share}%</td></tr>\`);
        renderTable('#salesPointTable', s.spList, (item) => \`<tr><td>\${item.name}</td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${item.share}%</td></tr>\`);

        const ann = {};
        s.peakAnnotations.forEach((a, i) => { ann['l'+i] = { type:'label', xValue:a.date, yValue:a.value, content:[a.label], backgroundColor:'rgba(255,243,224,0.8)', font:{size:10}, position:'center', yAdjust:-20 }; });

        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: { labels: s.trendDates, datasets: [{ label: '每日營收', data: s.trendSales, borderColor: '#d81b60', fill: true, backgroundColor: 'rgba(216,27,96,0.05)', tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { annotation: { annotations: ann } } }
        });
    };

    function analyzeEvent(name) {
        const s = summaryData.eventSummaryMap[name]; if(!s) return;
        document.getElementById('analysisModal').style.display = 'flex';
        document.getElementById('modalTitle').innerText = name;
        document.getElementById('m-val-revenue').innerText = 'NT$ ' + s.revenue.toLocaleString();
        document.getElementById('m-val-tickets').innerText = s.tickets.toLocaleString();
        document.getElementById('m-val-refunds').innerText = 'NT$ ' + s.refunds.toLocaleString();

        const pt = document.querySelector('#modalPriceTable tbody'); pt.innerHTML = '';
        Object.entries(s.priceStats).sort((a,b) => b[0]-a[0]).forEach(([p, c]) => {
            pt.innerHTML += \`<tr><td>$\${Number(p).toLocaleString()}</td><td>\${c.toLocaleString()}</td><td>$\${(p*c).toLocaleString()}</td><td class="text-right">\${(p*c/s.revenue*100).toFixed(1)}%</td></tr>\`;
        });

        if(modalChart) modalChart.destroy();
        modalChart = new Chart(document.getElementById('modalTrendChart'), {
            type: 'line',
            data: { labels: s.trendData.labels, datasets: [{ label: '每日營收', data: s.trendData.values, borderColor: '#d81b60', fill: true, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function closeModal() { document.getElementById('analysisModal').style.display = 'none'; }
    function exportPDF() { html2pdf().from(document.querySelector('.container')).set({ margin:10, filename:document.title+'.pdf', jsPDF:{orientation:'landscape'} }).save(); }
</script>
</body></html>
`;

        const fileName = `A_Qware_Revenue_Report_${displayMonth}_分析報表.html`;
        fs.writeFileSync(path.join(__dirname, fileName), '\ufeff' + htmlOutput);
        console.log(`Report generated successfully: ${fileName}`);

    } catch (e) {
        console.error(`Error for ${targetMonth}:`, e);
    }
}

async function main() {
    await generateReportForMonth("2026-03");
    await generateReportForMonth("2026-02");
    await generateReportForMonth("2026-01");
    await client.close();
}

main();
