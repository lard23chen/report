require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

function parsePrice(v) {
    if (!v) return 0;
    if (v.$numberDecimal) return parseFloat(v.$numberDecimal);
    return parseFloat(v) || 0;
}

async function generate() {
    await client.connect();
    const db = client.db('QwareAi');

    console.log('Fetching 36年 Rakuten data from Qware_A_Ticket_2025_Data...');
    const data = await db.collection('Qware_A_Ticket_2025_Data').find({
        '節目/商品名稱': { $regex: '中華職棒36年Rakuten', $options: 'i' }
    }).toArray();
    console.log(`Fetched ${data.length} records.`);

    // Normalize prices
    data.forEach(d => {
        d['售價']     = parsePrice(d['售價']);
        d['原價']     = parsePrice(d['原價']);
        d['實退金額'] = parsePrice(d['實退金額']);
        d['手續費']   = parsePrice(d['手續費']);
    });

    // Fetch member data
    const memberIds = [...new Set(data.map(d => d['會員編號']).filter(id => id && id !== '-'))];
    console.log(`Fetching ${memberIds.length} member records...`);
    const members = await db.collection('Qware_Member_data').find({ '會員編號': { $in: memberIds } }).toArray();
    const natMap = {}, cityMap = {};
    members.forEach(m => {
        if (!m['會員編號']) return;
        if (m['國家'])   natMap[m['會員編號']]  = m['國家'];
        if (m['縣市別']) cityMap[m['會員編號']] = m['縣市別'];
    });
    console.log(`Loaded ${members.length} member records.`);

    const valid  = data.filter(d => d['狀態'] === '正常');
    const refund = data.filter(d => d['狀態'] === '退票' || d['狀態'] === '已退票');

    // ── KPI ───────────────────────────────────────────────────
    const totalRev  = valid.reduce((a, c) => a + c['售價'], 0);
    const refundAmt = refund.reduce((a, c) => a + c['實退金額'], 0);
    const refundFee = refund.reduce((a, c) => a + c['手續費'], 0);
    const orderSet  = new Set(valid.map(d => d['訂單編號'] ? d['訂單編號'].split('_')[0] : '').filter(Boolean));
    const kpi = {
        revenue: totalRev, tickets: valid.length, orders: orderSet.size,
        aov: orderSet.size > 0 ? totalRev / orderSet.size : 0,
        refundTickets: refund.length, refundAmt, refundFee, netRevenue: totalRev - refundAmt,
        totalRecords: data.length
    };

    // ── Show Breakdown ─────────────────────────────────────────
    const showDates = [...new Set(data.map(d => (d['演出時間/規格'] || '').substring(0, 10)).filter(d => d.startsWith('20')))].sort();
    const showBreakdown = showDates.map(sd => {
        const sv = valid.filter(d => (d['演出時間/規格'] || '').startsWith(sd));
        const sr = refund.filter(d => (d['演出時間/規格'] || '').startsWith(sd));
        const sRev    = sv.reduce((a, c) => a + c['售價'], 0);
        const sRefAmt = sr.reduce((a, c) => a + c['實退金額'], 0);
        const sRefFee = sr.reduce((a, c) => a + c['手續費'], 0);
        const sOrdSet = new Set(sv.map(d => d['訂單編號'] ? d['訂單編號'].split('_')[0] : '').filter(Boolean));
        const fullSpec = (data.find(d => (d['演出時間/規格'] || '').startsWith(sd)) || {})['演出時間/規格'] || sd;
        const venue = (sv[0] || sr[0] || data.find(d => (d['演出時間/規格']||'').startsWith(sd)) || {})['場地'] || '';
        // Determine if this is 總冠軍賽
        const isChamp = data.some(d => (d['演出時間/規格']||'').startsWith(sd) && (d['節目/商品名稱']||'').includes('總冠軍賽'));
        return {
            date: sd, spec: fullSpec, venue, isChamp,
            tickets: sv.length, rev: sRev, orders: sOrdSet.size,
            aov: sOrdSet.size > 0 ? Math.round(sRev / sOrdSet.size) : 0,
            netRev: sRev - sRefAmt,
            refTickets: sr.length, refAmt: sRefAmt, refFee: sRefFee
        };
    });

    // ── Sub-event type breakdown ───────────────────────────────
    const subNames = [...new Set(data.map(d => d['節目/商品名稱']))];
    const subBreakdown = subNames.map(n => {
        const sv = valid.filter(d => d['節目/商品名稱'] === n);
        const label = n
            .replace('中華職棒36年Rakuten主場例行賽', '')
            .replace('中華職棒36年Rakuten主場', '')
            .trim() || '主場例行賽（主）';
        return { name: label, tickets: sv.length, rev: sv.reduce((a,c) => a + c['售價'], 0) };
    }).sort((a, b) => b.tickets - a.tickets);

    // ── Monthly purchase trend ────────────────────────────────
    const monthlyMap = {};
    valid.forEach(d => {
        if (!d['交易時間']) return;
        const ym = d['交易時間'].substring(0, 7);
        monthlyMap[ym] = monthlyMap[ym] || { count: 0, rev: 0 };
        monthlyMap[ym].count++; monthlyMap[ym].rev += d['售價'];
    });
    const monthly = Object.entries(monthlyMap).sort().map(([m, v]) => ({ month: m, ...v }));

    // ── Daily purchase trend ──────────────────────────────────
    const dailyMap = {};
    valid.forEach(d => {
        if (!d['交易時間']) return;
        const day = d['交易時間'].substring(0, 10);
        dailyMap[day] = (dailyMap[day] || 0) + 1;
    });
    const daily = Object.entries(dailyMap).sort().map(([d, c]) => ({ date: d, count: c }));

    // ── Venue ─────────────────────────────────────────────────
    const venueMap = {};
    valid.forEach(d => { const v = d['場地'] || '未知'; venueMap[v] = (venueMap[v] || 0) + 1; });
    const venues = Object.entries(venueMap).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({ name, count }));

    // ── Gender ────────────────────────────────────────────────
    const genderMap = {};
    valid.forEach(d => { const g = d['性別']; if (g && g !== '-') genderMap[g] = (genderMap[g]||0)+1; });

    // ── Age ───────────────────────────────────────────────────
    const ageOrder = ['<20','20s','30s','40s','50+','未知'];
    const ageMap = {};
    valid.forEach(d => {
        const a = parseInt(d['年齡']);
        const l = isNaN(a) ? '未知' : a < 20 ? '<20' : a < 30 ? '20s' : a < 40 ? '30s' : a < 50 ? '40s' : '50+';
        ageMap[l] = (ageMap[l] || 0) + 1;
    });
    const ageData = ageOrder.filter(k => ageMap[k]).map(k => ({ label: k, count: ageMap[k] }));

    // ── City (via member) ─────────────────────────────────────
    const cityMapStat = {};
    valid.forEach(d => {
        const mid = d['會員編號'];
        const city = (mid && cityMap[mid]) ? cityMap[mid] : null;
        if (city && city !== '格式不符' && city !== '未知') cityMapStat[city] = (cityMapStat[city]||0)+1;
    });
    const cities = Object.entries(cityMapStat).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({ name, count }));

    // ── Nationality ───────────────────────────────────────────
    const natStat = {};
    valid.forEach(d => {
        const mid = d['會員編號'];
        const nat = (mid && natMap[mid]) ? natMap[mid] : '未知';
        natStat[nat] = (natStat[nat]||0)+1;
    });
    const nationalities = Object.entries(natStat).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({ name, count }));

    // ── Payment / Pickup ──────────────────────────────────────
    const payMap = {}, pickupMap = {};
    valid.forEach(d => {
        const p = d['付款方式']; if (p) payMap[p] = (payMap[p]||0)+1;
        const k = d['取票方式']; if (k) pickupMap[k] = (pickupMap[k]||0)+1;
    });
    const payments = Object.entries(payMap).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({ name, count }));
    const pickups  = Object.entries(pickupMap).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({ name, count }));

    // ── Ticket Type ───────────────────────────────────────────
    const typeMap = {};
    valid.forEach(d => { const t = d['票別']||'其他'; typeMap[t] = typeMap[t]||{count:0,rev:0}; typeMap[t].count++; typeMap[t].rev+=d['售價']; });
    const ticketTypes = Object.entries(typeMap).sort((a,b)=>b[1].count-a[1].count).map(([name,v])=>({ name, ...v }));

    // ── Price ─────────────────────────────────────────────────
    const priceMap = {};
    valid.forEach(d => { const p = Math.round(d['售價']); if (p>0) { priceMap[p]=priceMap[p]||{count:0,rev:0}; priceMap[p].count++; priceMap[p].rev+=p; } });
    const prices = Object.entries(priceMap).sort((a,b)=>b[0]-a[0]).map(([price,v])=>({ price:parseInt(price), ...v }));
    const maxPriceCount = prices.length > 0 ? Math.max(...prices.map(p=>p.count)) : 1;

    // ── Sales Channel ─────────────────────────────────────────
    const chMap = {};
    valid.forEach(d => { const c = d['銷售點']; if(c) { chMap[c]=chMap[c]||{count:0,rev:0}; chMap[c].count++; chMap[c].rev+=d['售價']; } });
    const channels = Object.entries(chMap).sort((a,b)=>b[1].count-a[1].count).slice(0,20).map(([name,v])=>({ name, ...v }));

    const reportTime = new Date().toLocaleString('zh-TW');

    // ── Show chart data ───────────────────────────────────────
    const showChartData = {
        labels: showBreakdown.map(s => s.date.substring(5)),
        tickets: showBreakdown.map(s => s.tickets),
        venues: showBreakdown.map(s => s.venue),
        isChamp: showBreakdown.map(s => s.isChamp)
    };

    const statsJson = JSON.stringify({
        kpi, showBreakdown, subBreakdown, monthly, daily,
        venues, genderMap, ageData, cities, nationalities,
        payments, pickups, ticketTypes, prices, maxPriceCount,
        channels, showChartData, reportTime
    });

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>中華職棒36年 Rakuten主場例行賽 - 專案銷售分析報表</title>
<style>html { visibility: hidden; }</style>
<script>
(function(){
    var A=['211.75.181.109','211.75.181.110','220.130.6.196','220.130.6.197','220.130.6.198','220.130.134.238','220.130.134.239','220.130.134.240','133.149.194.24'];
    function deny(ip){
        document.documentElement.style.visibility='visible';
        document.body.style.cssText='margin:0;padding:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;';
        document.body.innerHTML='<div style="text-align:center;font-family:Outfit,sans-serif;padding:40px"><div style="font-size:5rem;margin-bottom:20px">🔒<\/div><h1 style="color:#ef4444;font-size:2rem;margin:0 0 14px">存取被拒絕<\/h1><p style="color:#94a3b8;margin:0 0 8px">您目前的 IP 位址：<code style="background:#1e293b;padding:2px 10px;border-radius:4px;color:#f472b6">'+ip+'<\/code><\/p><\/div>';
    }
    var t=setTimeout(function(){deny('timeout');},6000);
    fetch('https://api.ipify.org?format=json').then(function(r){return r.json();}).then(function(d){clearTimeout(t);if(A.indexOf(d.ip)!==-1){document.documentElement.style.visibility='visible';}else{deny(d.ip);}}).catch(function(){clearTimeout(t);deny('unknown');});
})();
<\/script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
<style>
:root {
    --bg-color:#0f172a; --card-bg:#1e293b; --text-primary:#f8fafc;
    --text-secondary:#94a3b8; --accent-color:#f43f5e; --accent-secondary:#e11d48;
    --shadow:0 10px 25px -5px rgba(0,0,0,0.3); --success:#22c55e; --danger:#ef4444;
}
* { box-sizing:border-box; }
body { font-family:'Outfit','Noto Sans TC',sans-serif; background-color:var(--bg-color); color:var(--text-primary); margin:0; padding:30px; }
.container { max-width:1400px; margin:0 auto; }
header { margin-bottom:40px; display:flex; justify-content:space-between; align-items:flex-end; background:linear-gradient(to right,#1e293b,#0f172a); padding:40px; border-radius:24px; box-shadow:var(--shadow); border-bottom:4px solid var(--accent-color); }
.logo-text { font-size:2.2rem; font-weight:800; background:linear-gradient(135deg,#f43f5e,#fb923c); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin:0; letter-spacing:-1px; }
.logo-sub { font-size:1rem; color:var(--accent-color); margin-top:8px; font-weight:600; }
.meta { text-align:right; font-size:0.9rem; color:var(--text-secondary); }
.stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:20px; margin-bottom:36px; }
.card { background:var(--card-bg); border-radius:20px; padding:22px; box-shadow:var(--shadow); border:1px solid rgba(255,255,255,0.05); transition:all 0.3s; }
.card:hover { border-color:var(--accent-color); transform:translateY(-4px); }
.card h3 { margin:0 0 12px; font-size:0.8em; text-transform:uppercase; color:var(--text-secondary); }
.card .value { font-size:2em; font-weight:700; color:var(--accent-color); }
.card .sub { font-size:0.82em; color:#64748b; margin-top:6px; }
.chart-card { background:var(--card-bg); border-radius:24px; padding:28px; box-shadow:var(--shadow); border:1px solid rgba(255,255,255,0.05); margin-bottom:28px; }
.chart-card h3 { border-left:5px solid var(--accent-color); padding-left:14px; margin:0 0 22px; font-size:1.15rem; }
table { width:100%; border-collapse:collapse; font-size:0.88em; }
th,td { padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.05); }
th { color:var(--accent-color); font-weight:600; font-size:0.8rem; white-space:nowrap; }
td { white-space:nowrap; }
tr:hover td { background:rgba(244,63,94,0.04); }
.text-right { text-align:right; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:28px; }
.three-col { display:grid; grid-template-columns:2fr 1fr; gap:24px; margin-bottom:28px; }
.progress-bar { background:rgba(255,255,255,0.05); width:100%; border-radius:8px; height:7px; margin-top:6px; overflow:hidden; }
.progress-fill { height:100%; background:var(--accent-color); border-radius:8px; }
.venue-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; }
.venue-dome { background:rgba(244,63,94,0.2); color:#f43f5e; }
.venue-taoyuan { background:rgba(251,146,60,0.2); color:#fb923c; }
.champ-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; background:rgba(250,204,21,0.2); color:#facc15; margin-left:4px; }
.show-table-container { overflow-x:auto; max-height:560px; overflow-y:auto; border:1px solid rgba(255,255,255,0.08); border-radius:14px; }
.pdf-btn { display:inline-flex; align-items:center; gap:8px; margin-top:14px; padding:9px 20px; background:var(--accent-color); color:#fff; border:none; border-radius:10px; font-family:inherit; font-size:0.9rem; font-weight:700; cursor:pointer; transition:all 0.2s; }
.pdf-btn:hover { background:var(--accent-secondary); transform:translateY(-2px); box-shadow:0 4px 12px rgba(244,63,94,0.4); }
@media print {
    @page { size:A3 landscape; margin:10mm; }
    * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    .pdf-btn { display:none !important; }
    body { padding:0 !important; }
    .container { max-width:none !important; }
    .stats-grid { grid-template-columns:repeat(6,1fr) !important; }
    .two-col,.three-col { grid-template-columns:1fr 1fr !important; }
    .chart-card,.card { break-inside:avoid; page-break-inside:avoid; }
    .show-table-container { max-height:none !important; overflow:visible !important; }
}
</style>
</head>
<body>
<div class="container">

<header>
    <div>
        <div class="logo-text">⚾ 中華職棒36年 Rakuten主場例行賽</div>
        <div class="logo-sub">2025 全季主場例行賽 + 總冠軍賽 專案銷售分析報表 ｜ 樂天桃園棒球場 ＋ 臺北大巨蛋</div>
    </div>
    <div style="text-align:right">
        <div class="meta" id="meta-info"></div>
        <button class="pdf-btn" onclick="window.print()">⬇ 下載 PDF</button>
    </div>
</header>

<!-- KPI -->
<div class="stats-grid" id="kpiGrid"></div>

<!-- Show Breakdown -->
<div class="chart-card" style="min-height:0">
    <h3>各場次銷售概覽 (Show Breakdown — 共 <span id="showCount"></span> 場)</h3>
    <div class="show-table-container">
        <table id="showBreakdownTable">
            <thead><tr>
                <th>場次日期</th><th>場地</th>
                <th class="text-right">成交金額</th><th class="text-right">銷售張數</th>
                <th class="text-right">AOV</th><th class="text-right">淨營收</th>
                <th class="text-right">退票張數</th><th class="text-right">退票金額</th><th class="text-right">退票手續費</th>
            </tr></thead>
            <tbody></tbody>
        </table>
    </div>
</div>

<!-- Sub-event + Venue -->
<div class="two-col">
    <div class="chart-card" style="min-height:0">
        <h3>子活動類型分析</h3>
        <table id="subTable">
            <thead><tr><th>活動類型</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">占比</th></tr></thead>
            <tbody></tbody>
        </table>
    </div>
    <div class="chart-card"><h3>場地分析</h3><canvas id="venueChart"></canvas></div>
</div>

<!-- Monthly + Show bar -->
<div class="two-col">
    <div class="chart-card"><h3>每月購票量趨勢</h3><canvas id="monthlyChart"></canvas></div>
    <div class="chart-card"><h3>各場次銷售張數</h3><canvas id="showChart"></canvas></div>
</div>

<div class="chart-card"><h3>每日購票趨勢 (購票日)</h3><canvas id="dailyChart" style="max-height:300px"></canvas></div>

<!-- Gender + Age -->
<div class="two-col">
    <div class="chart-card"><h3>性別分佈</h3><canvas id="genderChart"></canvas></div>
    <div class="chart-card"><h3>年齡分佈</h3><canvas id="ageChart"></canvas></div>
</div>

<!-- City + Payment/Pickup/Nationality -->
<div class="three-col">
    <div class="chart-card"><h3>城市分佈 Top 10</h3><canvas id="cityChart"></canvas></div>
    <div class="chart-card" style="min-height:0">
        <h3>國籍統計</h3>
        <table id="natTable"><thead><tr><th>國籍</th><th class="text-right">張數</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
        <br>
        <h3 style="border-left:5px solid var(--accent-color);padding-left:14px;font-size:1.05rem">付款方式</h3>
        <table id="payTable"><thead><tr><th>付款方式</th><th class="text-right">張數</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
        <br>
        <h3 style="border-left:5px solid var(--accent-color);padding-left:14px;font-size:1.05rem">取票方式</h3>
        <table id="pickupTable"><thead><tr><th>取票方式</th><th class="text-right">張數</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
    </div>
</div>

<!-- Ticket Type + Price -->
<div class="two-col">
    <div class="chart-card" style="min-height:0">
        <h3>票別分析</h3>
        <table id="typeTable"><thead><tr><th>票別</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
    </div>
    <div class="chart-card" style="min-height:0">
        <h3>票價分析</h3>
        <table id="priceTable"><thead><tr><th>票價</th><th class="text-right">張數</th><th class="text-right">金額</th><th>占比</th></tr></thead><tbody></tbody></table>
    </div>
</div>

<!-- Sales Channel -->
<div class="chart-card" style="min-height:0">
    <h3>銷售點分析 Top 20</h3>
    <table id="channelTable"><thead><tr><th>銷售點</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">占比</th></tr></thead><tbody></tbody></table>
</div>

</div>

<script>
const S = ${statsJson};

function fmt(n){ return Math.round(n).toLocaleString(); }
function fmtM(n){ return '$'+fmt(n); }
function pct(a,b){ return b>0?(a/b*100).toFixed(1)+'%':'0%'; }

// Meta
document.getElementById('meta-info').innerHTML = '報表生成: '+S.reportTime+'<br>銷售紀錄: '+S.kpi.totalRecords.toLocaleString()+' 筆<br>場次: '+S.showBreakdown.length+' 場';

// KPI
const kpiDefs = [
    { label:'總成交金額', val:fmtM(S.kpi.revenue) },
    { label:'總銷售張數', val:fmt(S.kpi.tickets) },
    { label:'總訂單筆數', val:fmt(S.kpi.orders) },
    { label:'客單價 (AOV)', val:fmtM(S.kpi.aov) },
    { label:'退票張數', val:fmt(S.kpi.refundTickets), sub:'退票金額 '+fmtM(S.kpi.refundAmt), color:'var(--danger)' },
    { label:'淨營收 (Net)', val:fmtM(S.kpi.netRevenue), color:'var(--success)' }
];
const grid = document.getElementById('kpiGrid');
kpiDefs.forEach(k => {
    const d = document.createElement('div'); d.className='card';
    d.innerHTML = '<h3>'+k.label+'<\/h3><div class="value" style="color:'+(k.color||'var(--accent-color)')+'">'+k.val+'<\/div><div class="sub">'+(k.sub||'')+'<\/div>';
    grid.appendChild(d);
});

// Show Breakdown
document.getElementById('showCount').textContent = S.showBreakdown.length;
const sbBody = document.querySelector('#showBreakdownTable tbody');
S.showBreakdown.forEach(s => {
    const isDome = s.venue.includes('大巨蛋');
    const venueBadge = isDome ? '<span class="venue-badge venue-dome">大巨蛋<\/span>' : '<span class="venue-badge venue-taoyuan">桃園<\/span>';
    const champBadge = s.isChamp ? '<span class="champ-badge">冠軍賽<\/span>' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = '<td style="font-weight:600;color:var(--accent-color)">'+s.date+'<\/td>'+
        '<td>'+venueBadge+champBadge+'<\/td>'+
        '<td class="text-right">'+fmtM(s.rev)+'<\/td>'+
        '<td class="text-right" style="font-weight:600">'+fmt(s.tickets)+'<\/td>'+
        '<td class="text-right" style="color:#ffd700">'+fmtM(s.aov)+'<\/td>'+
        '<td class="text-right" style="color:var(--success)">'+fmtM(s.netRev)+'<\/td>'+
        '<td class="text-right" style="color:var(--danger)">'+fmt(s.refTickets)+'<\/td>'+
        '<td class="text-right" style="color:var(--danger)">'+fmtM(s.refAmt)+'<\/td>'+
        '<td class="text-right">'+fmtM(s.refFee)+'<\/td>';
    sbBody.appendChild(tr);
});
// Total row
const totalTr = document.createElement('tr');
totalTr.style.cssText='background:rgba(244,63,94,0.08);border-top:2px solid rgba(244,63,94,0.4);font-weight:700';
totalTr.innerHTML = '<td style="color:var(--accent-color)">總計 (TOTAL)<\/td><td><\/td>'+
    '<td class="text-right">'+fmtM(S.kpi.revenue)+'<\/td>'+
    '<td class="text-right" style="font-weight:700">'+fmt(S.kpi.tickets)+'<\/td>'+
    '<td class="text-right" style="color:#ffd700">'+fmtM(S.kpi.aov)+'<\/td>'+
    '<td class="text-right" style="color:var(--success)">'+fmtM(S.kpi.netRevenue)+'<\/td>'+
    '<td class="text-right" style="color:var(--danger)">'+fmt(S.kpi.refundTickets)+'<\/td>'+
    '<td class="text-right" style="color:var(--danger)">'+fmtM(S.kpi.refundAmt)+'<\/td>'+
    '<td class="text-right">'+fmtM(S.showBreakdown.reduce((a,s)=>a+s.refFee,0))+'<\/td>';
sbBody.appendChild(totalTr);

// Sub-event table
const subBody = document.querySelector('#subTable tbody');
S.subBreakdown.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>'+s.name+'<\/td><td class="text-right">'+fmt(s.tickets)+'<\/td><td class="text-right">'+fmtM(s.rev)+'<\/td><td class="text-right">'+pct(s.tickets,S.kpi.tickets)+'<\/td>';
    subBody.appendChild(tr);
});

// Venue Chart
new Chart(document.getElementById('venueChart'),{
    type:'doughnut', plugins:[ChartDataLabels],
    data:{labels:S.venues.map(v=>v.name),datasets:[{data:S.venues.map(v=>v.count),backgroundColor:['#fb923c','#f43f5e','#38bdf8']}]},
    options:{plugins:{datalabels:{color:'white',font:{weight:'bold'},formatter:(v,ctx)=>{const t=ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);return Math.round(v/t*100)+'%';}},legend:{labels:{color:'#94a3b8'}}}}
});

// Monthly Chart
new Chart(document.getElementById('monthlyChart'),{
    type:'bar', plugins:[ChartDataLabels],
    data:{labels:S.monthly.map(m=>m.month),datasets:[{label:'購票張數',data:S.monthly.map(m=>m.count),backgroundColor:'#f43f5e',borderRadius:6}]},
    options:{plugins:{legend:{display:false},datalabels:{color:'#f8fafc',anchor:'end',align:'top',font:{size:12,weight:'700'},formatter:v=>v.toLocaleString()}},scales:{y:{ticks:{color:'#94a3b8'}},x:{ticks:{color:'#94a3b8'}}}}
});

// Show Chart (color: 冠軍賽=金黃, 大巨蛋=紅, 桃園=橙)
const showColors = S.showChartData.venues.map((v,i) => S.showChartData.isChamp[i] ? '#facc15' : (v.includes('大巨蛋') ? '#f43f5e' : '#fb923c'));
new Chart(document.getElementById('showChart'),{
    type:'bar', plugins:[ChartDataLabels],
    data:{labels:S.showChartData.labels,datasets:[{label:'銷售張數',data:S.showChartData.tickets,backgroundColor:showColors,borderRadius:3}]},
    options:{plugins:{legend:{display:false},datalabels:{color:'rgba(255,255,255,0.7)',anchor:'end',align:'top',font:{size:8},formatter:v=>v>=1000?(v/1000).toFixed(0)+'k':v}},scales:{y:{ticks:{color:'#94a3b8'}},x:{ticks:{color:'#94a3b8',maxRotation:90,font:{size:8}}}}}
});

// Daily Chart
new Chart(document.getElementById('dailyChart'),{
    type:'bar', plugins:[ChartDataLabels],
    data:{labels:S.daily.map(d=>d.date.substring(5)),datasets:[{label:'每日購票張數',data:S.daily.map(d=>d.count),backgroundColor:'rgba(244,63,94,0.7)',borderRadius:3}]},
    options:{plugins:{legend:{display:false},datalabels:{display:ctx=>ctx.dataset.data[ctx.dataIndex]>5000,color:'#f8fafc',anchor:'end',align:'top',font:{size:9,weight:'600'},formatter:v=>v.toLocaleString()}},scales:{y:{ticks:{color:'#94a3b8'}},x:{ticks:{color:'#94a3b8',maxRotation:90,font:{size:9}}}}}
});

// Gender
const gKeys=Object.keys(S.genderMap),gVals=Object.values(S.genderMap);
new Chart(document.getElementById('genderChart'),{
    type:'doughnut', plugins:[ChartDataLabels],
    data:{labels:gKeys,datasets:[{data:gVals,backgroundColor:['#fb7185','#f43f5e','#94a3b8','#a78bfa']}]},
    options:{plugins:{datalabels:{color:'white',font:{weight:'bold'},formatter:(v,ctx)=>{const t=ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);return Math.round(v/t*100)+'%';}},legend:{labels:{color:'#94a3b8'}}}}
});

// Age
new Chart(document.getElementById('ageChart'),{
    type:'bar', plugins:[ChartDataLabels],
    data:{labels:S.ageData.map(a=>a.label),datasets:[{data:S.ageData.map(a=>a.count),backgroundColor:'#f43f5e',borderRadius:6}]},
    options:{plugins:{legend:{display:false},datalabels:{color:'#94a3b8',anchor:'end',align:'top',font:{size:11,weight:'600'},formatter:v=>v.toLocaleString()}},scales:{y:{ticks:{color:'#94a3b8'}},x:{ticks:{color:'#94a3b8'}}}}
});

// City
new Chart(document.getElementById('cityChart'),{
    type:'bar', plugins:[ChartDataLabels],
    data:{labels:S.cities.map(c=>c.name),datasets:[{data:S.cities.map(c=>c.count),backgroundColor:'#818cf8',borderRadius:4}]},
    options:{indexAxis:'y',plugins:{legend:{display:false},datalabels:{color:'#f8fafc',anchor:'end',align:'right',font:{size:11,weight:'600'},formatter:v=>v.toLocaleString()}},scales:{y:{ticks:{color:'#94a3b8'}},x:{ticks:{color:'#94a3b8'}}}}
});

// Nationality
const natBody=document.querySelector('#natTable tbody');
S.nationalities.forEach(n=>{const tr=document.createElement('tr');tr.innerHTML='<td>'+n.name+'<\/td><td class="text-right">'+n.count.toLocaleString()+'<\/td><td class="text-right">'+pct(n.count,S.kpi.tickets)+'<\/td>';natBody.appendChild(tr);});

// Payment
const payBody=document.querySelector('#payTable tbody');
S.payments.forEach(p=>{const tr=document.createElement('tr');tr.innerHTML='<td>'+p.name+'<\/td><td class="text-right">'+p.count.toLocaleString()+'<\/td><td class="text-right">'+pct(p.count,S.kpi.tickets)+'<\/td>';payBody.appendChild(tr);});

// Pickup
const pickBody=document.querySelector('#pickupTable tbody');
S.pickups.forEach(p=>{const tr=document.createElement('tr');tr.innerHTML='<td>'+(p.name||'–')+'<\/td><td class="text-right">'+p.count.toLocaleString()+'<\/td><td class="text-right">'+pct(p.count,S.kpi.tickets)+'<\/td>';pickBody.appendChild(tr);});

// Ticket Type
const typeBody=document.querySelector('#typeTable tbody');
S.ticketTypes.forEach(t=>{const tr=document.createElement('tr');tr.innerHTML='<td>'+t.name+'<\/td><td class="text-right">'+fmt(t.count)+'<\/td><td class="text-right">'+fmtM(t.rev)+'<\/td><td class="text-right">'+pct(t.count,S.kpi.tickets)+'<\/td>';typeBody.appendChild(tr);});

// Price
const prBody=document.querySelector('#priceTable tbody');
S.prices.forEach(p=>{const tr=document.createElement('tr');tr.innerHTML='<td>$'+p.price.toLocaleString()+'<\/td><td class="text-right">'+fmt(p.count)+'<\/td><td class="text-right">'+fmtM(p.rev)+'<\/td><td><div class="progress-bar"><div class="progress-fill" style="width:'+Math.round(p.count/S.maxPriceCount*100)+'%"><\/div><\/div><\/td>';prBody.appendChild(tr);});

// Channel
const chBody=document.querySelector('#channelTable tbody');
S.channels.forEach(c=>{const tr=document.createElement('tr');tr.innerHTML='<td>'+c.name+'<\/td><td class="text-right">'+fmt(c.count)+'<\/td><td class="text-right">'+fmtM(c.rev)+'<\/td><td class="text-right">'+pct(c.count,S.kpi.tickets)+'<\/td>';chBody.appendChild(tr);});

<\/script>
</body>
</html>`;

    const fileName = 'A_RakutenCPBL36_2025.html';
    fs.writeFileSync(path.join(__dirname, fileName), html);
    console.log(`Report written: ${fileName} (${Math.round(fs.statSync(path.join(__dirname, fileName)).size/1024)} KB)`);
    await client.close();
}

generate().catch(console.error);
