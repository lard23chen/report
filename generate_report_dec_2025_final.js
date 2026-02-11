
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

        console.log("Fetching data for Dec 2025...");
        const data = await collection.find({ "交易時間": { $regex: "^2025-12" } }).toArray();
        console.log(`Fetched ${data.length} records.`);

        // Report Time
        const reportTime = new Date().toLocaleString('zh-TW');

        // Logo
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, 'ibon_logo.png');
            if (fs.existsSync(logoPath)) {
                logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
            }
        } catch (err) { }

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>ibon售票系統 2025年12月 分析報表 (A系統)</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"></script>
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
        body { font-family: 'Inter', sans-serif; background-color: var(--bg-color); color: var(--text-primary); margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        header { margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; background: white; padding: 20px; border-radius: 16px; box-shadow: var(--shadow); }
        h1 { margin: 0; font-weight: 600; color: var(--accent-color); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: var(--card-bg); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); border-left: 5px solid var(--accent-color); }
        .card h3 { margin: 0 0 10px 0; font-size: 0.85em; color: var(--text-secondary); opacity: 0.8; }
        .card .value { font-size: 1.8em; font-weight: 700; color: var(--accent-color); }
        .card .sub { font-size: 0.8em; color: #888; margin-top: 5px; }
        .charts-row { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
        .chart-container { background: var(--card-bg); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); flex: 1; min-width: 400px; min-height: 400px; }
        .table-container { background: var(--card-bg); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); overflow-x: auto; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #f8bbd0; }
        th { color: var(--text-secondary); font-weight: 600; white-space: nowrap; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center; }
        .modal-content { background: #fff; width: 95%; max-width: 1100px; height: 90vh; border-radius: 12px; display: flex; flex-direction: column; }
        .modal-body { flex: 1; padding: 20px; overflow-y: auto; }
        .close-btn { background: none; border: none; font-size: 24px; cursor: pointer; float: right; padding: 10px; }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div>
            <h1>ibon售票系統 2025年12月 分析報表 (A系統)</h1>
            <div style="color: #666;">Data Source: MongoDB (QwareAi / Qware_Ticket_Data)</div>
        </div>
        <div>產出時間: ${reportTime}<br>製表者: 陳俊良</div>
    </header>

    <div class="stats-grid">
        <div class="card"><h3>總營收 (Revenue)</h3><div class="value" id="val-revenue">--</div></div>
        <div class="card"><h3>客單價 (AOV)</h3><div class="value" id="val-aov">--</div></div>
        <div class="card"><h3>總交易張數 (Tickets)</h3><div class="value" id="val-tickets">--</div></div>
        <div class="card"><h3>訂單筆數 (Orders)</h3><div class="value" id="val-orders">--</div></div>
        <div class="card"><h3>退票金額 (Refunds)</h3><div class="value" id="val-refunded-amount">--</div></div>
    </div>

    <div class="charts-row">
        <div class="chart-container"><canvas id="trendChart"></canvas></div>
    </div>

    <div class="table-container">
        <h3>🎫 取票方式分析 (Ticket Types: Paper vs Electronic)</h3>
        <table id="ticketTypeTable">
            <thead><tr><th>類型 (Type)</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">佔比</th></tr></thead>
            <tbody></tbody>
        </table>
    </div>

    <!-- Additional tables for Top Events, Refund Events, Payment Methods -->
    <div class="table-container"><h3>🏆 銷售排行 Top 5</h3><table id="topEventsTable"><thead><tr><th>Rank</th><th>節目</th><th class="text-right">金額</th></tr></thead><tbody></tbody></table></div>
</div>

<div id="analysisModal" class="modal-overlay">
    <div class="modal-content">
        <button class="close-btn" onclick="document.getElementById('analysisModal').style.display='none'">&times;</button>
        <div class="modal-body" id="modalBody"></div>
    </div>
</div>

<script>
    const dbData = ${JSON.stringify(data)};
    const validOrders = dbData.filter(d => d['狀態'] === '正常');
    const totalRevenue = validOrders.reduce((a, c) => a + (c['售價']||0), 0);
    const totalTickets = validOrders.length;
    const uniqueOrders = new Set();
    validOrders.forEach(o => { if(o['訂單編號']) uniqueOrders.add(o['訂單編號'].split('_')[0]); });
    const orderCount = uniqueOrders.size;
    const aov = orderCount ? Math.round(totalRevenue / orderCount) : 0;
    
    // Refund
    const refundDocs = dbData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');
    const totalRefundedValue = refundDocs.reduce((a, c) => a + (c['實退金額']||0), 0);

    // Update Cards
    document.getElementById('val-revenue').innerText = 'NT$ ' + totalRevenue.toLocaleString();
    document.getElementById('val-aov').innerText = 'NT$ ' + aov.toLocaleString();
    document.getElementById('val-tickets').innerText = totalTickets.toLocaleString();
    document.getElementById('val-orders').innerText = orderCount.toLocaleString();
    document.getElementById('val-refunded-amount').innerText = 'NT$ ' + totalRefundedValue.toLocaleString();

    // Ticket Type Analysis
    const typeStats = {
        '紙票 (Paper/Picked Up)': { t: 0, r: 0, o: new Set() },
        '電子票/未列印 (E-Ticket)': { t: 0, r: 0, o: new Set() },
        '其他': { t: 0, r: 0, o: new Set() }
    };
    validOrders.forEach(d => {
        const m = d['取票方式'];
        let k = '其他';
        if(m === '已取') k = '紙票 (Paper/Picked Up)';
        else if(m === '未列印') k = '電子票/未列印 (E-Ticket)';
        typeStats[k].t++;
        typeStats[k].r += (d['售價']||0);
        if(d['訂單編號']) typeStats[k].o.add(d['訂單編號'].split('_')[0]);
    });
    
    const ttBody = document.querySelector('#ticketTypeTable tbody');
    Object.keys(typeStats).forEach(k => {
        const s = typeStats[k];
        if(s.t === 0) return;
        const share = totalRevenue ? ((s.r/totalRevenue)*100).toFixed(1) : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td class="font-bold">\${k}</td><td class="text-right">\${s.o.size.toLocaleString()}</td><td class="text-right">\${s.t.toLocaleString()}</td><td class="text-right">NT$ \${s.r.toLocaleString()}</td><td class="text-right">\${share}%</td>\`;
        ttBody.appendChild(tr);
    });

    // Chart
    const daily = {};
    validOrders.forEach(d => {
        if(!d['交易時間']) return;
        const date = d['交易時間'].split(' ')[0];
        daily[date] = (daily[date]||0) + (d['售價']||0);
    });
    const dates = Object.keys(daily).sort();
    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: { labels: dates, datasets: [{ label: 'Daily Revenue', data: dates.map(d=>daily[d]), borderColor: '#d81b60', fill: true, backgroundColor: 'rgba(216, 27, 96, 0.1)' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Top 5 Events
    const evtStats = {};
    validOrders.forEach(d => {
        const n = d['節目/商品名稱']||'Unknown';
        if(!evtStats[n]) evtStats[n] = 0;
        evtStats[n] += (d['售價']||0);
    });
    const topEvts = Object.entries(evtStats).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const teBody = document.querySelector('#topEventsTable tbody');
    topEvts.forEach((e,i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${i+1}</td><td>\${e[0]}</td><td class="text-right">NT$ \${e[1].toLocaleString()}</td>\`;
        teBody.appendChild(tr);
    });

</script>
</body>
</html>`;

        const filename = "Qware_Revenue_Report_2025年12月_分析報表_v2.html";
        fs.writeFileSync(path.join(__dirname, filename), htmlContent);
        console.log(`Report generated: ${filename}`);

    } catch (e) { console.error(e); } finally { await client.close(); }
}
generateReport();
