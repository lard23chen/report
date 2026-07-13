require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1 } });

function hm(isoStr) {
    const d = new Date(isoStr);
    const s = d.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
    return s.split(' ')[1].substring(0, 5);
}

async function generate() {
    await client.connect();
    const db = client.db('QwareAi');

    const ranges = [
        { label: '5/13', sStart: new Date('2026-05-13T03:30:00Z'), sEnd: new Date('2026-05-13T05:00:00Z') },
        { label: '5/14', sStart: new Date('2026-05-14T03:30:00Z'), sEnd: new Date('2026-05-14T05:00:00Z') },
    ];

    const allData = {};
    for (const r of ranges) {
        const sessions = await db.collection('QwareTrafficSession').find({
            CreateTime: { $gte: r.sStart, $lte: r.sEnd }
        }).sort({ CreateTime: 1 }).toArray();

        const reads = await db.collection('QwareTrafficGAReadTime').find({
            CreateTime: { $gte: r.sStart, $lte: r.sEnd }
        }).sort({ CreateTime: 1 }).toArray();

        const byMin = {};
        for (let h = 11; h <= 12; h++) {
            for (let m = (h === 11 ? 30 : 0); m < 60; m++) {
                const k = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                byMin[k] = { session: 0, dMin: 0, aMin: 0 };
            }
        }
        sessions.forEach(s => { const k = hm(s.CreateTime); if (byMin[k]) byMin[k].session += (s.SessionCount || 0); });
        reads.forEach(s => {
            const k = hm(s.CreateTime);
            if (byMin[k]) { byMin[k].dMin += (s.ActiveUsersDMinCount || 0); byMin[k].aMin += (s.ActiveUsersAMinCount || 0); }
        });
        allData[r.label] = byMin;
    }

    const keys = Object.keys(allData['5/13']).sort();

    // 30-min segments
    const segs = [
        { label: '11:30–11:59', keys: keys.filter(k => k >= '11:30' && k <= '11:59') },
        { label: '12:00–12:29', keys: keys.filter(k => k >= '12:00' && k <= '12:29') },
        { label: '12:30–12:59', keys: keys.filter(k => k >= '12:30' && k <= '12:59') },
    ];
    const segData = segs.map(seg => {
        const r = { label: seg.label };
        ['5/13','5/14'].forEach(day => {
            r[day] = { session: 0, dMin: 0, aMin: 0, peakMin: '', peakSession: 0 };
            seg.keys.forEach(k => {
                const v = allData[day][k];
                r[day].session += v.session; r[day].dMin += v.dMin; r[day].aMin += v.aMin;
                if (v.session > r[day].peakSession) { r[day].peakSession = v.session; r[day].peakMin = k; }
            });
        });
        return r;
    });
    const totals = {};
    ['5/13','5/14'].forEach(day => {
        totals[day] = keys.reduce((a, k) => {
            a.session += allData[day][k].session;
            a.dMin += allData[day][k].dMin;
            a.aMin += allData[day][k].aMin;
            return a;
        }, { session: 0, dMin: 0, aMin: 0 });
    });

    const reportTime = new Date().toLocaleString('zh-TW');
    const fmt = n => n.toLocaleString();
    const pctDiff = (a, b) => b > 0 ? ((a/b - 1)*100).toFixed(1) : '–';

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>2026 7-ELEVEN 高雄啤酒音樂節 GA 流量分析 5/13 vs 5/14</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
<style>
:root {
    --bg: #1a1200; --card: #2a1f00; --text: #fff8e1; --sub: #ffcc80;
    --gold: #ffb300; --gold2: #ff8f00; --blue: #38bdf8; --green: #4ade80; --red: #f87171;
    --shadow: 0 8px 24px rgba(0,0,0,0.4);
}
* { box-sizing: border-box; }
body { font-family: 'Outfit','Noto Sans TC',sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 24px; }
.container { max-width: 1500px; margin: 0 auto; }
header { background: linear-gradient(135deg,#3e2800,#1a1200); padding: 32px 40px; border-radius: 20px; border-bottom: 4px solid var(--gold); margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; box-shadow: var(--shadow); }
.title { font-size: 1.8rem; font-weight: 800; background: linear-gradient(135deg,#ffb300,#ff6f00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { color: var(--gold); font-size: 0.95rem; margin-top: 6px; }
.meta { text-align: right; font-size: 0.85rem; color: var(--sub); }
.kpi-grid { display: grid; grid-template-columns: repeat(6,1fr); gap: 16px; margin-bottom: 28px; }
.kpi { background: var(--card); border-radius: 16px; padding: 20px; border: 1px solid rgba(255,179,0,0.15); }
.kpi h4 { margin: 0 0 8px; font-size: 0.75rem; text-transform: uppercase; color: var(--sub); letter-spacing: 0.5px; }
.kpi .val { font-size: 1.6rem; font-weight: 700; color: var(--gold); }
.kpi .diff { font-size: 0.8rem; margin-top: 4px; }
.up { color: var(--green); } .dn { color: var(--red); }
.card { background: var(--card); border-radius: 20px; padding: 24px; box-shadow: var(--shadow); border: 1px solid rgba(255,179,0,0.1); margin-bottom: 28px; }
.card h3 { border-left: 5px solid var(--gold); padding-left: 14px; margin: 0 0 20px; font-size: 1.05rem; color: var(--text); }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
thead th { color: var(--gold); font-weight: 600; font-size: 0.78rem; padding: 10px 12px; border-bottom: 2px solid rgba(255,179,0,0.3); white-space: nowrap; text-align: right; }
thead th:first-child { text-align: left; }
tbody td { padding: 8px 12px; border-bottom: 1px solid rgba(255,179,0,0.06); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tbody td:first-child { text-align: left; font-weight: 600; color: var(--sub); }
tbody tr:hover td { background: rgba(255,179,0,0.05); }
.seg-table thead th { font-size: 0.82rem; }
.seg-table tbody td { padding: 12px 14px; font-size: 0.9rem; }
.peak-badge { display: inline-block; background: rgba(255,179,0,0.18); color: var(--gold); border-radius: 6px; padding: 1px 7px; font-size: 0.78rem; font-weight: 700; }
.highlight { background: rgba(255,179,0,0.12) !important; }
.highlight td { color: #fff !important; font-weight: 700; }
.divider-row td { background: rgba(255,179,0,0.08) !important; font-weight: 800; color: var(--gold) !important; font-size: 0.8rem; letter-spacing: 1px; text-align: center !important; }
.chart-wrap { position: relative; height: 340px; }
</style>
</head>
<body>
<div class="container">

<header>
    <div>
        <div class="title">2026 7-ELEVEN 高雄啤酒音樂節 GA 流量分析</div>
        <div class="subtitle">ActivityID 39590 ｜ 台灣時間 11:30–13:00 ｜ 5/13（開賣首日）vs 5/14（次日）</div>
    </div>
    <div class="meta">報表生成: ${reportTime}<br>資料來源: QwareTrafficSession / QwareTrafficGAReadTime</div>
</header>

<!-- KPI -->
<div class="kpi-grid">
    <div class="kpi"><h4>5/13 Total Sessions</h4><div class="val">${fmt(totals['5/13'].session)}</div><div class="diff">基準日</div></div>
    <div class="kpi"><h4>5/13 D-Min</h4><div class="val">${fmt(totals['5/13'].dMin)}</div><div class="diff">瀏覽人次</div></div>
    <div class="kpi"><h4>5/13 A-Min</h4><div class="val">${fmt(totals['5/13'].aMin)}</div><div class="diff">主動操作人次</div></div>
    <div class="kpi"><h4>5/14 Total Sessions</h4><div class="val">${fmt(totals['5/14'].session)}</div><div class="diff up">↑ +${pctDiff(totals['5/14'].session, totals['5/13'].session)}% vs 5/13</div></div>
    <div class="kpi"><h4>5/14 D-Min</h4><div class="val">${fmt(totals['5/14'].dMin)}</div><div class="diff up">↑ +${pctDiff(totals['5/14'].dMin, totals['5/13'].dMin)}% vs 5/13</div></div>
    <div class="kpi"><h4>5/14 A-Min</h4><div class="val">${fmt(totals['5/14'].aMin)}</div><div class="diff up">↑ +${pctDiff(totals['5/14'].aMin, totals['5/13'].aMin)}% vs 5/13</div></div>
</div>

<!-- Charts -->
<div class="two-col">
    <div class="card"><h3>每分鐘 Sessions 對比</h3><div class="chart-wrap"><canvas id="sessionChart"></canvas></div></div>
    <div class="card"><h3>每分鐘 A-Min（主動操作）對比</h3><div class="chart-wrap"><canvas id="aminChart"></canvas></div></div>
</div>
<div class="card"><h3>每分鐘 D-Min（頁面瀏覽人次）對比</h3><div class="chart-wrap" style="height:260px"><canvas id="dminChart"></canvas></div></div>

<!-- 30-min segment table -->
<div class="card">
<h3>每 30 分鐘分段彙整</h3>
<table class="seg-table">
<thead><tr>
    <th>時段</th>
    <th>5/13 Sessions</th><th>5/13 D-Min</th><th>5/13 A-Min</th><th>5/13 峰值</th>
    <th>5/14 Sessions</th><th>5/14 D-Min</th><th>5/14 A-Min</th><th>5/14 峰值</th>
    <th>Sessions Δ</th><th>A-Min Δ</th>
</tr></thead>
<tbody>
${segData.map(s => `<tr>
    <td>${s.label}</td>
    <td>${fmt(s['5/13'].session)}</td><td>${fmt(s['5/13'].dMin)}</td><td>${fmt(s['5/13'].aMin)}</td>
    <td><span class="peak-badge">${s['5/13'].peakMin}（${fmt(s['5/13'].peakSession)}）</span></td>
    <td>${fmt(s['5/14'].session)}</td><td>${fmt(s['5/14'].dMin)}</td><td>${fmt(s['5/14'].aMin)}</td>
    <td><span class="peak-badge">${s['5/14'].peakMin}（${fmt(s['5/14'].peakSession)}）</span></td>
    <td class="${s['5/14'].session >= s['5/13'].session ? 'up' : 'dn'}">${s['5/14'].session >= s['5/13'].session ? '↑' : '↓'} ${Math.abs(pctDiff(s['5/14'].session, s['5/13'].session))}%</td>
    <td class="${s['5/14'].aMin >= s['5/13'].aMin ? 'up' : 'dn'}">${s['5/14'].aMin >= s['5/13'].aMin ? '↑' : '↓'} ${Math.abs(pctDiff(s['5/14'].aMin, s['5/13'].aMin))}%</td>
</tr>`).join('')}
<tr class="highlight">
    <td>合計</td>
    <td>${fmt(totals['5/13'].session)}</td><td>${fmt(totals['5/13'].dMin)}</td><td>${fmt(totals['5/13'].aMin)}</td><td>–</td>
    <td>${fmt(totals['5/14'].session)}</td><td>${fmt(totals['5/14'].dMin)}</td><td>${fmt(totals['5/14'].aMin)}</td><td>–</td>
    <td class="up">↑ +${pctDiff(totals['5/14'].session, totals['5/13'].session)}%</td>
    <td class="up">↑ +${pctDiff(totals['5/14'].aMin, totals['5/13'].aMin)}%</td>
</tr>
</tbody>
</table>
</div>

<!-- Per-minute detail -->
<div class="card">
<h3>每分鐘詳細對照表</h3>
<table id="minTable">
<thead><tr>
    <th>時間</th>
    <th>5/13 Session</th><th>5/13 D-Min</th><th>5/13 A-Min</th>
    <th>5/14 Session</th><th>5/14 D-Min</th><th>5/14 A-Min</th>
    <th>Session Δ</th><th>A-Min Δ</th>
</tr></thead>
<tbody>
${keys.map(k => {
    const a = allData['5/13'][k], b = allData['5/14'][k];
    const isHighlight = (k === '11:47' || k === '12:01' || k === '12:02' || k === '12:17');
    const isDivider = (k === '12:00' || k === '12:30');
    const sDiff = a.session > 0 ? pctDiff(b.session, a.session) : '–';
    const aDiff = a.aMin > 0 ? pctDiff(b.aMin, a.aMin) : '–';
    let row = '';
    if (isDivider) row += `<tr class="divider-row"><td colspan="9">${k === '12:00' ? '── 12:00 開賣衝擊區 ──' : '── 12:30 持續購票區 ──'}</td></tr>`;
    row += `<tr${isHighlight ? ' class="highlight"' : ''}>
        <td>${k}</td>
        <td>${fmt(a.session)}</td><td>${fmt(a.dMin)}</td><td>${fmt(a.aMin)}</td>
        <td>${fmt(b.session)}</td><td>${fmt(b.dMin)}</td><td>${fmt(b.aMin)}</td>
        <td class="${b.session >= a.session ? 'up' : 'dn'}">${sDiff !== '–' ? (b.session >= a.session ? '↑' : '↓') + Math.abs(sDiff) + '%' : '–'}</td>
        <td class="${b.aMin >= a.aMin ? 'up' : 'dn'}">${aDiff !== '–' ? (b.aMin >= a.aMin ? '↑' : '↓') + Math.abs(aDiff) + '%' : '–'}</td>
    </tr>`;
    return row;
}).join('')}
</tbody>
</table>
</div>

</div><!-- /container -->

<script>
const labels = ${JSON.stringify(keys)};
const s13 = ${JSON.stringify(keys.map(k => allData['5/13'][k].session))};
const s14 = ${JSON.stringify(keys.map(k => allData['5/14'][k].session))};
const d13 = ${JSON.stringify(keys.map(k => allData['5/13'][k].dMin))};
const d14 = ${JSON.stringify(keys.map(k => allData['5/14'][k].dMin))};
const a13 = ${JSON.stringify(keys.map(k => allData['5/13'][k].aMin))};
const a14 = ${JSON.stringify(keys.map(k => allData['5/14'][k].aMin))};

const chartOpts = (title) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#ffcc80', font: { size: 12 } } }, datalabels: { display: false } },
    scales: {
        x: { ticks: { color: '#ffcc80', maxRotation: 90, font: { size: 10 }, callback: (v, i) => (i % 5 === 0 ? labels[i] : '') }, grid: { color: 'rgba(255,179,0,0.07)' } },
        y: { ticks: { color: '#ffcc80' }, grid: { color: 'rgba(255,179,0,0.07)' } }
    }
});

new Chart(document.getElementById('sessionChart'), {
    type: 'line', plugins: [ChartDataLabels],
    data: { labels, datasets: [
        { label: '5/13', data: s13, borderColor: '#ffb300', backgroundColor: 'rgba(255,179,0,0.1)', tension: 0.3, pointRadius: 0, fill: true },
        { label: '5/14', data: s14, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.1)', tension: 0.3, pointRadius: 0, fill: true }
    ]}, options: chartOpts('Sessions')
});
new Chart(document.getElementById('aminChart'), {
    type: 'line', plugins: [ChartDataLabels],
    data: { labels, datasets: [
        { label: '5/13', data: a13, borderColor: '#ffb300', backgroundColor: 'rgba(255,179,0,0.1)', tension: 0.3, pointRadius: 0, fill: true },
        { label: '5/14', data: a14, borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.1)', tension: 0.3, pointRadius: 0, fill: true }
    ]}, options: chartOpts('A-Min')
});
new Chart(document.getElementById('dminChart'), {
    type: 'bar', plugins: [ChartDataLabels],
    data: { labels, datasets: [
        { label: '5/13', data: d13, backgroundColor: 'rgba(255,179,0,0.6)', borderRadius: 2 },
        { label: '5/14', data: d14, backgroundColor: 'rgba(56,189,248,0.6)', borderRadius: 2 }
    ]}, options: { ...chartOpts('D-Min'), scales: { x: { stacked: false, ticks: { color: '#ffcc80', maxRotation: 90, font: { size: 10 }, callback: (v, i) => (i % 5 === 0 ? labels[i] : '') }, grid: { color: 'rgba(255,179,0,0.07)' } }, y: { ticks: { color: '#ffcc80' }, grid: { color: 'rgba(255,179,0,0.07)' } } } }
});
</script>
</body>
</html>`;

    const out = path.join(__dirname, 'A_BeerFestival_GA_Analysis_2026.html');
    fs.writeFileSync(out, html);
    console.log(`Report generated: ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
    await client.close();
}

generate().catch(console.error);
