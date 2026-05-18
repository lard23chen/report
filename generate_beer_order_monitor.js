const fs = require('fs');
const path = require('path');

const tmpData = JSON.parse(fs.readFileSync(path.join(__dirname, 'tmp_beer_data.json'), 'utf8'));
const js513 = JSON.stringify(tmpData.data513);
const js514 = JSON.stringify(tmpData.data514);

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>2026 7-ELEVEN 高雄啤酒音樂節 監控搶票訂單分析</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"><\/script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1a1200; color: #f0d060; font-family: 'Segoe UI', sans-serif; min-height: 100vh; }
  .header { background: linear-gradient(135deg, #2d1a00 0%, #4a2800 50%, #2d1a00 100%); padding: 24px 32px; border-bottom: 2px solid #c68000; }
  .header h1 { font-size: 1.6rem; color: #ffd000; margin-bottom: 6px; }
  .header p { color: #c4a030; font-size: 0.9rem; }
  .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .kpi-card { background: linear-gradient(135deg, #2a1800, #3a2200); border: 1px solid #c68000; border-radius: 10px; padding: 16px; text-align: center; }
  .kpi-card .label { font-size: 0.78rem; color: #c4a030; margin-bottom: 8px; }
  .kpi-card .val513 { font-size: 1.5rem; font-weight: bold; color: #ff9900; }
  .kpi-card .val514 { font-size: 1.5rem; font-weight: bold; color: #4dd0e1; }
  .kpi-card .sub { font-size: 0.72rem; color: #a08020; margin-top: 4px; }
  .kpi-day { font-size: 0.7rem; color: #888; margin-top: 2px; }
  .section { margin-bottom: 28px; }
  .section h2 { font-size: 1.1rem; color: #ffd000; margin-bottom: 14px; border-left: 3px solid #c68000; padding-left: 10px; }
  .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
  @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }
  .chart-box { background: #221500; border: 1px solid #7a5000; border-radius: 10px; padding: 16px; }
  .chart-box h3 { font-size: 0.9rem; color: #e0b040; margin-bottom: 12px; }
  .legend { display: flex; gap: 20px; margin-bottom: 8px; font-size: 0.78rem; }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot-513 { background: #ff9900; }
  .dot-514 { background: #4dd0e1; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th { background: #3a2200; color: #ffd000; padding: 8px 10px; text-align: center; border: 1px solid #6a4000; position: sticky; top: 0; z-index: 1; }
  td { padding: 6px 10px; text-align: right; border: 1px solid #3a2800; color: #e0c080; }
  td:first-child { text-align: center; color: #ffd000; font-weight: bold; }
  tr:nth-child(even) { background: #221500; }
  tr:hover { background: #2a1800; }
  tr.divider td { border-top: 2px solid #c68000; }
  .scroll-box { max-height: 460px; overflow-y: auto; }
  .scroll-box::-webkit-scrollbar { width: 6px; }
  .scroll-box::-webkit-scrollbar-track { background: #1a1000; }
  .scroll-box::-webkit-scrollbar-thumb { background: #c68000; border-radius: 3px; }
  .seg-table { margin-bottom: 28px; }
  .up { color: #4cff90; } .down { color: #ff5555; }
  .tab-nav { display: flex; gap: 8px; margin-bottom: 14px; }
  .tab-btn { padding: 7px 18px; border: 1px solid #c68000; border-radius: 6px 6px 0 0; cursor: pointer; background: #2a1800; color: #c4a030; font-size: 0.85rem; transition: all 0.2s; }
  .tab-btn.active { background: #c68000; color: #1a1000; font-weight: bold; }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
</style>
</head>
<body>
<div class="header">
  <h1>&#x1F37A; 2026 7-ELEVEN 高雄啤酒音樂節 監控搶票訂單分析</h1>
  <p>資料來源：監控搶票訂單數試算表 ・ 分析時段：12:00–12:50 ・ 產製時間：2026-05-14</p>
</div>
<div class="container">

<div class="kpi-grid">
  <div class="kpi-card">
    <div class="label">總 Booking 數</div>
    <div class="val513" id="kpi-booking513">-</div><div class="kpi-day">5/13</div>
    <div class="val514" id="kpi-booking514">-</div><div class="kpi-day">5/14</div>
    <div class="sub" id="kpi-booking-diff"></div>
  </div>
  <div class="kpi-card">
    <div class="label">總訂單張數</div>
    <div class="val513" id="kpi-orders513">-</div><div class="kpi-day">5/13</div>
    <div class="val514" id="kpi-orders514">-</div><div class="kpi-day">5/14</div>
    <div class="sub" id="kpi-orders-diff"></div>
  </div>
  <div class="kpi-card">
    <div class="label">總刷卡張數</div>
    <div class="val513" id="kpi-cards513">-</div><div class="kpi-day">5/13</div>
    <div class="val514" id="kpi-cards514">-</div><div class="kpi-day">5/14</div>
  </div>
  <div class="kpi-card">
    <div class="label">Booking 尖峰分鐘</div>
    <div class="val513" id="kpi-peakb513">-</div><div class="kpi-day">5/13</div>
    <div class="val514" id="kpi-peakb514">-</div><div class="kpi-day">5/14</div>
  </div>
  <div class="kpi-card">
    <div class="label">訂單尖峰分鐘</div>
    <div class="val513" id="kpi-peako513">-</div><div class="kpi-day">5/13</div>
    <div class="val514" id="kpi-peako514">-</div><div class="kpi-day">5/14</div>
  </div>
  <div class="kpi-card">
    <div class="label">國內 QIT 等候室峰值</div>
    <div class="val513" id="kpi-qit513">-</div><div class="kpi-day">5/13</div>
    <div class="val514" id="kpi-qit514">-</div><div class="kpi-day">5/14</div>
  </div>
</div>

<div class="charts-grid">
  <div class="chart-box">
    <h3>每分鐘 Booking 數比較</h3>
    <div class="legend"><div class="legend-item"><div class="legend-dot dot-513"></div>5/13</div><div class="legend-item"><div class="legend-dot dot-514"></div>5/14</div></div>
    <canvas id="chartBooking" height="220"></canvas>
  </div>
  <div class="chart-box">
    <h3>每分鐘訂單張數比較</h3>
    <div class="legend"><div class="legend-item"><div class="legend-dot dot-513"></div>5/13</div><div class="legend-item"><div class="legend-dot dot-514"></div>5/14</div></div>
    <canvas id="chartOrders" height="220"></canvas>
  </div>
  <div class="chart-box">
    <h3>累積訂單張數比較</h3>
    <div class="legend"><div class="legend-item"><div class="legend-dot dot-513"></div>5/13</div><div class="legend-item"><div class="legend-dot dot-514"></div>5/14</div></div>
    <canvas id="chartCumOrders" height="220"></canvas>
  </div>
  <div class="chart-box">
    <h3>國內 IP QIT 等候室人數</h3>
    <div class="legend"><div class="legend-item"><div class="legend-dot dot-513"></div>5/13</div><div class="legend-item"><div class="legend-dot dot-514"></div>5/14</div></div>
    <canvas id="chartQIT" height="220"></canvas>
  </div>
</div>

<div class="section seg-table">
  <h2>每5分鐘區段統計</h2>
  <table>
    <thead><tr>
      <th>區段</th>
      <th>5/13 Booking</th><th>5/13 訂單</th><th>5/13 刷卡</th>
      <th>5/14 Booking</th><th>5/14 訂單</th><th>5/14 刷卡</th>
      <th>訂單增幅</th>
    </tr></thead>
    <tbody id="segTableBody"></tbody>
  </table>
</div>

<div class="section">
  <h2>每分鐘明細表</h2>
  <div class="tab-nav">
    <button class="tab-btn active" onclick="switchTab(this,'t513')">啤酒節 5/13</button>
    <button class="tab-btn" onclick="switchTab(this,'t514')">啤酒節 5/14</button>
  </div>
  <div id="t513" class="tab-content active">
    <div class="scroll-box"><table id="table513"></table></div>
  </div>
  <div id="t514" class="tab-content">
    <div class="scroll-box"><table id="table514"></table></div>
  </div>
</div>

</div>
<script>
var data513 = [
      ${js513}
    ];
var data514 = [
      ${js514}
    ];

function fmt(n) { return Number(n).toLocaleString(); }

var last513 = data513[data513.length-1];
var last514 = data514[data514.length-1];
document.getElementById('kpi-booking513').textContent = fmt(last513.bookingCum);
document.getElementById('kpi-booking514').textContent = fmt(last514.bookingCum);
var bDiff = ((last514.bookingCum - last513.bookingCum) / last513.bookingCum * 100).toFixed(1);
document.getElementById('kpi-booking-diff').textContent = '5/14 較 5/13 ' + (bDiff > 0 ? '+' : '') + bDiff + '%';
document.getElementById('kpi-orders513').textContent = fmt(last513.ordersCum);
document.getElementById('kpi-orders514').textContent = fmt(last514.ordersCum);
var oDiff = ((last514.ordersCum - last513.ordersCum) / last513.ordersCum * 100).toFixed(1);
document.getElementById('kpi-orders-diff').textContent = '5/14 較 5/13 +' + oDiff + '%';
document.getElementById('kpi-cards513').textContent = fmt(last513.cardsCum);
document.getElementById('kpi-cards514').textContent = fmt(last514.cardsCum);

var peakB513 = data513.reduce(function(a,b){ return b.booking > a.booking ? b : a; });
var peakB514 = data514.reduce(function(a,b){ return b.booking > a.booking ? b : a; });
document.getElementById('kpi-peakb513').textContent = peakB513.time + ' (' + fmt(peakB513.booking) + ')';
document.getElementById('kpi-peakb514').textContent = peakB514.time + ' (' + fmt(peakB514.booking) + ')';

var peakO513 = data513.reduce(function(a,b){ return b.orders > a.orders ? b : a; });
var peakO514 = data514.reduce(function(a,b){ return b.orders > a.orders ? b : a; });
document.getElementById('kpi-peako513').textContent = peakO513.time + ' (' + fmt(peakO513.orders) + ')';
document.getElementById('kpi-peako514').textContent = peakO514.time + ' (' + fmt(peakO514.orders) + ')';

var maxQIT513 = Math.max.apply(null, data513.map(function(d){ return d.domQIT; }));
var maxQIT514 = Math.max.apply(null, data514.map(function(d){ return d.domQIT; }));
document.getElementById('kpi-qit513').textContent = fmt(maxQIT513);
document.getElementById('kpi-qit514').textContent = fmt(maxQIT514);

Chart.register(ChartDataLabels);

var labels = data513.map(function(d){ return d.time; });

function makeChart(id, vals513, vals514, lbl513, lbl514) {
  new Chart(document.getElementById(id), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: lbl513, data: vals513, borderColor: '#ff9900', backgroundColor: 'rgba(255,153,0,0.08)', borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.3,
          datalabels: { color: '#ff9900', anchor: 'end', align: 'top', font: { size: 9 }, display: 'auto', formatter: function(v){ return v >= 100 ? v.toLocaleString() : null; } } },
        { label: lbl514, data: vals514, borderColor: '#4dd0e1', backgroundColor: 'rgba(77,208,225,0.08)', borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.3,
          datalabels: { color: '#4dd0e1', anchor: 'start', align: 'bottom', font: { size: 9 }, display: 'auto', formatter: function(v){ return v >= 100 ? v.toLocaleString() : null; } } }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        datalabels: { clamp: true }
      },
      scales: {
        x: { ticks: { color: '#a08030', maxTicksLimit: 12 }, grid: { color: '#2a1800' } },
        y: { ticks: { color: '#a08030' }, grid: { color: '#2a1800' } }
      }
    }
  });
}

makeChart('chartBooking', data513.map(function(d){return d.booking;}), data514.map(function(d){return d.booking;}), '5/13 Booking', '5/14 Booking');
makeChart('chartOrders', data513.map(function(d){return d.orders;}), data514.map(function(d){return d.orders;}), '5/13 訂單', '5/14 訂單');
makeChart('chartCumOrders', data513.map(function(d){return d.ordersCum;}), data514.map(function(d){return d.ordersCum;}), '5/13 累積訂單', '5/14 累積訂單');
makeChart('chartQIT', data513.map(function(d){return d.domQIT;}), data514.map(function(d){return d.domQIT;}), '5/13 國內QIT', '5/14 國內QIT');

var segs = (function() {
  var result = [];
  for (var t = 0; t <= 50; t += 5) {
    var s = '12:' + (t < 10 ? '0' : '') + t;
    var e = '12:' + (Math.min(t + 4, 50) < 10 ? '0' : '') + Math.min(t + 4, 50);
    result.push({ label: s + '–' + e, start: s, end: e });
  }
  return result;
})();
var segBody = document.getElementById('segTableBody');
segs.forEach(function(seg) {
  var rows513 = data513.filter(function(d){ return d.time >= seg.start && d.time <= seg.end; });
  var rows514 = data514.filter(function(d){ return d.time >= seg.start && d.time <= seg.end; });
  var b513 = rows513.reduce(function(s,d){return s+d.booking;}, 0);
  var o513 = rows513.reduce(function(s,d){return s+d.orders;}, 0);
  var c513 = rows513.reduce(function(s,d){return s+d.cards;}, 0);
  var b514 = rows514.reduce(function(s,d){return s+d.booking;}, 0);
  var o514 = rows514.reduce(function(s,d){return s+d.orders;}, 0);
  var c514 = rows514.reduce(function(s,d){return s+d.cards;}, 0);
  var diff = o513 > 0 ? ((o514-o513)/o513*100).toFixed(1) : '-';
  var cl = parseFloat(diff) > 0 ? 'up' : 'down';
  var diffText = diff !== '-' ? (parseFloat(diff) > 0 ? '+' : '') + diff + '%' : '-';
  var tr = document.createElement('tr');
  tr.innerHTML = '<td>' + seg.label + '</td><td>' + fmt(b513) + '</td><td>' + fmt(o513) + '</td><td>' + fmt(c513) + '</td><td>' + fmt(b514) + '</td><td>' + fmt(o514) + '</td><td>' + fmt(c514) + '</td><td class="' + cl + '">' + diffText + '</td>';
  segBody.appendChild(tr);
});

function buildTable(tableId, data) {
  var t = document.getElementById(tableId);
  var hdrs = ['時間','Booking','Booking累加','訂單張數','訂單累加','刷卡張數','刷卡累加','國內QIT等候','國內進入','國內Max','國外QIT等候','國外進入','國外Max'];
  var thead = '<thead><tr>' + hdrs.map(function(h){ return '<th>' + h + '</th>'; }).join('') + '</tr></thead>';
  t.innerHTML = thead;
  var tbody = document.createElement('tbody');
  data.forEach(function(d) {
    var tr = document.createElement('tr');
    if (d.time === '12:30') tr.className = 'divider';
    var vals = [d.time, fmt(d.booking), fmt(d.bookingCum), fmt(d.orders), fmt(d.ordersCum), fmt(d.cards), fmt(d.cardsCum),
      d.domQIT || '-', d.domIn || '-', d.domMax || '-', d.intlQIT || '-', d.intlIn || '-', d.intlMax || '-'];
    tr.innerHTML = vals.map(function(v){ return '<td>' + v + '</td>'; }).join('');
    tbody.appendChild(tr);
  });
  t.appendChild(tbody);
}
buildTable('table513', data513);
buildTable('table514', data514);

function switchTab(btn, id) {
  document.querySelectorAll('.tab-content').forEach(function(el){ el.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'A_BeerFestival_OrderMonitor_2026.html'), html, 'utf8');
console.log('HTML written: A_BeerFestival_OrderMonitor_2026.html');
