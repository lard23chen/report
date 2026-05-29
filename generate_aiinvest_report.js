/**
 * generate_aiinvest_report.js
 * 讀取 aiinvest20260529 (2)~(7).xlsx，產出 AI_Invest_Report.html
 * 執行: node generate_aiinvest_report.js
 */
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

// ── 1. 讀取所有 xlsx ──────────────────────────────────────────────────────────
const DIR = __dirname;
const files = [2,3,4,5,6,7].map(n => path.join(DIR, `aiinvest20260529 (${n}).xlsx`));

let allRows = [];
for (const f of files) {
  const wb = XLSX.readFile(f);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    allRows.push({
      date:      String(r[0]).trim(),
      stock:     String(r[1]).trim(),
      type:      String(r[2]).trim(),
      shares:    parseFloat(r[3]) || 0,
      price:     parseFloat(r[4]) || 0,
      amount:    parseFloat(r[5]) || 0,
      currency:  String(r[6]).trim(),
      fee:       parseFloat(r[7]) || 0,
      otherFee:  parseFloat(r[8]) || 0,
      net:       parseFloat(r[10]) || 0,
    });
  }
}

// 按日期升序
allRows.sort((a,b) => a.date.localeCompare(b.date));

// ── 2. 標的代號 & 簡稱 ────────────────────────────────────────────────────────
function extractCode(name) {
  const m = name.match(/\(([^)]+)\)/);
  return m ? m[1] : name;
}
function shortName(name) {
  const m = name.match(/\(([^)]+)\)\s*(.*)/);
  if (!m) return name;
  const map = { AAPL:'蘋果', AMD:'超微', BNDW:'全球債', EWJ:'日本ETF', TLT:'長債', LLY:'禮來' };
  return `${m[1]} ${map[m[1]] || m[2].trim()}`;
}

// ── 3. 各標的彙總 ─────────────────────────────────────────────────────────────
const stockMap = {};
for (const r of allRows) {
  const code = extractCode(r.stock);
  if (!stockMap[code]) stockMap[code] = { name: shortName(r.stock), buys:[], sells:[] };
  const isBuy = r.type.includes('買');
  if (isBuy) stockMap[code].buys.push(r);
  else stockMap[code].sells.push(r);
}

const COLORS = {
  AAPL:'#a8dadc', AMD:'#e63946', BNDW:'#457b9d', EWJ:'#f4a261', TLT:'#2a9d8f', LLY:'#ab47bc'
};
const BG_COLORS = {
  AAPL:'rgba(168,218,220,0.15)', AMD:'rgba(230,57,70,0.12)', BNDW:'rgba(69,123,157,0.12)',
  EWJ:'rgba(244,162,97,0.15)', TLT:'rgba(42,157,143,0.12)', LLY:'rgba(171,71,188,0.12)'
};

function stockStats(code) {
  const s = stockMap[code];
  const totalBuyAmt   = s.buys.reduce((a,r) => a + r.amount, 0);
  const totalBuyFee   = s.buys.reduce((a,r) => a + r.fee + r.otherFee, 0);
  const totalBuyShares= s.buys.reduce((a,r) => a + r.shares, 0);
  const totalSellAmt  = s.sells.reduce((a,r) => a + r.amount, 0);
  const totalSellFee  = s.sells.reduce((a,r) => a + r.fee + r.otherFee, 0);
  const totalSellShares= s.sells.reduce((a,r) => a + r.shares, 0);
  const netShares     = totalBuyShares - totalSellShares;
  const totalCost     = totalBuyAmt + totalBuyFee;
  const totalReturn   = totalSellAmt - totalSellFee;
  const realizedPnL   = totalReturn - (totalBuyShares > 0 ? totalCost * (totalSellShares/totalBuyShares) : 0);
  const avgCost       = totalBuyShares > 0 ? totalCost / totalBuyShares : 0;
  const txCount       = s.buys.length + s.sells.length;
  return { totalBuyAmt, totalBuyFee, totalBuyShares, totalSellAmt, totalSellFee, totalSellShares,
           netShares, totalCost, totalReturn, realizedPnL, avgCost, txCount };
}

// ── 4. 年度彙總 ───────────────────────────────────────────────────────────────
const yearMap = {};
for (const r of allRows) {
  const y = r.date.split('/')[0];
  if (!yearMap[y]) yearMap[y] = { buy:0, sell:0, fee:0, txBuy:0, txSell:0 };
  if (r.type.includes('買')) { yearMap[y].buy += r.amount; yearMap[y].fee += r.fee+r.otherFee; yearMap[y].txBuy++; }
  else { yearMap[y].sell += r.amount; yearMap[y].fee += r.fee+r.otherFee; yearMap[y].txSell++; }
}

// ── 5. 月度趨勢 ───────────────────────────────────────────────────────────────
const monthMap = {};
for (const r of allRows) {
  const ym = r.date.slice(0,7);
  if (!monthMap[ym]) monthMap[ym] = { buy:0, sell:0 };
  if (r.type.includes('買')) monthMap[ym].buy += r.amount;
  else monthMap[ym].sell += r.amount;
}
const monthLabels = Object.keys(monthMap).sort();
const monthBuy  = monthLabels.map(m => +(monthMap[m].buy.toFixed(2)));
const monthSell = monthLabels.map(m => +(monthMap[m].sell.toFixed(2)));

// ── 6. 各標的買入金額圓餅 ─────────────────────────────────────────────────────
const codes = Object.keys(stockMap);
const pieBuyAmts = codes.map(c => +(stockMap[c].buys.reduce((a,r)=>a+r.amount,0).toFixed(2)));
const pieColors  = codes.map(c => COLORS[c] || '#999');

// ── 7. 格式化 ─────────────────────────────────────────────────────────────────
const fmt  = v => '$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtN = v => v.toLocaleString('en-US',{minimumFractionDigits:4,maximumFractionDigits:5});
const fmtK = v => v>=1000 ? '$'+(v/1000).toFixed(1)+'K' : fmt(v);

// ── 8. 統計彙總 ───────────────────────────────────────────────────────────────
const totalBuyAll  = allRows.filter(r=>r.type.includes('買')).reduce((a,r)=>a+r.amount,0);
const totalSellAll = allRows.filter(r=>!r.type.includes('買')).reduce((a,r)=>a+r.amount,0);
const totalFeeAll  = allRows.reduce((a,r)=>a+r.fee+r.otherFee,0);
const firstDate    = allRows[0].date;
const lastDate     = allRows[allRows.length-1].date;

// ── 9. 建立明細表格 HTML ──────────────────────────────────────────────────────
const detailRows = [...allRows].reverse().map(r => {
  const code = extractCode(r.stock);
  const isBuy = r.type.includes('買');
  const color = COLORS[code] || '#aaa';
  const sign  = isBuy ? '<span style="color:#ef5350">買</span>' : '<span style="color:#4caf50">賣</span>';
  return `<tr>
    <td>${r.date}</td>
    <td><span style="color:${color};font-weight:700">${code}</span></td>
    <td>${sign} ${r.type.replace(/買|賣/g,'')}</td>
    <td class="num">${fmtN(r.shares)}</td>
    <td class="num">$${(+r.price.toFixed(4))}</td>
    <td class="num" style="color:${isBuy?'#ef5350':'#4caf50'}">${isBuy?'-':'+'} $${r.amount.toFixed(2)}</td>
    <td class="num muted">$${(r.fee+r.otherFee).toFixed(2)}</td>
    <td class="num" style="color:${isBuy?'#ef5350':'#4caf50'}">${isBuy?'':'+'}${fmt(Math.abs(r.net))}</td>
  </tr>`;
}).join('\n');

// ── 10. 各標的卡片 ────────────────────────────────────────────────────────────
const stockCards = codes.map(code => {
  const s  = stockMap[code];
  const st = stockStats(code);
  const color = COLORS[code] || '#aaa';
  const bg    = BG_COLORS[code] || 'rgba(255,255,255,0.05)';
  const hasSell = st.totalSellShares > 0;
  const pnlColor = st.realizedPnL >= 0 ? '#4caf50' : '#ef5350';
  const pnlSign  = st.realizedPnL >= 0 ? '▲' : '▼';
  return `
  <div class="stock-card" style="border-left:4px solid ${color};background:${bg}">
    <div class="sc-header">
      <span class="sc-code" style="color:${color}">${code}</span>
      <span class="sc-name">${s.name}</span>
      <span class="sc-tx">${st.txCount} 筆</span>
    </div>
    <div class="sc-grid">
      <div class="sc-item">
        <div class="sc-label">總買入</div>
        <div class="sc-val">${fmt(st.totalBuyAmt)}</div>
        <div class="sc-sub">${fmtN(st.totalBuyShares)} 股 × ${s.buys.length} 筆</div>
      </div>
      <div class="sc-item">
        <div class="sc-label">均攤成本</div>
        <div class="sc-val">$${st.avgCost.toFixed(3)}</div>
        <div class="sc-sub">含手續費</div>
      </div>
      <div class="sc-item">
        <div class="sc-label">已賣出</div>
        <div class="sc-val" style="color:#4caf50">${hasSell ? fmt(st.totalSellAmt) : '—'}</div>
        <div class="sc-sub">${hasSell ? fmtN(st.totalSellShares)+' 股' : '持有中'}</div>
      </div>
      <div class="sc-item">
        <div class="sc-label">已實現損益</div>
        <div class="sc-val" style="color:${pnlColor}">${hasSell ? pnlSign+' '+fmt(Math.abs(st.realizedPnL)) : '—'}</div>
        <div class="sc-sub">${hasSell ? '扣除手續費後' : '尚未出售'}</div>
      </div>
    </div>
    ${st.netShares > 0 ? `<div class="sc-footer">📦 目前持有 <b style="color:${color}">${fmtN(st.netShares)}</b> 股</div>` : `<div class="sc-footer" style="color:#4caf50">✅ 已全數出清</div>`}
  </div>`;
}).join('\n');

// ── 11. 年度表格 ──────────────────────────────────────────────────────────────
const yearRows = Object.keys(yearMap).sort().map(y => {
  const d = yearMap[y];
  const net = d.sell - d.buy;
  const netColor = net >= 0 ? '#4caf50' : '#ef5350';
  return `<tr>
    <td><b>${y}</b></td>
    <td class="num">${d.txBuy}</td>
    <td class="num">${d.txSell}</td>
    <td class="num" style="color:#ef5350">${fmt(d.buy)}</td>
    <td class="num" style="color:#4caf50">${d.sell > 0 ? fmt(d.sell) : '—'}</td>
    <td class="num muted">${fmt(d.fee)}</td>
    <td class="num" style="color:${netColor};font-weight:700">${net >= 0 ? '+' : ''}${fmt(net)}</td>
  </tr>`;
}).join('\n');

const yearLabels  = Object.keys(yearMap).sort();
const yearBuyData = yearLabels.map(y => +yearMap[y].buy.toFixed(2));
const yearSellData= yearLabels.map(y => +yearMap[y].sell.toFixed(2));

// ── 12. 報告產生時間 ──────────────────────────────────────────────────────────
const reportTime = new Date().toLocaleString('zh-TW');

// ── 13. HTML ──────────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI 定期投資分析報告</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
<style>
:root{
  --bg:#0f1117; --surface:#1a1d27; --surface2:#222636; --border:#2c3048;
  --text:#e8eaf6; --muted:#7986cb; --accent:#5c6bc0;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Outfit','Noto Sans TC',sans-serif;padding-bottom:60px}

.header{background:linear-gradient(135deg,#1a237e 0%,#283593 40%,#3949ab 70%,#5c6bc0 100%);padding:32px 24px 28px;position:relative;overflow:hidden}
.header::before{content:'';position:absolute;inset:0;background:rgba(0,0,0,0.3)}
.header-inner{position:relative;max-width:960px;margin:0 auto}
.header h1{font-size:1.8rem;font-weight:800;letter-spacing:1px}
.header p{margin-top:6px;color:rgba(255,255,255,0.7);font-size:0.85rem}

.container{max-width:960px;margin:0 auto;padding:24px 20px}
.section-title{font-size:1.05rem;font-weight:700;color:var(--muted);margin:32px 0 14px;display:flex;align-items:center;gap:8px;letter-spacing:.5px;text-transform:uppercase}

/* Stats cards */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:28px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px}
.stat-card .label{font-size:0.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.stat-card .value{font-size:1.6rem;font-weight:800}
.stat-card .sub{font-size:0.78rem;color:var(--muted);margin-top:4px}

/* Charts */
.chart-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.chart-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px}
.chart-card h3{font-size:0.92rem;font-weight:600;color:var(--muted);margin-bottom:14px}
.chart-card.full{grid-column:1/-1}
.chart-wrap{position:relative}

/* Stock cards */
.stock-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-bottom:28px}
.stock-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px}
.sc-header{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.sc-code{font-size:1.1rem;font-weight:800}
.sc-name{font-size:0.82rem;color:var(--muted)}
.sc-tx{margin-left:auto;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:2px 10px;font-size:0.72rem;color:var(--muted)}
.sc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.sc-label{font-size:0.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.sc-val{font-size:1rem;font-weight:700}
.sc-sub{font-size:0.72rem;color:var(--muted);margin-top:2px}
.sc-footer{font-size:0.82rem;color:var(--muted);padding-top:10px;border-top:1px solid var(--border)}

/* Table */
.table-wrap{overflow-x:auto;margin-bottom:28px}
table{width:100%;border-collapse:collapse;font-size:0.85rem}
thead th{background:var(--surface2);color:var(--muted);text-align:left;padding:10px 12px;font-size:0.72rem;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border);white-space:nowrap}
tbody tr{border-bottom:1px solid var(--border);transition:background .15s}
tbody tr:hover{background:var(--surface2)}
td{padding:9px 12px;vertical-align:middle}
td.num{text-align:right;font-variant-numeric:tabular-nums}
td.muted{color:var(--muted)}
tfoot td{background:var(--surface2);font-weight:700;padding:10px 12px;border-top:2px solid var(--accent)}

/* Misc */
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:0.72rem;font-weight:600}
.footer-bar{text-align:center;color:var(--muted);font-size:0.78rem;padding-top:32px}
.back-btn{position:fixed;bottom:24px;right:24px;background:var(--accent);color:#fff;border:none;border-radius:50px;padding:10px 18px;font-size:0.85rem;font-family:inherit;font-weight:600;cursor:pointer;text-decoration:none;box-shadow:0 4px 16px rgba(92,107,192,0.4)}

@media(max-width:600px){
  .chart-row{grid-template-columns:1fr}
  .stats-grid{grid-template-columns:1fr 1fr}
  .header h1{font-size:1.4rem}
}
</style>
</head>
<body>

<div class="header">
  <div class="header-inner">
    <h1>📊 AI 定期投資分析報告</h1>
    <p>資料期間：${firstDate} ～ ${lastDate} ｜ 產生時間：${reportTime}</p>
  </div>
</div>

<div class="container">

<!-- Summary Stats -->
<div class="section-title">📈 投資總覽</div>
<div class="stats-grid">
  <div class="stat-card">
    <div class="label">總買入金額</div>
    <div class="value" style="color:#ef5350">${fmtK(totalBuyAll)}</div>
    <div class="sub">USD ${fmt(totalBuyAll)}</div>
  </div>
  <div class="stat-card">
    <div class="label">總賣出金額</div>
    <div class="value" style="color:#4caf50">${fmtK(totalSellAll)}</div>
    <div class="sub">USD ${fmt(totalSellAll)}</div>
  </div>
  <div class="stat-card">
    <div class="label">總手續費</div>
    <div class="value" style="color:#FBC02D">${fmt(totalFeeAll)}</div>
    <div class="sub">所有交易合計</div>
  </div>
  <div class="stat-card">
    <div class="label">交易筆數</div>
    <div class="value" style="color:#7986cb">${allRows.length}</div>
    <div class="sub">${allRows.filter(r=>r.type.includes('買')).length} 買 / ${allRows.filter(r=>!r.type.includes('買')).length} 賣</div>
  </div>
  <div class="stat-card">
    <div class="label">投資年數</div>
    <div class="value" style="color:#26c6da">${new Set(allRows.map(r=>r.date.split('/')[0])).size}</div>
    <div class="sub">${firstDate.split('/')[0]} – ${lastDate.split('/')[0]}</div>
  </div>
  <div class="stat-card">
    <div class="label">標的數</div>
    <div class="value" style="color:#ab47bc">${codes.length}</div>
    <div class="sub">${codes.join(' / ')}</div>
  </div>
</div>

<!-- Charts Row 1 -->
<div class="section-title">📊 圖表分析</div>
<div class="chart-row">
  <div class="chart-card">
    <h3>各標的投入比重</h3>
    <div class="chart-wrap" style="height:280px"><canvas id="pieChart"></canvas></div>
  </div>
  <div class="chart-card">
    <h3>各年度買賣金額</h3>
    <div class="chart-wrap" style="height:280px"><canvas id="yearChart"></canvas></div>
  </div>
</div>

<!-- Charts Row 2 -->
<div class="chart-row">
  <div class="chart-card full">
    <h3>每月買入趨勢（USD）</h3>
    <div class="chart-wrap" style="height:260px"><canvas id="monthChart"></canvas></div>
  </div>
</div>

<!-- Stock Cards -->
<div class="section-title">🗂️ 各標的分析</div>
<div class="stock-grid">
  ${stockCards}
</div>

<!-- Year Table -->
<div class="section-title">📅 年度彙總</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th>年份</th><th>買入筆數</th><th>賣出筆數</th>
      <th class="num">買入金額</th><th class="num">賣出金額</th>
      <th class="num">手續費</th><th class="num">淨流出</th>
    </tr></thead>
    <tbody>${yearRows}</tbody>
    <tfoot><tr>
      <td>合計</td>
      <td class="num">${allRows.filter(r=>r.type.includes('買')).length}</td>
      <td class="num">${allRows.filter(r=>!r.type.includes('買')).length}</td>
      <td class="num" style="color:#ef5350">${fmt(totalBuyAll)}</td>
      <td class="num" style="color:#4caf50">${fmt(totalSellAll)}</td>
      <td class="num">${fmt(totalFeeAll)}</td>
      <td class="num" style="color:#ef5350;font-weight:700">${fmt(totalBuyAll - totalSellAll)}</td>
    </tr></tfoot>
  </table>
</div>

<!-- Detail Table -->
<div class="section-title">📋 完整交易明細（${allRows.length} 筆）</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th>成交日期</th><th>標的</th><th>類型</th>
      <th class="num">股數</th><th class="num">均價</th>
      <th class="num">金額</th><th class="num">手續費</th><th class="num">淨收付</th>
    </tr></thead>
    <tbody>${detailRows}</tbody>
  </table>
</div>

<div class="footer-bar">
  資料來源：aiinvest20260529 (2)~(7).xlsx ｜ 產生時間：${reportTime}<br>
  幣別：USD ｜ 匯率均為 1.000（外幣自有帳戶）
</div>

</div>

<a class="back-btn" href="HTML_Report_Catalog.html">← 返回目錄</a>

<script>
// Pie chart
new Chart(document.getElementById('pieChart'), {
  type: 'doughnut',
  data: {
    labels: ${JSON.stringify(codes.map(c=>shortName(stockMap[c].name||c)))},
    datasets: [{
      data: ${JSON.stringify(pieBuyAmts)},
      backgroundColor: ${JSON.stringify(pieColors)},
      borderColor: '#1a1d27', borderWidth: 2,
      hoverOffset: 8
    }]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position:'right', labels:{ color:'#e8eaf6', font:{size:12}, boxWidth:14 } },
      datalabels: {
        color:'#fff', font:{size:10,weight:'bold'},
        formatter:(v,ctx) => {
          const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
          const pct = (v/total*100).toFixed(1);
          return pct > 5 ? pct+'%' : '';
        }
      }
    }
  },
  plugins: [ChartDataLabels]
});

// Year bar chart
new Chart(document.getElementById('yearChart'), {
  type: 'bar',
  data: {
    labels: ${JSON.stringify(yearLabels)},
    datasets: [
      { label:'買入', data: ${JSON.stringify(yearBuyData)}, backgroundColor:'rgba(230,57,70,0.7)', borderColor:'#e63946', borderWidth:1 },
      { label:'賣出', data: ${JSON.stringify(yearSellData)}, backgroundColor:'rgba(76,175,80,0.7)', borderColor:'#4caf50', borderWidth:1 }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend:{ labels:{ color:'#e8eaf6', font:{size:12} } },
      datalabels: { display: false }
    },
    scales: {
      x:{ ticks:{color:'#7986cb'}, grid:{color:'rgba(255,255,255,0.04)'} },
      y:{ ticks:{color:'#7986cb', callback: v=>v>=1000?'$'+(v/1000).toFixed(0)+'K':'$'+v}, grid:{color:'rgba(255,255,255,0.04)'} }
    }
  },
  plugins: [ChartDataLabels]
});

// Monthly line chart
new Chart(document.getElementById('monthChart'), {
  type: 'bar',
  data: {
    labels: ${JSON.stringify(monthLabels)},
    datasets: [
      { label:'每月買入', data: ${JSON.stringify(monthBuy)}, backgroundColor:'rgba(230,57,70,0.6)', borderColor:'#e63946', borderWidth:1 },
      { label:'每月賣出', data: ${JSON.stringify(monthSell)}, backgroundColor:'rgba(76,175,80,0.6)', borderColor:'#4caf50', borderWidth:1 }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend:{ labels:{ color:'#e8eaf6', font:{size:12} } },
      datalabels:{ display:false }
    },
    scales: {
      x:{ ticks:{ color:'#7986cb', maxRotation:60, font:{size:9} }, grid:{ color:'rgba(255,255,255,0.03)' } },
      y:{ ticks:{ color:'#7986cb', callback: v=>v>=1000?'$'+(v/1000).toFixed(0)+'K':'$'+v }, grid:{ color:'rgba(255,255,255,0.04)' } }
    }
  },
  plugins: [ChartDataLabels]
});
</script>
</body>
</html>`;

const outPath = path.join(DIR, 'AI_Invest_Report.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`✅ 報告已產出：${outPath}`);
console.log(`   共 ${allRows.length} 筆交易 | ${codes.length} 支標的 | ${firstDate} ~ ${lastDate}`);
