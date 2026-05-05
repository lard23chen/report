const { MongoClient } = require('mongodb');
const geoip = require('geoip-lite');
const fs = require('fs');

const uri = 'mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);

const COUNTRY_NAMES = {
  TW:'台灣', US:'美國', JP:'日本', HK:'香港', SG:'新加坡',
  KR:'韓國', MO:'澳門', AU:'澳洲', MY:'馬來西亞', TH:'泰國',
  IN:'印度', GB:'英國', DE:'德國', FR:'法國', CA:'加拿大',
  VN:'越南', ID:'印尼', PH:'菲律賓', NL:'荷蘭', SE:'瑞典',
  BG:'保加利亞', BD:'孟加拉', NO:'挪威', CN:'中國', NZ:'紐西蘭',
  INTERNAL:'內部訂單', UNKNOWN:'無法識別'
};

const isPrivateIP = ip => {
  const s = ip.toString().trim();
  return /^10\./.test(s) ||
         /^192\.168\./.test(s) ||
         /^172\.(1[6-9]|2\d|3[01])\./.test(s) ||
         s === '127.0.0.1' || s === '::1';
};
const countryName = c => COUNTRY_NAMES[c] || c;

const toNum = v => {
  if (!v && v !== 0) return 0;
  if (typeof v === 'number') return v;
  if (v.$numberDecimal !== undefined) return parseFloat(v.$numberDecimal);
  if (v.constructor && v.constructor.name === 'Decimal128') return parseFloat(v.toString());
  return parseFloat(v) || 0;
};
const fmt  = n => Math.round(n).toLocaleString('en-US');
const fmtM = n => { const a=Math.abs(n); return a>=100000000?(n/100000000).toFixed(2)+'億':(n/10000).toFixed(1)+'萬'; };

(async () => {
  await client.connect();
  const col = client.db('QwareAi').collection('Qware_A_Ticket_data_Daily');
  const all = await col.find({}, {
    projection: { IP:1, '訂單編號':1, '狀態':1, '售價':1, '手續費':1,
                  '交易時間':1, '節目/商品名稱':1, '付款方式':1, '年齡':1, '性別':1 }
  }).toArray();
  console.log('Records:', all.length);

  // IP → country cache
  const ipCache = {};
  const lookup = ip => {
    if (!ip) return 'UNKNOWN';
    if (ipCache[ip]) return ipCache[ip];
    if (isPrivateIP(ip)) return (ipCache[ip] = 'INTERNAL');
    const geo = geoip.lookup(ip.toString().trim());
    return (ipCache[ip] = geo ? geo.country : 'UNKNOWN');
  };

  // Aggregate
  const byCountry = {};
  const paymentGeo = { TW:{}, Overseas:{} };  // payment method breakdown
  const ageGeo     = { TW:{}, Overseas:{} };

  all.forEach(r => {
    const country = lookup(r.IP);
    const isTW    = country === 'TW';
    const geoKey  = isTW ? 'TW' : (country === 'INTERNAL' ? 'INTERNAL' : country === 'UNKNOWN' ? 'UNKNOWN' : 'Overseas');
    const orderId = r['訂單編號'] ? r['訂單編號'].toString().split('_')[0] : 'X';
    const price   = toNum(r['售價']);
    const fee     = toNum(r['手續費']);
    const isSale  = r['狀態'] === '正常';
    const isRef   = r['狀態'] === '退票';
    const pay     = r['付款方式'] || '其他';
    const age     = parseInt(r['年齡']) || 0;

    if (!byCountry[country]) byCountry[country] = {
      country, orders:new Set(), tickets:0, revenue:0,
      refOrders:new Set(), refTickets:0, refFee:0
    };
    const s = byCountry[country];
    if (isSale) { s.orders.add(orderId); s.tickets++; s.revenue+=price; }
    if (isRef)  { s.refOrders.add(orderId); s.refTickets++; s.refFee+=fee; }

    // Payment breakdown (TW vs Overseas only, exclude UNKNOWN/INTERNAL)
    if (geoKey !== 'UNKNOWN' && geoKey !== 'INTERNAL' && isSale) {
      if (!paymentGeo[geoKey][pay]) paymentGeo[geoKey][pay] = {orders:new Set(), revenue:0};
      paymentGeo[geoKey][pay].orders.add(orderId);
      paymentGeo[geoKey][pay].revenue += price;
    }

    // Age bucket
    if (geoKey !== 'UNKNOWN' && geoKey !== 'INTERNAL' && isSale && age > 0) {
      const bucket = age < 20 ? '<20' : age < 30 ? '20-29' : age < 40 ? '30-39' :
                     age < 50 ? '40-49' : age < 60 ? '50-59' : '60+';
      if (!ageGeo[geoKey][bucket]) ageGeo[geoKey][bucket] = 0;
      ageGeo[geoKey][bucket]++;
    }
  });

  // Flatten & sort
  const rows = Object.values(byCountry).map(s => ({
    country: s.country,
    orders:  s.orders.size,
    tickets: s.tickets,
    revenue: s.revenue,
    refOrders: s.refOrders.size,
    refTickets: s.refTickets,
    refFee: s.refFee
  })).sort((a,b) => b.revenue - a.revenue);

  const tw  = rows.find(r=>r.country==='TW') || {};
  const int_ = rows.find(r=>r.country==='INTERNAL') || {};
  const unk = rows.find(r=>r.country==='UNKNOWN') || {};
  const ovRows = rows.filter(r=>r.country!=='TW'&&r.country!=='UNKNOWN'&&r.country!=='INTERNAL');
  const ov = ovRows.reduce((a,r)=>({
    orders:a.orders+r.orders, tickets:a.tickets+r.tickets, revenue:a.revenue+r.revenue,
    refOrders:a.refOrders+r.refOrders, refTickets:a.refTickets+r.refTickets, refFee:a.refFee+r.refFee
  }), {orders:0,tickets:0,revenue:0,refOrders:0,refTickets:0,refFee:0});

  const totalRev = (tw.revenue||0) + (ov.revenue||0) + (int_.revenue||0) + (unk.revenue||0);
  const twPct  = totalRev ? ((tw.revenue||0)/totalRev*100).toFixed(1) : 0;
  const ovPct  = totalRev ? (ov.revenue/totalRev*100).toFixed(1) : 0;
  const intPct = totalRev ? ((int_.revenue||0)/totalRev*100).toFixed(1) : 0;
  const unkPct = totalRev ? ((unk.revenue||0)/totalRev*100).toFixed(1) : 0;

  // Payment table rows
  const allPayMethods = new Set([...Object.keys(paymentGeo.TW), ...Object.keys(paymentGeo.Overseas)]);
  const payRows = [...allPayMethods].map(pay => ({
    pay,
    twOrders:  paymentGeo.TW[pay]?.orders.size || 0,
    twRev:     paymentGeo.TW[pay]?.revenue || 0,
    ovOrders:  paymentGeo.Overseas[pay]?.orders.size || 0,
    ovRev:     paymentGeo.Overseas[pay]?.revenue || 0,
  })).sort((a,b)=>(b.twRev+b.ovRev)-(a.twRev+a.ovRev));

  // Age buckets chart data
  const ageBuckets = ['<20','20-29','30-39','40-49','50-59','60+'];
  const twAge  = ageBuckets.map(b => ageGeo.TW[b]||0);
  const ovAge  = ageBuckets.map(b => ageGeo.Overseas[b]||0);

  // Grand totals (TW + Overseas, exclude UNKNOWN) for % base
  const grandRev     = (tw.revenue||0) + ovRows.reduce((s,r)=>s+r.revenue,0);
  const grandOrders  = (tw.orders||0)  + ovRows.reduce((s,r)=>s+r.orders,0);
  const grandTickets = (tw.tickets||0) + ovRows.reduce((s,r)=>s+r.tickets,0);
  const pct = (v,t) => t ? (v/t*100).toFixed(1)+'%' : '—';
  const badge = (p,col='#94a3b8') => `<span style="font-size:0.72rem;color:${col};margin-left:5px;">(${p})</span>`;

  // Country table HTML (TW first as reference row, then overseas top 15)
  const twRefRow = `
    <tr style="background:rgba(74,222,128,0.08);">
      <td style="padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.08);">
        <span style="display:inline-block;width:22px;text-align:center;font-weight:700;color:var(--muted);">—</span>
        <span style="font-weight:700;color:#4ade80;">🇹🇼 台灣</span>
        <span style="color:var(--muted);font-size:0.78rem;margin-left:6px;">(TW)</span>
      </td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.08);color:#4ade80;font-weight:600;">${fmt(tw.orders||0)}${badge(pct(tw.orders||0,grandOrders),'#4ade80')}</td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.08);color:#4ade80;font-weight:600;">${fmt(tw.tickets||0)}${badge(pct(tw.tickets||0,grandTickets),'#4ade80')}</td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.08);color:#4ade80;font-weight:700;">NT$${fmt(tw.revenue||0)}${badge(pct(tw.revenue||0,grandRev),'#4ade80')}</td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.08);color:#f87171;">${fmt(tw.refOrders||0)}</td>
    </tr>`;
  const countryRowsHtml = twRefRow + ovRows.slice(0,15).map((r,i) => `
    <tr>
      <td style="padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="display:inline-block;width:22px;text-align:center;font-weight:700;color:var(--muted);">${i+1}</span>
        <span style="font-weight:600;color:var(--text);">${countryName(r.country)}</span>
        <span style="color:var(--muted);font-size:0.78rem;margin-left:6px;">(${r.country})</span>
      </td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);color:var(--text);">${fmt(r.orders)}${badge(pct(r.orders,grandOrders),'#60a5fa')}</td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);color:var(--text);">${fmt(r.tickets)}${badge(pct(r.tickets,grandTickets),'#a78bfa')}</td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);color:#4ade80;font-weight:600;">NT$${fmt(r.revenue)}${badge(pct(r.revenue,grandRev),'#4ade80')}</td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);color:var(--muted);">${fmt(r.refOrders)}</td>
    </tr>`).join('');

  const payRowsHtml = payRows.map(p => `
    <tr>
      <td style="padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);color:var(--text);font-weight:500;">${p.pay}</td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);color:var(--text);">${fmt(p.twOrders)}</td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);color:#4ade80;">NT$${fmt(p.twRev)}</td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);color:var(--text);">${fmt(p.ovOrders)}</td>
      <td style="text-align:right;padding:0.7rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);color:#60a5fa;">NT$${fmt(p.ovRev)}</td>
    </tr>`).join('');

  const now = new Date().toLocaleString('zh-TW');
  const dataMonth = '2026-05';

  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>IP 地理分析報表 (A系統) | ${dataMonth}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
<style>
:root{--bg:#0f172a;--card:#1e293b;--border:#334155;--text:#e2e8f0;--muted:#94a3b8;--accent:#3b82f6;--success:#10b981;--warning:#f59e0b;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;min-height:100vh}
header{background:var(--card);border-bottom:1px solid var(--border);padding:16px 28px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
header h1{font-size:1.15rem;font-weight:700;color:var(--accent)}
main{padding:24px 28px;max-width:1400px;margin:0 auto}
.section-title{font-size:0.82rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin:28px 0 12px;display:flex;align-items:center;gap:8px}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:20px}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px}
.kpi{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 20px}
.kpi-label{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:6px}
.kpi-value{font-size:1.25rem;font-weight:700}
.kpi-sub{font-size:0.78rem;color:var(--muted);margin-top:4px}
.tw{color:#4ade80}.ov{color:#60a5fa}.uk{color:var(--muted)}
.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
@media(max-width:768px){.chart-grid{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:0.8rem 1rem;color:var(--text);border-bottom:2px solid var(--border);font-weight:600;font-size:0.85rem}
th.r{text-align:right}
footer{text-align:center;padding:24px;color:var(--muted);font-size:0.8rem;border-top:1px solid var(--border);margin-top:40px}
</style>
</head>
<body>
<header>
  <div>
    <h1>🌐 IP 地理分析報表 (A系統)</h1>
    <span style="color:var(--muted);font-size:0.82rem;">資料範圍：${dataMonth} &nbsp;|&nbsp; 產生時間：${now}</span>
  </div>
  <a href="report_index.html" style="margin-left:auto;color:var(--muted);font-size:0.82rem;text-decoration:none;">← 返回報表中心</a>
</header>

<main>

<!-- KPIs -->
<div class="section-title">📊 台灣 vs 海外 總覽</div>
<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-label">🇹🇼 台灣 購票金額</div>
    <div class="kpi-value tw">NT$${fmtM(tw.revenue||0)}</div>
    <div class="kpi-sub">占比 ${twPct}%&nbsp;|&nbsp;${fmt(tw.orders||0)} 筆 / ${fmt(tw.tickets||0)} 張</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">🌏 海外 購票金額</div>
    <div class="kpi-value ov">NT$${fmtM(ov.revenue)}</div>
    <div class="kpi-sub">占比 ${ovPct}%&nbsp;|&nbsp;${fmt(ov.orders)} 筆 / ${fmt(ov.tickets)} 張</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">🏢 內部訂單（內網IP）</div>
    <div class="kpi-value" style="color:#f59e0b">NT$${fmtM(int_.revenue||0)}</div>
    <div class="kpi-sub">占比 ${intPct}%&nbsp;|&nbsp;${fmt(int_.orders||0)} 筆 / ${fmt(int_.tickets||0)} 張</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">❓ IP無法識別</div>
    <div class="kpi-value uk">NT$${fmtM(unk.revenue||0)}</div>
    <div class="kpi-sub">占比 ${unkPct}%&nbsp;|&nbsp;${fmt(unk.orders||0)} 筆</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">🌍 海外國家數</div>
    <div class="kpi-value" style="color:var(--warning)">${ovRows.length}</div>
    <div class="kpi-sub">個不同國家/地區</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">🇹🇼 台灣 退票筆數</div>
    <div class="kpi-value" style="color:#f87171">${fmt(tw.refOrders||0)}</div>
    <div class="kpi-sub">退票張數 ${fmt(tw.refTickets||0)}張 / 手續費 NT$${fmt(tw.refFee||0)}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">🌏 海外 退票筆數</div>
    <div class="kpi-value" style="color:#f87171">${fmt(ov.refOrders)}</div>
    <div class="kpi-sub">退票張數 ${fmt(ov.refTickets)}張 / 手續費 NT$${fmt(ov.refFee)}</div>
  </div>
</div>

<!-- Charts -->
<div class="chart-grid">
  <div class="card">
    <div style="font-weight:600;margin-bottom:16px;color:var(--text);">購票金額分布</div>
    <canvas id="revPie" height="220"></canvas>
  </div>
  <div class="card">
    <div style="font-weight:600;margin-bottom:16px;color:var(--text);">訂單數分布</div>
    <canvas id="orderPie" height="220"></canvas>
  </div>
</div>

<div class="chart-grid">
  <div class="card">
    <div style="font-weight:600;margin-bottom:16px;color:var(--text);">海外前 10 國家（購票金額）</div>
    <canvas id="countryBar" height="260"></canvas>
  </div>
  <div class="card">
    <div style="font-weight:600;margin-bottom:16px;color:var(--text);">海外前 10 國家（購票筆數 vs 張數）</div>
    <canvas id="countryCountBar" height="260"></canvas>
  </div>
</div>

<div class="chart-grid">
  <div class="card">
    <div style="font-weight:600;margin-bottom:16px;color:var(--text);">年齡分布：台灣 vs 海外</div>
    <canvas id="ageBar" height="260"></canvas>
  </div>
  <div class="card" style="display:flex;flex-direction:column;justify-content:center;">
    <div style="font-weight:600;margin-bottom:14px;color:var(--text);">海外前 10 國家 綜合數據</div>
    <table style="font-size:0.82rem;">
      <thead><tr>
        <th style="padding:6px 10px;border-bottom:1px solid var(--border);">國家</th>
        <th class="r" style="padding:6px 10px;border-bottom:1px solid var(--border);color:#60a5fa;">筆數</th>
        <th class="r" style="padding:6px 10px;border-bottom:1px solid var(--border);color:#a78bfa;">張數</th>
        <th class="r" style="padding:6px 10px;border-bottom:1px solid var(--border);color:#4ade80;">金額</th>
      </tr></thead>
      <tbody>
        <tr style="background:rgba(74,222,128,0.08);">
          <td style="padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:700;color:#4ade80;">🇹🇼 台灣</td>
          <td style="text-align:right;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#4ade80;font-weight:600;">${fmt(tw.orders||0)}<span style="font-size:0.7rem;opacity:.8;margin-left:3px;">${pct(tw.orders||0,grandOrders)}</span></td>
          <td style="text-align:right;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#4ade80;font-weight:600;">${fmt(tw.tickets||0)}<span style="font-size:0.7rem;opacity:.8;margin-left:3px;">${pct(tw.tickets||0,grandTickets)}</span></td>
          <td style="text-align:right;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#4ade80;font-weight:600;">NT$${fmt(tw.revenue||0)}<span style="font-size:0.7rem;opacity:.8;margin-left:3px;">${pct(tw.revenue||0,grandRev)}</span></td>
        </tr>
        ${ovRows.slice(0,10).map(r=>`
        <tr>
          <td style="padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.04);font-weight:500;">${countryName(r.country)}</td>
          <td style="text-align:right;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.04);color:#60a5fa;">${fmt(r.orders)}<span style="font-size:0.7rem;color:#60a5fa;opacity:.7;margin-left:3px;">${pct(r.orders,grandOrders)}</span></td>
          <td style="text-align:right;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.04);color:#a78bfa;">${fmt(r.tickets)}<span style="font-size:0.7rem;color:#a78bfa;opacity:.7;margin-left:3px;">${pct(r.tickets,grandTickets)}</span></td>
          <td style="text-align:right;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.04);color:#4ade80;">NT$${fmt(r.revenue)}<span style="font-size:0.7rem;color:#4ade80;opacity:.7;margin-left:3px;">${pct(r.revenue,grandRev)}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>

<!-- Country Table -->
<div class="section-title">🌍 海外國家明細（依購票金額排序）</div>
<div class="card" style="padding:0;overflow-x:auto">
  <table>
    <thead><tr>
      <th>國家</th>
      <th class="r">購票筆數</th>
      <th class="r">購票張數</th>
      <th class="r" style="color:#4ade80">購票金額</th>
      <th class="r">退票筆數</th>
    </tr></thead>
    <tbody>${countryRowsHtml}</tbody>
  </table>
</div>

<!-- Payment Table -->
<div class="section-title">💳 付款方式：台灣 vs 海外</div>
<div class="card" style="padding:0;overflow-x:auto">
  <table>
    <thead><tr>
      <th>付款方式</th>
      <th class="r" style="color:#4ade80">🇹🇼 台灣訂單數</th>
      <th class="r" style="color:#4ade80">🇹🇼 台灣金額</th>
      <th class="r" style="color:#60a5fa">🌏 海外訂單數</th>
      <th class="r" style="color:#60a5fa">🌏 海外金額</th>
    </tr></thead>
    <tbody>${payRowsHtml}</tbody>
  </table>
</div>

</main>
<footer>A系統 IP 地理分析 &copy; 2026 Qware Analytics &nbsp;|&nbsp; 資料來源：Qware_A_Ticket_data_Daily (MongoDB)</footer>

<script>
Chart.register(ChartDataLabels);
const COLORS_PIE = ['#4ade80','#60a5fa','#94a3b8'];
const COLORS_BAR = ['#3b82f6','#f59e0b','#10b981','#f87171','#a78bfa','#fb923c','#34d399','#818cf8','#e879f9','#22d3ee'];

// Pie: Revenue
new Chart(document.getElementById('revPie'),{type:'pie',data:{
  labels:['台灣 (${twPct}%)','海外 (${ovPct}%)','內部訂單 (${intPct}%)','未識別 (${unkPct}%)'],
  datasets:[{data:[${Math.round(tw.revenue||0)},${Math.round(ov.revenue)},${Math.round(int_.revenue||0)},${Math.round(unk.revenue||0)}],backgroundColor:['#4ade80','#60a5fa','#f59e0b','#94a3b8'],borderWidth:2,borderColor:'#1e293b'}]
},options:{plugins:{legend:{position:'bottom',labels:{color:'#e2e8f0',padding:12}},datalabels:{color:'#fff',font:{weight:'bold'},formatter:(v,ctx)=>{const t=ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);return t&&v?((v/t)*100).toFixed(1)+'%':'';}},tooltip:{callbacks:{label:c=>' NT$'+Math.round(c.raw).toLocaleString('en-US')}}}}});

// Pie: Orders
new Chart(document.getElementById('orderPie'),{type:'pie',data:{
  labels:['台灣','海外','內部訂單','未識別'],
  datasets:[{data:[${tw.orders||0},${ov.orders},${int_.orders||0},${unk.orders||0}],backgroundColor:['#4ade80','#60a5fa','#f59e0b','#94a3b8'],borderWidth:2,borderColor:'#1e293b'}]
},options:{plugins:{legend:{position:'bottom',labels:{color:'#e2e8f0',padding:12}},datalabels:{color:'#fff',font:{weight:'bold'},formatter:(v,ctx)=>{const t=ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);return t&&v?((v/t)*100).toFixed(1)+'%':'';}},tooltip:{callbacks:{label:c=>' '+c.raw.toLocaleString()+'筆'}}}}});

// Bar: Country Revenue (TW first, then top 10 overseas)
const grandRevTotal    = ${Math.round(grandRev)};
const grandOrderTotal  = ${grandOrders};
const grandTicketTotal = ${grandTickets};
const revLabels  = ['🇹🇼 台灣', ...${JSON.stringify(ovRows.slice(0,10).map(r=>countryName(r.country)))}];
const revData    = [${Math.round(tw.revenue||0)}, ...${JSON.stringify(ovRows.slice(0,10).map(r=>Math.round(r.revenue)))}];
const revColors  = ['#4ade80', ...COLORS_BAR];
new Chart(document.getElementById('countryBar'),{type:'bar',data:{
  labels: revLabels,
  datasets:[{label:'購票金額',data:revData,backgroundColor:revColors,borderRadius:6}]
},options:{indexAxis:'y',plugins:{legend:{display:false},datalabels:{color:'#e2e8f0',anchor:'end',align:'right',font:{size:11},formatter:v=>{const p=(v/grandRevTotal*100).toFixed(1);return 'NT$'+v.toLocaleString('en-US')+' ('+p+'%)'}}},scales:{x:{ticks:{color:'#94a3b8',callback:v=>'$'+v.toLocaleString()},grid:{color:'rgba(255,255,255,0.05)'}},y:{ticks:{color:'#e2e8f0'},grid:{display:false}}}}});

// Bar: Country Orders vs Tickets (TW first, then top 10 overseas)
const cntLabels   = ['🇹🇼 台灣', ...${JSON.stringify(ovRows.slice(0,10).map(r=>countryName(r.country)))}];
const orderData   = [${tw.orders||0}, ...${JSON.stringify(ovRows.slice(0,10).map(r=>r.orders))}];
const ticketData  = [${tw.tickets||0}, ...${JSON.stringify(ovRows.slice(0,10).map(r=>r.tickets))}];
new Chart(document.getElementById('countryCountBar'),{type:'bar',data:{
  labels: cntLabels,
  datasets:[
    {label:'購票筆數',data:orderData,backgroundColor:'#60a5fa',borderRadius:4},
    {label:'購票張數',data:ticketData,backgroundColor:'#a78bfa',borderRadius:4}
  ]
},options:{indexAxis:'y',plugins:{legend:{position:'top',labels:{color:'#e2e8f0',padding:10}},datalabels:{color:'#fff',anchor:'end',align:'right',font:{size:11},formatter:(v,ctx)=>{const tot=ctx.datasetIndex===0?grandOrderTotal:grandTicketTotal;const p=(v/tot*100).toFixed(1);return v+' ('+p+'%)'}}},scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.05)'}},y:{ticks:{color:'#e2e8f0'},grid:{display:false}}}}});

// Bar: Age
new Chart(document.getElementById('ageBar'),{type:'bar',data:{
  labels:${JSON.stringify(ageBuckets)},
  datasets:[
    {label:'🇹🇼 台灣',data:${JSON.stringify(twAge)},backgroundColor:'#4ade80',borderRadius:4},
    {label:'🌏 海外',data:${JSON.stringify(ovAge)},backgroundColor:'#60a5fa',borderRadius:4}
  ]
},options:{plugins:{legend:{position:'top',labels:{color:'#e2e8f0'}},datalabels:{display:false}},scales:{x:{ticks:{color:'#e2e8f0'},grid:{color:'rgba(255,255,255,0.05)'}},y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.05)'}}}}});
</script>
</body>
</html>`;

  fs.writeFileSync('A_IP_Geo_Analysis_Report.html', html, 'utf-8');
  console.log('Report generated: A_IP_Geo_Analysis_Report.html');
  await client.close();
})().catch(console.error);

