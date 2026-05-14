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

        const TARGET = '2026 7–ELEVEN 高雄啤酒音樂節';
        const TARGET_FIELD = '節目/商品名稱';

        console.log(`Fetching data for: ${TARGET}...`);
        const data = await db.collection('Qware_A_Ticket_data_Daily').find({ [TARGET_FIELD]: TARGET }).toArray();
        console.log(`Fetched ${data.length} records.`);

        // Fetch member data for nationality/city
        const memberIds = [...new Set(data.map(d => d['會員編號']).filter(id => id && id !== '-'))];
        const members = await db.collection('Qware_Member_data').find({ '會員編號': { $in: memberIds } }).toArray();
        const memberNatMap = {};
        const memberCityMap = {};
        members.forEach(m => {
            if (m['會員編號']) {
                if (m['國家']) memberNatMap[m['會員編號']] = m['國家'];
                if (m['縣市別']) memberCityMap[m['會員編號']] = m['縣市別'];
            }
        });

        // Normalize data
        data.forEach(d => {
            const mid = d['會員編號'];
            d['國籍'] = (mid && memberNatMap[mid]) ? memberNatMap[mid] : '未知';
            d['縣市別_resolved'] = (mid && memberCityMap[mid]) ? memberCityMap[mid] : '未知';

            ['售價', '原價', '實退金額', '手續費'].forEach(f => {
                if (d[f] && d[f].$numberDecimal) d[f] = parseFloat(d[f].$numberDecimal);
                else if (d[f]) d[f] = parseFloat(d[f]);
                else d[f] = 0;
            });
        });

        const reportTime = new Date().toLocaleString('zh-TW');

        const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>2026 7-ELEVEN 高雄啤酒音樂節 - 專案分析報表</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #1a1200;
            --card-bg: #2a1f00;
            --text-primary: #fff8e1;
            --text-secondary: #ffcc80;
            --accent-color: #ffb300;
            --accent-secondary: #ff8f00;
            --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
            --success: #66bb6a;
            --danger: #ef5350;
        }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background-color: var(--bg-color); color: var(--text-primary); margin: 0; padding: 30px; }
        .container { max-width: 1400px; margin: 0 auto; }
        header {
            margin-bottom: 40px;
            display: flex; justify-content: space-between; align-items: flex-end;
            background: linear-gradient(135deg, #3e2800 0%, #1a1200 60%, #0d0800 100%);
            padding: 40px; border-radius: 24px; box-shadow: var(--shadow);
            border-bottom: 4px solid var(--accent-color);
            position: relative; overflow: hidden;
        }
        header::before {
            content: '🍺';
            position: absolute; right: 200px; top: 10px;
            font-size: 6rem; opacity: 0.08;
        }
        .logo-text { font-size: 2.2rem; font-weight: 800; background: linear-gradient(135deg, #ffb300, #ff6f00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
        .logo-sub { font-size: 1rem; color: var(--accent-color); margin-top: 8px; font-weight: 600; }
        .meta { text-align: right; font-size: 0.9rem; color: var(--text-secondary); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .card { background: var(--card-bg); border-radius: 20px; padding: 25px; box-shadow: var(--shadow); border: 1px solid rgba(255, 179, 0, 0.15); transition: all 0.3s; }
        .card:hover { border-color: var(--accent-color); transform: translateY(-4px); }
        .card h3 { margin: 0 0 12px 0; font-size: 0.8em; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px; }
        .card .value { font-size: 2em; font-weight: 700; color: var(--accent-color); }
        .card .sub { font-size: 0.82em; color: #795548; margin-top: 6px; }
        .chart-card { background: var(--card-bg); border-radius: 24px; padding: 30px; box-shadow: var(--shadow); min-height: 380px; border: 1px solid rgba(255, 179, 0, 0.1); margin-bottom: 30px; }
        .chart-card h3 { border-left: 5px solid var(--accent-color); padding-left: 15px; margin-bottom: 25px; font-size: 1.15rem; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px; }
        .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .main-content { display: grid; grid-template-columns: 2fr 1fr; gap: 25px; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.92em; }
        th, td { padding: 11px 14px; border-bottom: 1px solid rgba(255, 179, 0, 0.08); }
        th { color: var(--accent-color); font-weight: 600; font-size: 0.82rem; white-space: nowrap; }
        td { white-space: nowrap; }
        tr:hover td { background: rgba(255,179,0,0.05); }
        .text-right { text-align: right; }
        .show-card { background: var(--card-bg); border-radius: 20px; padding: 25px; border: 1px solid rgba(255,179,0,0.2); }
        .show-card .show-date { font-size: 1.1rem; font-weight: 700; color: var(--accent-color); margin-bottom: 10px; }
        .show-card .show-count { font-size: 2rem; font-weight: 800; color: #fff; }
        .show-card .show-pct { font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px; }
        .progress-bar { background: rgba(255,255,255,0.06); width: 100%; border-radius: 8px; height: 6px; margin-top: 8px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #ffb300, #ff6f00); border-radius: 8px; }
        .peak-table-container { overflow-x: auto; border: 1px solid rgba(255,179,0,0.15); border-radius: 16px; background: rgba(26,18,0,0.6); }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 0.75em; font-weight: 600; }
        .badge-gold { background: rgba(255,179,0,0.2); color: #ffb300; }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div>
            <div class="logo-text">2026 7-ELEVEN 高雄啤酒音樂節</div>
            <div class="logo-sub">專案銷售分析報表 ｜ ${TARGET}</div>
        </div>
        <div class="meta">報表生成: ${reportTime}<br>銷售紀錄: ${data.length.toLocaleString()} 筆<br>節目代碼: B0BA4VPF</div>
    </header>

    <!-- KPI Cards -->
    <div class="stats-grid">
        <div class="card"><h3>總成交金額</h3><div class="value" id="val-revenue">--</div></div>
        <div class="card"><h3>總銷售張數</h3><div class="value" id="val-tickets">--</div></div>
        <div class="card"><h3>總訂單筆數</h3><div class="value" id="val-orders">--</div></div>
        <div class="card"><h3>客單價 (AOV)</h3><div class="value" id="val-aov">--</div></div>
        <div class="card"><h3>退票張數</h3><div class="value" id="val-refund-tickets" style="color:var(--danger)">--</div></div>
        <div class="card"><h3>淨營收 (Net)</h3><div class="value" id="val-net-revenue" style="color:var(--success)">--</div></div>
    </div>

    <!-- Show Split -->
    <h2 style="color: var(--accent-color); margin-bottom: 16px; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px;">🎵 場次銷售概況</h2>
    <div class="three-col" id="showCards"></div>

    <!-- Trend + Nationality -->
    <div class="main-content">
        <div class="chart-card"><h3>每日銷售趨勢 (Daily Sales)</h3><canvas id="trendChart"></canvas></div>
        <div class="chart-card" style="min-height:0">
            <h3>國籍統計</h3>
            <table id="natTable"><thead><tr><th>國籍</th><th class="text-right">張數</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
        </div>
    </div>

    <!-- Gender + Age -->
    <div class="two-col">
        <div class="chart-card"><h3>性別分佈</h3><canvas id="genderChart"></canvas></div>
        <div class="chart-card"><h3>年齡分佈</h3><canvas id="ageChart"></canvas></div>
    </div>

    <!-- City + Payment -->
    <div class="two-col">
        <div class="chart-card"><h3>城市分佈 Top 10</h3><canvas id="cityChart"></canvas></div>
        <div class="chart-card" style="min-height:0">
            <h3>付款方式</h3>
            <table id="paymentTable"><thead><tr><th>付款方式</th><th class="text-right">張數</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
            <br>
            <h3 style="border-left: 5px solid var(--accent-color); padding-left: 15px; font-size: 1.15rem;">取票方式</h3>
            <table id="pickupTable"><thead><tr><th>取票方式</th><th class="text-right">張數</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
        </div>
    </div>

    <!-- Ticket Type + Price -->
    <div class="two-col">
        <div class="chart-card" style="min-height:0">
            <h3>票別分析</h3>
            <table id="ticketTypeTable"><thead><tr><th>票別</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
        </div>
        <div class="chart-card" style="min-height:0">
            <h3>票價分析</h3>
            <table id="priceTable"><thead><tr><th>票價</th><th class="text-right">張數</th><th class="text-right">金額</th><th>占比</th></tr></thead><tbody></tbody></table>
        </div>
    </div>

    <!-- Sales Channel -->
    <div class="chart-card" style="min-height:0; margin-bottom:30px">
        <h3>銷售點分析 Top 20</h3>
        <table id="channelTable"><thead><tr><th>銷售點</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
    </div>

    <!-- Peak Analysis -->
    <div class="chart-card" style="min-height:0; margin-bottom:30px">
        <h3>開賣尖峰時段分析 (2026-05-13 08:00 – 10:00)</h3>
        <div class="peak-table-container">
            <table id="peakTable">
                <thead><tr><th>時間</th><th class="text-right">當分鐘張數</th><th class="text-right">累計張數</th><th class="text-right">信用卡</th><th class="text-right">ATM</th><th class="text-right">累計轉換率</th></tr></thead>
                <tbody></tbody>
            </table>
        </div>
    </div>
</div>

<script>
const dbData = ${JSON.stringify(data)};

function fmt(n) { return Math.round(n).toLocaleString(); }
function fmtMoney(n) { return '$' + fmt(n); }
function pct(a, b) { return b > 0 ? (a/b*100).toFixed(1) + '%' : '0%'; }

function init() {
    const valid = dbData.filter(d => d['狀態'] === '正常');
    const refund = dbData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');
    const rev = valid.reduce((a, c) => a + (c['售價'] || 0), 0);
    const refAmt = refund.reduce((a, c) => a + (c['實退金額'] || 0), 0);
    const orders = new Set(valid.map(d => d['訂單編號'] ? d['訂單編號'].split('_')[0] : d['訂單編號'])).size;

    document.getElementById('val-revenue').innerText = fmtMoney(rev);
    document.getElementById('val-tickets').innerText = fmt(valid.length);
    document.getElementById('val-orders').innerText = fmt(orders);
    document.getElementById('val-aov').innerText = fmtMoney(orders > 0 ? rev / orders : 0);
    document.getElementById('val-refund-tickets').innerText = fmt(refund.length);
    document.getElementById('val-net-revenue').innerText = fmtMoney(rev - refAmt);

    // Show Cards
    const shows = [
        { date: '2026-07-03', label: '7/3 (六) 15:00 Day 1' },
        { date: '2026-07-04', label: '7/4 (日) 15:00 Day 2' },
        { date: '2026-07-05', label: '7/5 (一) 16:00 Day 3' }
    ];
    const showContainer = document.getElementById('showCards');
    shows.forEach(s => {
        const cnt = valid.filter(d => d['演出時間/規格'] && d['演出時間/規格'].includes(s.date)).length;
        const div = document.createElement('div');
        div.className = 'show-card';
        div.innerHTML = \`<div class="show-date">\${s.label}</div><div class="show-count">\${cnt.toLocaleString()} 張</div><div class="show-pct">\${pct(cnt, valid.length)} 占比</div><div class="progress-bar"><div class="progress-fill" style="width:\${valid.length > 0 ? cnt/valid.length*100 : 0}%"></div></div>\`;
        showContainer.appendChild(div);
    });

    // Trend Chart
    const tStats = {};
    valid.forEach(o => { const d = o['交易時間'] ? o['交易時間'].split(' ')[0] : '未知'; tStats[d] = (tStats[d]||0)+1; });
    const sortedDays = Object.keys(tStats).sort();
    new Chart(document.getElementById('trendChart'), {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: { labels: sortedDays, datasets: [{ label: '張數', data: sortedDays.map(d => tStats[d]), backgroundColor: '#ffb300', borderRadius: 6 }] },
        options: { plugins: { legend: { display: false }, datalabels: { color: '#ffcc80', anchor: 'end', align: 'top', font: { size: 11 } } }, scales: { y: { ticks: { color: '#ffcc80' } }, x: { ticks: { color: '#ffcc80' } } } }
    });

    // Gender Chart
    const gStats = {};
    valid.forEach(o => { const g = o['性別']; if(g && g !== '-') gStats[g] = (gStats[g]||0)+1; });
    new Chart(document.getElementById('genderChart'), {
        type: 'doughnut',
        data: { labels: Object.keys(gStats), datasets: [{ data: Object.values(gStats), backgroundColor: ['#38bdf8','#fb7185','#94a3b8','#a78bfa'] }] },
        plugins: [ChartDataLabels],
        options: { plugins: { datalabels: { color: 'white', font: { weight: 'bold' }, formatter: (v, ctx) => { const t = ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0); return Math.round(v/t*100)+'%'; } }, legend: { labels: { color: '#ffcc80' } } } }
    });

    // Age Chart
    const ageOrder = ['<20','20s','30s','40s','50+','未知'];
    const ageStats = {};
    valid.forEach(o => { const a = parseInt(o['年齡']); let l = isNaN(a) ? '未知' : (a<20?'<20':a<30?'20s':a<40?'30s':a<50?'40s':'50+'); ageStats[l] = (ageStats[l]||0)+1; });
    const ageLabels = ageOrder.filter(k => ageStats[k]);
    new Chart(document.getElementById('ageChart'), {
        type: 'bar',
        data: { labels: ageLabels, datasets: [{ data: ageLabels.map(k => ageStats[k]), backgroundColor: ['#ffb300','#ffa000','#ff8f00','#ff6f00','#e65100','#78909c'], borderRadius: 6 }] },
        options: { plugins: { legend: { display: false }, datalabels: { color: '#fff8e1', anchor: 'end', align: 'top' } }, scales: { y: { ticks: { color: '#ffcc80' } }, x: { ticks: { color: '#ffcc80' } } } }
    });

    // City Chart
    const cityStats = {};
    valid.forEach(o => { const c = o['縣市別_resolved']; if(c && c !== '格式不符' && c !== '未知') cityStats[c] = (cityStats[c]||0)+1; });
    const topCities = Object.entries(cityStats).sort((a,b) => b[1]-a[1]).slice(0, 10);
    new Chart(document.getElementById('cityChart'), {
        type: 'bar',
        data: { labels: topCities.map(c=>c[0]), datasets: [{ data: topCities.map(c=>c[1]), backgroundColor: '#ff8f00', borderRadius: 4 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, datalabels: { color: '#fff8e1', anchor: 'end', align: 'right' } }, scales: { y: { ticks: { color: '#ffcc80' } }, x: { ticks: { color: '#ffcc80' } } } }
    });

    // Nationality
    const natStats = {};
    valid.forEach(o => { const n = o['國籍']; natStats[n] = (natStats[n]||0)+1; });
    const natBody = document.querySelector('#natTable tbody');
    Object.entries(natStats).sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([k,v]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${v.toLocaleString()}</td><td class="text-right">\${pct(v, valid.length)}</td>\`;
        natBody.appendChild(tr);
    });

    // Payment
    const payStats = {};
    valid.forEach(o => { const p = o['付款方式']; payStats[p] = (payStats[p]||0)+1; });
    const payBody = document.querySelector('#paymentTable tbody');
    Object.entries(payStats).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${v.toLocaleString()}</td><td class="text-right">\${pct(v, valid.length)}</td>\`;
        payBody.appendChild(tr);
    });

    // Pickup
    const pickupStats = {};
    valid.forEach(o => { const p = o['取票方式']; if(p) pickupStats[p] = (pickupStats[p]||0)+1; });
    const pickupBody = document.querySelector('#pickupTable tbody');
    Object.entries(pickupStats).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${v.toLocaleString()}</td><td class="text-right">\${pct(v, valid.length)}</td>\`;
        pickupBody.appendChild(tr);
    });

    // Ticket Type
    const typeStats = {};
    valid.forEach(o => { const t = o['票別'] || '其他'; typeStats[t] = typeStats[t] || { c: 0, r: 0 }; typeStats[t].c++; typeStats[t].r += (o['售價']||0); });
    const ttBody = document.querySelector('#ticketTypeTable tbody');
    Object.entries(typeStats).sort((a,b)=>b[1].c-a[1].c).forEach(([k,v]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${v.c.toLocaleString()}</td><td class="text-right">\${fmtMoney(v.r)}</td><td class="text-right">\${pct(v.c, valid.length)}</td>\`;
        ttBody.appendChild(tr);
    });

    // Price Table
    const pStats = {};
    valid.forEach(o => { const p = Math.round(o['售價']||0); pStats[p] = pStats[p] || { c: 0, r: 0 }; pStats[p].c++; pStats[p].r += p; });
    const maxPCount = Math.max(...Object.values(pStats).map(s=>s.c));
    const pBody = document.querySelector('#priceTable tbody');
    Object.entries(pStats).sort((a,b)=>b[0]-a[0]).filter(([p]) => parseInt(p) > 0).forEach(([p, s]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>$\${parseInt(p).toLocaleString()}</td><td class="text-right">\${s.c.toLocaleString()}</td><td class="text-right">\${fmtMoney(s.r)}</td><td><div class="progress-bar"><div class="progress-fill" style="width:\${s.c/maxPCount*100}%"></div></div></td>\`;
        pBody.appendChild(tr);
    });

    // Sales Channel
    const chStats = {};
    valid.forEach(o => { const c = o['銷售點']; if(c) { chStats[c] = chStats[c] || { c: 0, r: 0 }; chStats[c].c++; chStats[c].r += (o['售價']||0); } });
    const chBody = document.querySelector('#channelTable tbody');
    Object.entries(chStats).sort((a,b)=>b[1].c-a[1].c).slice(0,20).forEach(([k,v]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${v.c.toLocaleString()}</td><td class="text-right">\${fmtMoney(v.r)}</td><td class="text-right">\${pct(v.c, valid.length)}</td>\`;
        chBody.appendChild(tr);
    });

    // Peak Analysis - 2026-05-13 08:00-10:00
    const peakDate = '2026-05-13';
    const peakStats = {};
    for (let h = 8; h <= 9; h++) {
        for (let m = 0; m < 60; m++) {
            const key = (h<10?'0'+h:h) + ':' + (m<10?'0'+m:m);
            peakStats[key] = { t: 0, c: 0, a: 0 };
        }
    }
    // Add 10:00
    peakStats['10:00'] = { t: 0, c: 0, a: 0 };

    valid.forEach(o => {
        if (o['交易時間'] && o['交易時間'].startsWith(peakDate)) {
            const hm = o['交易時間'].split(' ')[1].substring(0, 5);
            if (peakStats[hm]) {
                peakStats[hm].t++;
                const pay = (o['付款方式'] || '');
                if (pay.includes('信用卡') || pay.includes('刷卡')) peakStats[hm].c++;
                else peakStats[hm].a++;
            }
        }
    });

    const peakBody = document.querySelector('#peakTable tbody');
    let cum = 0;
    Object.keys(peakStats).sort().forEach(k => {
        const s = peakStats[k];
        cum += s.t;
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${s.t}</td><td class="text-right">\${cum}</td><td class="text-right">\${s.c}</td><td class="text-right">\${s.a}</td><td class="text-right">\${valid.length > 0 ? (cum/valid.length*100).toFixed(1)+'%' : '0%'}</td>\`;
        if (s.t > 0) tr.style.background = 'rgba(255,179,0,0.07)';
        peakBody.appendChild(tr);
    });
}
init();
</script>
</body>
</html>`;

        const fileName = 'A_KaohsiungBeerFestival_2026.html';
        const filePath = path.join(__dirname, fileName);
        fs.writeFileSync(filePath, htmlContent);
        console.log(`Report generated: ${filePath} (${Math.round(fs.statSync(filePath).size/1024)} KB)`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

generateReport();
