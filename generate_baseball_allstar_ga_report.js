require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

function toTaipei(d) {
    const s = new Date(d).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
    return s.split(' ')[1].substring(0, 5); // HH:MM
}

async function generate() {
    await client.connect();
    const db = client.db('QwareAi');

    const ACTIVITY_ID = 39701;
    // 6/24 Taiwan 10:30–11:59 = UTC 02:30–03:59
    const tStart = new Date('2026-06-24T02:30:00Z');
    const tEnd   = new Date('2026-06-24T03:59:59Z');

    const sessions = await db.collection('QwareTrafficSession').find({
        ActivityID: ACTIVITY_ID,
        CreateTime: { $gte: tStart, $lte: tEnd }
    }).sort({ CreateTime: 1 }).toArray();

    const reads = await db.collection('QwareTrafficGAReadTime').find({
        ActivityID: ACTIVITY_ID,
        CreateTime: { $gte: tStart, $lte: tEnd }
    }).sort({ CreateTime: 1 }).toArray();

    // Build per-minute map 10:30–11:59
    const byMin = {};
    for (let h = 10; h <= 11; h++) {
        const mStart = h === 10 ? 30 : 0;
        for (let m = mStart; m < 60; m++) {
            const k = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
            byMin[k] = { session: 0, dMin: 0, aMin: 0 };
        }
    }
    sessions.forEach(s => { const k = toTaipei(s.CreateTime); if (byMin[k]) byMin[k].session += (s.SessionCount || 0); });
    reads.forEach(r => {
        const k = r.GATime ? r.GATime.substring(0, 5) : toTaipei(r.CreateTime);
        if (byMin[k]) { byMin[k].dMin += (r.ActiveUsersDMinCount || 0); byMin[k].aMin += (r.ActiveUsersAMinCount || 0); }
    });

    const keys = Object.keys(byMin).sort();

    // 30-min segments
    const segs = [
        { label: '10:30–10:59（開賣前熱身）', keys: keys.filter(k => k >= '10:30' && k <= '10:59') },
        { label: '11:00–11:29（開賣衝擊區）', keys: keys.filter(k => k >= '11:00' && k <= '11:29') },
        { label: '11:30–11:59（持續購票區）', keys: keys.filter(k => k >= '11:30' && k <= '11:59') },
    ];
    const segData = segs.map(seg => {
        const r = { label: seg.label, session: 0, dMin: 0, aMin: 0, peakMin: '', peakSession: 0 };
        seg.keys.forEach(k => {
            const v = byMin[k];
            r.session += v.session; r.dMin += v.dMin; r.aMin += v.aMin;
            if (v.session > r.peakSession) { r.peakSession = v.session; r.peakMin = k; }
        });
        return r;
    });

    const total = { session: 0, dMin: 0, aMin: 0, peakMin: '', peakSession: 0, peakDMin: 0, peakDMinMin: '', peakAMin: 0, peakAMinMin: '' };
    keys.forEach(k => {
        const v = byMin[k];
        total.session += v.session; total.dMin += v.dMin; total.aMin += v.aMin;
        if (v.session > total.peakSession) { total.peakSession = v.session; total.peakMin = k; }
        if (v.dMin > total.peakDMin) { total.peakDMin = v.dMin; total.peakDMinMin = k; }
        if (v.aMin > total.peakAMin) { total.peakAMin = v.aMin; total.peakAMinMin = k; }
    });

    const reportTime = new Date().toLocaleString('zh-TW');
    const fmt = n => n.toLocaleString();

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>2026 台灣精品中華職棒明星對抗賽 GA 流量分析</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
<style>
:root {
    --bg: #001a0a; --card: #002a10; --text: #e8f5e9; --sub: #81c784;
    --gold: #34d399; --gold2: #10b981; --blue: #38bdf8; --green: #4ade80; --red: #f87171;
    --shadow: 0 8px 24px rgba(0,0,0,0.5);
}
* { box-sizing: border-box; }
body { font-family: 'Outfit','Noto Sans TC',sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 24px; }
.container { max-width: 1500px; margin: 0 auto; }
header { background: linear-gradient(135deg,#002a10,#001a0a); padding: 32px 40px; border-radius: 20px; border-bottom: 4px solid var(--gold); margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; box-shadow: var(--shadow); }
.title { font-size: 1.8rem; font-weight: 800; background: linear-gradient(135deg,#34d399,#10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { color: var(--gold); font-size: 0.95rem; margin-top: 6px; }
.meta { text-align: right; font-size: 0.85rem; color: var(--sub); }
.notice { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.3); border-radius: 12px; padding: 12px 20px; margin-bottom: 24px; font-size: 0.88rem; color: var(--sub); }
.kpi-grid { display: grid; grid-template-columns: repeat(6,1fr); gap: 16px; margin-bottom: 28px; }
.kpi { background: var(--card); border-radius: 16px; padding: 20px; border: 1px solid rgba(52,211,153,0.15); }
.kpi h4 { margin: 0 0 8px; font-size: 0.75rem; text-transform: uppercase; color: var(--sub); letter-spacing: 0.5px; }
.kpi .val { font-size: 1.6rem; font-weight: 700; color: var(--gold); }
.kpi .sub-val { font-size: 0.8rem; margin-top: 4px; color: #64748b; }
.card { background: var(--card); border-radius: 20px; padding: 24px; box-shadow: var(--shadow); border: 1px solid rgba(52,211,153,0.1); margin-bottom: 28px; }
.card h3 { border-left: 5px solid var(--gold); padding-left: 14px; margin: 0 0 20px; font-size: 1.05rem; color: var(--text); }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
thead th { color: var(--gold); font-weight: 600; font-size: 0.78rem; padding: 10px 12px; border-bottom: 2px solid rgba(52,211,153,0.3); white-space: nowrap; text-align: right; }
thead th:first-child { text-align: left; }
tbody td { padding: 8px 12px; border-bottom: 1px solid rgba(52,211,153,0.06); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tbody td:first-child { text-align: left; font-weight: 600; color: var(--sub); }
tbody tr:hover td { background: rgba(52,211,153,0.05); }
.seg-table thead th { font-size: 0.82rem; }
.seg-table tbody td { padding: 12px 14px; font-size: 0.9rem; }
.peak-badge { display: inline-block; background: rgba(52,211,153,0.18); color: var(--gold); border-radius: 6px; padding: 1px 7px; font-size: 0.78rem; font-weight: 700; }
.highlight-session { background: rgba(52,211,153,0.15) !important; }
.highlight-session td { color: #fff !important; font-weight: 700; }
.highlight-dmin { background: rgba(56,189,248,0.12) !important; }
.highlight-dmin td { color: #bfdbfe !important; font-weight: 700; }
.highlight-amin { background: rgba(74,222,128,0.12) !important; }
.highlight-amin td { color: #bbf7d0 !important; font-weight: 700; }
.divider-row td { background: rgba(52,211,153,0.08) !important; font-weight: 800; color: var(--gold) !important; font-size: 0.8rem; letter-spacing: 1px; text-align: center !important; }
.chart-wrap { position: relative; height: 340px; }
</style>
</head>
<body>
<div class="container">

<header>
    <div>
        <div class="title">⚾ 2026 台灣精品中華職棒明星對抗賽 GA 流量分析</div>
        <div class="subtitle">ActivityID 39701 ｜ 台灣時間 10:30–11:59 ｜ 6/24 公眾開賣日分析 ｜ 場地：臺北大巨蛋</div>
    </div>
    <div class="meta">報表生成: ${reportTime}<br>資料來源: QwareTrafficSession / QwareTrafficGAReadTime<br>監控時段: 90 分鐘</div>
</header>

<div class="notice">⚠️ 本報表僅含 2026-06-22（會員預購）及 2026-06-23（早鳥預購）後的<strong>公眾開賣首日 6/24</strong> GA 監控資料，無次日比較。開賣時間 11:00，高峰 Session 於 11:09 達 ${fmt(total.peakSession)}，D-Min 於 11:01 達 ${fmt(total.peakDMin)}，A-Min 於 11:17 達 ${fmt(total.peakAMin)}。</div>

<!-- KPI -->
<div class="kpi-grid">
    <div class="kpi"><h4>峰值 Sessions</h4><div class="val">${fmt(total.peakSession)}</div><div class="sub-val">@ ${total.peakMin}</div></div>
    <div class="kpi"><h4>峰值 D-Min</h4><div class="val">${fmt(total.peakDMin)}</div><div class="sub-val">@ ${total.peakDMinMin}</div></div>
    <div class="kpi"><h4>峰值 A-Min</h4><div class="val">${fmt(total.peakAMin)}</div><div class="sub-val">@ ${total.peakAMinMin}</div></div>
    <div class="kpi"><h4>總 Sessions (90min)</h4><div class="val">${fmt(total.session)}</div><div class="sub-val">10:30–11:59</div></div>
    <div class="kpi"><h4>總 D-Min</h4><div class="val">${fmt(total.dMin)}</div><div class="sub-val">頁面瀏覽人次</div></div>
    <div class="kpi"><h4>總 A-Min</h4><div class="val">${fmt(total.aMin)}</div><div class="sub-val">主動操作人次</div></div>
</div>

<!-- Charts -->
<div class="two-col">
    <div class="card"><h3>每分鐘 Sessions 走勢</h3><div class="chart-wrap"><canvas id="sessionChart"></canvas></div></div>
    <div class="card"><h3>每分鐘 A-Min（主動操作）走勢</h3><div class="chart-wrap"><canvas id="aminChart"></canvas></div></div>
</div>
<div class="card"><h3>每分鐘 D-Min（頁面瀏覽人次）走勢</h3><div class="chart-wrap" style="height:260px"><canvas id="dminChart"></canvas></div></div>

<!-- 30-min segment table -->
<div class="card">
<h3>每 30 分鐘分段彙整</h3>
<table class="seg-table">
<thead><tr>
    <th>時段</th>
    <th>Sessions</th><th>D-Min</th><th>A-Min</th><th>峰值時間 / Session</th>
</tr></thead>
<tbody>
${segData.map(s => `<tr>
    <td>${s.label}</td>
    <td>${fmt(s.session)}</td>
    <td>${fmt(s.dMin)}</td>
    <td>${fmt(s.aMin)}</td>
    <td><span class="peak-badge">${s.peakMin}（${fmt(s.peakSession)}）</span></td>
</tr>`).join('')}
<tr style="background:rgba(52,211,153,0.08);font-weight:700;border-top:2px solid rgba(52,211,153,0.3)">
    <td style="color:var(--gold)">合計 (10:30–11:59)</td>
    <td>${fmt(total.session)}</td>
    <td>${fmt(total.dMin)}</td>
    <td>${fmt(total.aMin)}</td>
    <td><span class="peak-badge">Session ${total.peakMin} / D-Min ${total.peakDMinMin} / A-Min ${total.peakAMinMin}</span></td>
</tr>
</tbody>
</table>
</div>

<!-- Per-minute detail -->
<div class="card">
<h3>每分鐘詳細資料表（🟢 Session峰 ｜ 🔵 D-Min峰 ｜ 🟩 A-Min峰）</h3>
<table id="minTable">
<thead><tr>
    <th>時間</th>
    <th>Sessions</th><th>D-Min</th><th>A-Min</th>
</tr></thead>
<tbody>
${keys.map(k => {
    const v = byMin[k];
    const isSessionPeak = k === total.peakMin;
    const isDMinPeak = k === total.peakDMinMin;
    const isAMinPeak = k === total.peakAMinMin;
    const isDivider11 = k === '11:00';
    const isDivider1130 = k === '11:30';
    let row = '';
    if (isDivider11) row += `<tr class="divider-row"><td colspan="4">── 11:00 開賣衝擊區 ──</td></tr>`;
    if (isDivider1130) row += `<tr class="divider-row"><td colspan="4">── 11:30 持續購票區 ──</td></tr>`;
    const cls = isSessionPeak ? ' class="highlight-session"' : isDMinPeak ? ' class="highlight-dmin"' : isAMinPeak ? ' class="highlight-amin"' : '';
    row += `<tr${cls}>
        <td>${k}${isSessionPeak ? ' 🟢' : isDMinPeak ? ' 🔵' : isAMinPeak ? ' 🟩' : ''}</td>
        <td>${fmt(v.session)}</td>
        <td>${fmt(v.dMin)}</td>
        <td>${fmt(v.aMin)}</td>
    </tr>`;
    return row;
}).join('')}
</tbody>
</table>
</div>

</div><!-- /container -->

<script>
const labels = ${JSON.stringify(keys)};
const sData  = ${JSON.stringify(keys.map(k => byMin[k].session))};
const dData  = ${JSON.stringify(keys.map(k => byMin[k].dMin))};
const aData  = ${JSON.stringify(keys.map(k => byMin[k].aMin))};

const abbr = v => v === 0 ? '' : v >= 10000 ? (v/1000).toFixed(0)+'k' : v >= 1000 ? (v/1000).toFixed(1)+'k' : v;

const xScale = { ticks: { color: '#81c784', maxRotation: 90, font: { size: 10 }, callback: (v, i) => (i % 5 === 0 ? labels[i] : '') }, grid: { color: 'rgba(52,211,153,0.07)' } };
const yScale = { ticks: { color: '#81c784' }, grid: { color: 'rgba(52,211,153,0.07)' } };

new Chart(document.getElementById('sessionChart'), {
    type: 'line', plugins: [ChartDataLabels],
    data: { labels, datasets: [{ label: '6/24 Sessions', data: sData, borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.12)', tension: 0.3, pointRadius: 2, pointHoverRadius: 5, fill: true }] },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#81c784', font: { size: 12 } } },
            datalabels: { display: true, color: 'rgba(52,211,153,0.85)', font: { size: 9, weight: '600' }, align: 'top', offset: 2, formatter: abbr }
        },
        scales: { x: xScale, y: yScale }
    }
});
new Chart(document.getElementById('aminChart'), {
    type: 'line', plugins: [ChartDataLabels],
    data: { labels, datasets: [{ label: '6/24 A-Min', data: aData, borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.12)', tension: 0.3, pointRadius: 2, pointHoverRadius: 5, fill: true }] },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#81c784', font: { size: 12 } } },
            datalabels: { display: true, color: 'rgba(74,222,128,0.85)', font: { size: 9, weight: '600' }, align: 'top', offset: 2, formatter: abbr }
        },
        scales: { x: xScale, y: yScale }
    }
});
new Chart(document.getElementById('dminChart'), {
    type: 'bar', plugins: [ChartDataLabels],
    data: { labels, datasets: [{ label: '6/24 D-Min', data: dData, backgroundColor: 'rgba(56,189,248,0.6)', borderRadius: 2 }] },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#81c784', font: { size: 12 } } },
            datalabels: { display: true, color: 'rgba(56,189,248,0.9)', font: { size: 9, weight: '600' }, anchor: 'end', align: 'top', offset: 1, formatter: abbr }
        },
        scales: { x: xScale, y: yScale }
    }
});
</script>
</body>
</html>`;

    const out = path.join(__dirname, 'A_BaseballAllStar_GA_Analysis_2026.html');
    fs.writeFileSync(out, html);
    console.log(`Report generated: ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
    await client.close();
}

generate().catch(console.error);
