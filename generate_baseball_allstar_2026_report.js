require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function generateReport() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");

        const TARGET = '2026年台灣精品中華職棒明星對抗賽';
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
    <title>2026 台灣精品中華職棒明星對抗賽 - 專案分析報表</title>
    <!-- IP Allowlist: internal network only -->
    <style>html { visibility: hidden; }<\/style>
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
                    '<div style="font-size:5rem;margin-bottom:20px">🔒<\/div>' +
                    '<h1 style="color:#ef4444;font-size:2rem;margin:0 0 14px">存取被拒絕<\/h1>' +
                    '<p style="color:#94a3b8;margin:0 0 8px">您目前的 IP 位址：' +
                    '<code style="background:#1e293b;padding:2px 10px;border-radius:4px;color:#f472b6">' + ip + '<\/code><\/p>' +
                    '<p style="color:#64748b;font-size:0.88rem">此頁面僅限內部網路存取 &middot; Access restricted to internal network only<\/p>' +
                    '<\/div>';
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
    <\/script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-color: #34d399;
            --accent-secondary: #10b981;
            --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            --success: #22c55e;
            --danger: #ef4444;
        }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background-color: var(--bg-color); color: var(--text-primary); margin: 0; padding: 30px; }
        .container { max-width: 1400px; margin: 0 auto; }
        header { margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; background: linear-gradient(to right, #1e293b, #0f172a); padding: 40px; border-radius: 24px; box-shadow: var(--shadow); border-bottom: 4px solid var(--accent-color); }
        .logo-text { font-size: 2.5rem; font-weight: 800; background: linear-gradient(135deg, #34d399, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; letter-spacing: -1px; }
        .logo-sub { font-size: 1.1rem; color: var(--accent-color); margin-top: 8px; font-weight: 600; }
        .meta { text-align: right; font-size: 0.95rem; color: var(--text-secondary); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 25px; margin-bottom: 40px; }
        .card { background: var(--card-bg); border-radius: 20px; padding: 25px; box-shadow: var(--shadow); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s; }
        .card:hover { border-color: var(--accent-color); transform: translateY(-5px); }
        .card h3 { margin: 0 0 15px 0; font-size: 0.85em; text-transform: uppercase; color: var(--text-secondary); }
        .card .value { font-size: 2.2em; font-weight: 700; color: var(--accent-color); }
        .card .sub { font-size: 0.85em; color: #64748b; margin-top: 8px; }
        .chart-card { background: var(--card-bg); border-radius: 24px; padding: 30px; box-shadow: var(--shadow); min-height: 400px; border: 1px solid rgba(255, 255, 255, 0.05); margin-bottom: 30px; }
        .chart-card h3 { border-left: 5px solid var(--accent-color); padding-left: 15px; margin-bottom: 25px; font-size: 1.25rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.95em; }
        th, td { padding: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        th { color: var(--accent-color); font-weight: 600; font-size: 0.85rem; white-space: nowrap; }
        td { white-space: nowrap; }
        tr:hover td { background: rgba(52, 211, 153, 0.05); }
        .text-right { text-align: right; }
        .peak-table-container { overflow-x: auto; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; background: rgba(15, 23, 42, 0.5); }
        .main-content { display: grid; grid-template-columns: 2fr 1fr; gap: 25px; margin-bottom: 30px; }
        .demo-content { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px; }
        .show-split { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px; }
        .progress-bar { background: rgba(255,255,255,0.05); width: 100%; border-radius: 10px; height: 8px; margin-top: 8px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--accent-color); border-radius: 10px; }
        .pdf-btn { display: inline-flex; align-items: center; gap: 8px; margin-top: 16px; padding: 10px 22px; background: var(--accent-color); color: #0f172a; border: none; border-radius: 10px; font-family: inherit; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .pdf-btn:hover { background: var(--accent-secondary); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(52,211,153,0.4); }
        @media print {
            @page { size: A3 landscape; margin: 10mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .pdf-btn { display: none !important; }
            body { padding: 0 !important; background-color: var(--bg-color) !important; }
            .container { max-width: none !important; }
            .stats-grid { grid-template-columns: repeat(6, 1fr) !important; }
            .main-content { grid-template-columns: 2fr 1fr !important; }
            .demo-content { grid-template-columns: 1fr 1fr !important; }
            .show-split { grid-template-columns: 1fr 1fr !important; }
            .chart-card, .card { break-inside: avoid; page-break-inside: avoid; }
            .chart-card { min-height: 0 !important; }
            canvas { max-width: 100% !important; }
        }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div>
            <div class="logo-text">⚾ 2026 台灣精品中華職棒明星對抗賽</div>
            <div class="logo-sub">7-ELEVEN 中華職棒明星對抗賽 專案銷售分析報表 ｜ 臺北大巨蛋</div>
        </div>
        <div style="text-align:right">
            <div class="meta">報表生成: ${reportTime}<br>銷售紀錄: ${data.length.toLocaleString()} 筆<br>節目代碼: B0BN5Y8D</div>
            <button class="pdf-btn" id="pdf-btn" onclick="downloadPDF()">⬇ 下載 PDF</button>
        </div>
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

    <!-- Show Breakdown Table -->
    <div class="main-content" style="grid-template-columns: 1fr;">
        <div class="chart-card" style="min-height:0">
            <h3>各場次銷售概覽 (Show Breakdown)</h3>
            <table id="showBreakdownTable">
                <thead><tr>
                    <th>場次</th>
                    <th class="text-right">成交金額</th>
                    <th class="text-right">銷售張數</th>
                    <th class="text-right">平均客單價 (AOV)</th>
                    <th class="text-right">淨營收</th>
                    <th class="text-right">淨銷售張數</th>
                    <th class="text-right">退票金額</th>
                    <th class="text-right">退票張數</th>
                    <th class="text-right">退票手續費</th>
                </tr></thead>
                <tbody></tbody>
            </table>
        </div>
    </div>

    <!-- Show Split -->
    <h2 style="color: var(--accent-color); margin-bottom: 16px; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px;">⚾ 場次銷售概況</h2>
    <div class="show-split" id="showCards"></div>

    <!-- Trend + Nationality -->
    <div class="main-content">
        <div class="chart-card"><h3>每日銷售趨勢 (Daily Sales)</h3><canvas id="trendChart"></canvas></div>
        <div class="chart-card" style="min-height:0">
            <h3>國籍統計</h3>
            <table id="natTable"><thead><tr><th>國籍</th><th class="text-right">張數</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
        </div>
    </div>

    <!-- Daily by Session -->
    <div class="chart-card" style="min-height:0">
        <h3>每日各場次購票趨勢 (Daily Sales by Session)</h3>
        <canvas id="sessionTrendChart" style="max-height:380px;"></canvas>
    </div>

    <!-- Gender + Age -->
    <div class="demo-content">
        <div class="chart-card"><h3>性別分佈</h3><canvas id="genderChart"></canvas></div>
        <div class="chart-card"><h3>年齡分佈</h3><canvas id="ageChart"></canvas></div>
    </div>

    <!-- City + Payment -->
    <div class="demo-content">
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
    <div class="demo-content">
        <div class="chart-card" style="min-height:0">
            <h3>票別分析</h3>
            <table id="ticketTypeTable"><thead><tr><th>票別</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
        </div>
        <div class="chart-card" style="min-height:0">
            <h3>票價分析</h3>
            <table id="priceTable"><thead><tr><th>票價</th><th class="text-right">張數</th><th class="text-right">金額</th><th>占比</th></tr></thead><tbody></tbody></table>
        </div>
    </div>

    <!-- Seat Zone -->
    <div class="chart-card" style="min-height:0">
        <h3>座位區域分析 Top 20</h3>
        <table id="seatZoneTable"><thead><tr><th>座位區域</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
    </div>

    <!-- Sales Channel -->
    <div class="chart-card" style="min-height:0">
        <h3>銷售點分析 Top 20</h3>
        <table id="channelTable"><thead><tr><th>銷售點</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
    </div>

    <!-- Peak Analysis -->
    <div class="chart-card" style="min-height:0">
        <h3>開賣尖峰時段分析 (2026-06-22 14:00 – 15:00)</h3>
        <div class="peak-table-container">
            <table id="peakTable">
                <thead><tr><th>時間</th><th class="text-right">當分鐘張數</th><th class="text-right">累計張數</th><th class="text-right">信用卡</th><th class="text-right">現金</th><th class="text-right">累計轉換率</th></tr></thead>
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

    // Show Breakdown Table
    const showDates = [...new Set(dbData.map(o => (o['演出時間/規格'] || '').substring(0, 10)).filter(d => d && d.startsWith('20')))].sort();
    const sbTbody = document.querySelector('#showBreakdownTable tbody');
    let grandRev = 0, grandTix = 0, grandNet = 0, grandNetTix = 0, grandRefAmt = 0, grandRefTix = 0, grandRefFees = 0;
    showDates.forEach(showDate => {
        const sv = valid.filter(o => (o['演出時間/規格'] || '').startsWith(showDate));
        const sr = refund.filter(o => (o['演出時間/規格'] || '').startsWith(showDate));
        const sRev = sv.reduce((a, c) => a + (c['售價'] || 0), 0);
        const sTix = sv.length;
        const sRefAmt = sr.reduce((a, c) => a + (c['實退金額'] || 0), 0);
        const sRefTix = sr.length;
        const sRefFees = sr.reduce((a, c) => a + (c['手續費'] || 0), 0);
        const sOrdSet = new Set(); sv.forEach(o => { if(o['訂單編號']) sOrdSet.add(o['訂單編號'].split('_')[0]); });
        const sAov = sOrdSet.size > 0 ? Math.round(sRev / sOrdSet.size) : 0;
        const sNet = sRev - sRefAmt;
        const sNetTix = sTix - sRefTix;
        const fullSpec = (dbData.find(o => (o['演出時間/規格'] || '').startsWith(showDate)) || {})['演出時間/規格'] || showDate;
        const timeLabel = fullSpec.length >= 16 ? fullSpec.substring(0, 16) : fullSpec;
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td style="font-weight:600; color:var(--accent-color); white-space:nowrap;">\${timeLabel}</td>
            <td class="text-right">\${fmtMoney(sRev)}</td>
            <td class="text-right" style="font-weight:600;">\${fmt(sTix)}</td>
            <td class="text-right" style="color:#ffd700;">\${fmtMoney(sAov)}</td>
            <td class="text-right" style="color:var(--success);">\${fmtMoney(sNet)}</td>
            <td class="text-right" style="color:var(--success);">\${fmt(sNetTix)}</td>
            <td class="text-right" style="color:var(--danger);">\${fmtMoney(sRefAmt)}</td>
            <td class="text-right" style="color:var(--danger);">\${fmt(sRefTix)}</td>
            <td class="text-right">\${fmtMoney(sRefFees)}</td>\`;
        sbTbody.appendChild(tr);
        grandRev += sRev; grandTix += sTix; grandNet += sNet; grandNetTix += sNetTix;
        grandRefAmt += sRefAmt; grandRefTix += sRefTix; grandRefFees += sRefFees;
    });
    const totalOrdSet = new Set(); valid.forEach(o => { if(o['訂單編號']) totalOrdSet.add(o['訂單編號'].split('_')[0]); });
    const grandAov = totalOrdSet.size > 0 ? Math.round(grandRev / totalOrdSet.size) : 0;
    const totalTr = document.createElement('tr');
    totalTr.style.cssText = 'background:rgba(52,211,153,0.08); border-top:2px solid rgba(52,211,153,0.4); font-weight:700;';
    totalTr.innerHTML = \`<td style="color:var(--accent-color);">總計 (TOTAL)</td>
        <td class="text-right">\${fmtMoney(grandRev)}</td>
        <td class="text-right" style="font-weight:700;">\${fmt(grandTix)}</td>
        <td class="text-right" style="color:#ffd700;">\${fmtMoney(grandAov)}</td>
        <td class="text-right" style="color:var(--success);">\${fmtMoney(grandNet)}</td>
        <td class="text-right" style="color:var(--success);">\${fmt(grandNetTix)}</td>
        <td class="text-right" style="color:var(--danger);">\${fmtMoney(grandRefAmt)}</td>
        <td class="text-right" style="color:var(--danger);">\${fmt(grandRefTix)}</td>
        <td class="text-right">\${fmtMoney(grandRefFees)}</td>\`;
    sbTbody.appendChild(totalTr);

    // Show Cards (2 shows)
    const shows = [
        { date: '2026-07-18', label: '7/18 (六) 18:05 Day 1' },
        { date: '2026-07-19', label: '7/19 (日) 17:05 Day 2' }
    ];
    const showContainer = document.getElementById('showCards');
    shows.forEach(s => {
        const cnt = valid.filter(d => d['演出時間/規格'] && d['演出時間/規格'].includes(s.date)).length;
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = \`<h3>\${s.label}</h3><div class="value">\${cnt.toLocaleString()} 張</div><div class="sub">\${pct(cnt, valid.length)} 占比</div><div class="progress-bar"><div class="progress-fill" style="width:\${valid.length > 0 ? cnt/valid.length*100 : 0}%"></div></div>\`;
        showContainer.appendChild(div);
    });

    // Trend Chart
    const tStats = {};
    valid.forEach(o => { const d = o['交易時間'] ? o['交易時間'].split(' ')[0] : '未知'; tStats[d] = (tStats[d]||0)+1; });
    const sortedDays = Object.keys(tStats).sort();
    new Chart(document.getElementById('trendChart'), {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: { labels: sortedDays, datasets: [{ label: '張數', data: sortedDays.map(d => tStats[d]), backgroundColor: '#34d399', borderRadius: 6 }] },
        options: { plugins: { legend: { display: false }, datalabels: { color: '#94a3b8', anchor: 'end', align: 'top', font: { size: 11 } } }, scales: { y: { ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } } }
    });

    // Daily by Session Chart
    const sessionShows = [
        { date: '2026-07-18', label: '7/18 (六) Day 1', color: '#34d399' },
        { date: '2026-07-19', label: '7/19 (日) Day 2', color: '#818cf8' }
    ];
    const sessionDailyMap = {};
    valid.forEach(o => {
        const purchaseDate = o['交易時間'] ? o['交易時間'].split(' ')[0] : null;
        if (!purchaseDate) return;
        if (!sessionDailyMap[purchaseDate]) sessionDailyMap[purchaseDate] = {};
        const matchedShow = sessionShows.find(s => o['演出時間/規格'] && o['演出時間/規格'].includes(s.date));
        const showKey = matchedShow ? matchedShow.date : '其他';
        sessionDailyMap[purchaseDate][showKey] = (sessionDailyMap[purchaseDate][showKey] || 0) + 1;
    });
    const sessionDays = Object.keys(sessionDailyMap).sort();
    new Chart(document.getElementById('sessionTrendChart'), {
        type: 'line',
        plugins: [ChartDataLabels],
        data: {
            labels: sessionDays,
            datasets: sessionShows.map(s => ({
                label: s.label,
                data: sessionDays.map(d => sessionDailyMap[d][s.date] || 0),
                borderColor: s.color,
                backgroundColor: s.color + '33',
                fill: false,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }))
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#94a3b8' } },
                datalabels: {
                    display: true,
                    align: 'top',
                    anchor: 'end',
                    font: { size: 10, weight: '600' },
                    color: (ctx) => ctx.dataset.borderColor,
                    formatter: (v) => v > 0 ? v.toLocaleString() : ''
                },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' } },
                y: { ticks: { color: '#94a3b8' }, beginAtZero: true }
            }
        }
    });

    // Gender Chart
    const gStats = {};
    valid.forEach(o => { const g = o['性別']; if(g && g !== '-') gStats[g] = (gStats[g]||0)+1; });
    new Chart(document.getElementById('genderChart'), {
        type: 'doughnut',
        data: { labels: Object.keys(gStats), datasets: [{ data: Object.values(gStats), backgroundColor: ['#fb7185','#34d399','#94a3b8','#a78bfa'] }] },
        plugins: [ChartDataLabels],
        options: { plugins: { datalabels: { color: 'white', font: { weight: 'bold' }, formatter: (v, ctx) => { const t = ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0); return Math.round(v/t*100)+'%'; } }, legend: { labels: { color: '#94a3b8' } } } }
    });

    // Age Chart
    const ageOrder = ['<20','20s','30s','40s','50+','未知'];
    const ageStats = {};
    valid.forEach(o => { const a = parseInt(o['年齡']); let l = isNaN(a) ? '未知' : (a<20?'<20':a<30?'20s':a<40?'30s':a<50?'40s':'50+'); ageStats[l] = (ageStats[l]||0)+1; });
    const ageLabels = ageOrder.filter(k => ageStats[k]);
    new Chart(document.getElementById('ageChart'), {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: { labels: ageLabels, datasets: [{ data: ageLabels.map(k => ageStats[k]), backgroundColor: '#34d399', borderRadius: 6 }] },
        options: { plugins: { legend: { display: false }, datalabels: { color: '#94a3b8', anchor: 'end', align: 'top', font: { size: 11, weight: '600' }, formatter: v => v.toLocaleString() } }, scales: { y: { ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } } }
    });

    // City Chart
    const cityStats = {};
    valid.forEach(o => { const c = o['縣市別_resolved']; if(c && c !== '格式不符' && c !== '未知') cityStats[c] = (cityStats[c]||0)+1; });
    const topCities = Object.entries(cityStats).sort((a,b) => b[1]-a[1]).slice(0, 10);
    new Chart(document.getElementById('cityChart'), {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: { labels: topCities.map(c=>c[0]), datasets: [{ data: topCities.map(c=>c[1]), backgroundColor: '#818cf8', borderRadius: 4 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, datalabels: { color: '#f8fafc', anchor: 'end', align: 'right', font: { size: 11, weight: '600' }, formatter: v => v.toLocaleString() } }, scales: { y: { ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } } }
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

    // Seat Zone Table
    const seatStats = {};
    valid.forEach(o => { const z = o['座位資訊/票區'] || '未知'; seatStats[z] = seatStats[z] || { c: 0, r: 0 }; seatStats[z].c++; seatStats[z].r += (o['售價']||0); });
    const szBody = document.querySelector('#seatZoneTable tbody');
    Object.entries(seatStats).sort((a,b)=>b[1].c-a[1].c).slice(0,20).forEach(([k,v]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${v.c.toLocaleString()}</td><td class="text-right">\${fmtMoney(v.r)}</td><td class="text-right">\${pct(v.c, valid.length)}</td>\`;
        szBody.appendChild(tr);
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

    // Peak Analysis - 2026-06-22 14:00-15:00
    const peakDate = '2026-06-22';
    const peakStats = {};
    for (let m = 0; m < 60; m++) {
        const key = '14:' + (m<10?'0'+m:m);
        peakStats[key] = { t: 0, c: 0, a: 0 };
    }
    peakStats['15:00'] = { t: 0, c: 0, a: 0 };

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
        if (s.t > 0) tr.style.background = 'rgba(52,211,153,0.06)';
        peakBody.appendChild(tr);
    });
}
init();

function downloadPDF() {
    window.print();
}
<\/script>
</body>
</html>`;

        const fileName = 'A_BaseballAllStar_2026.html';
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
