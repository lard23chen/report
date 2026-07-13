require('dotenv').config({ path: __dirname + '/.env', quiet: true });
﻿const { MongoClient } = require('mongodb');
const geoip = require('geoip-lite');
const fs = require('fs');

const uri = process.env.MONGODB_URI_QWARE;
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

const toNum = v => {
  if (!v && v !== 0) return 0;
  if (typeof v === 'number') return v;
  if (v.$numberDecimal !== undefined) return parseFloat(v.$numberDecimal);
  if (v.constructor && v.constructor.name === 'Decimal128') return parseFloat(v.toString());
  return parseFloat(v) || 0;
};

const EVENT_ROWS = [
  ['2026-04-26', '2026 YANG YOSEOP SOLO CONCERT ＜Fade In＞ IN TAIPEI', '04-26 11:30~15:59', '1488筆/4144張', '124筆/166張', '92.3%', '7.7%', '146筆', '11筆'],
  ['2026-04-18', '2026 EXID CONCERT EXID：EXtra ID in TAIPEI', '04-18 10:30~14:59', '1642筆/2290張', '125筆/179張', '92.9%', '7.1%', '345筆', '12筆'],
  ['2026-04-15', "Solar '總有一顆屬於你的星球（Your Own Star）' LIVE", '04-15 11:30~12:59', '596筆/952張', '25筆/29張', '96.0%', '4.0%', '85筆', '1筆'],
  ['2026-04-14', 'NEXZ GLOBAL SHOWCASE EVENT ＜Mmchk：Not Typical＞ in TAIPEI', '04-14 11:30~12:59', '703筆/1899張', '74筆/136張', '90.5%', '9.5%', '282筆', '6筆'],
  ['2026-04-10', '2am Concert ［O－NEUL， 2am］ in Taipei', '04-10 11:30~12:59', '503筆/1883張', '54筆/57張', '90.3%', '9.7%', '68筆', '1筆'],
  ['2026-03-31', 'KAO SUPASSARA BIRTHDAY FAN MEETING', '03-31 11:30~12:59', '487筆/1469張', '34筆/39張', '93.5%', '6.5%', '61筆', '1筆'],
  ['2026-03-28', '孫淑媚《MAY好三十》演唱會－台北站(加場)', '03-28 10:30~11:59', '1425筆/3352張', '35筆/63張', '97.6%', '2.4%', '161筆', '3筆'],
  ['2026-03-15', '國泰世華銀行2026韋禮安「 HI WE1 韋，您好 巡迴演唱會」台北場 (加場)', '03-14 10:30~11:59', '2450筆/4556張', '89筆/158張', '96.5%', '3.5%', '630筆', '0筆'],
  ['2026-03-13', '2026台灣運彩中華職棒開季團圓大辦桌', '03-13 11:30~12:59', '1892筆/3160張', '91筆/132張', '95.4%', '4.6%', '110筆', '1筆'],
  ['2026-03-08', '孫淑媚《MAY好三十》演唱會－台北站', '03-08 11:30~12:59', '1485筆/2705張', '89筆/190張', '94.3%', '5.7%', '104筆', '0筆'],
  ['2026-03-03', '崔立于安可場', '03-03 12:30~13:59', '672筆/808張', '95筆/128張', '87.6%', '12.4%', '122筆', '7筆'],
  ['2026-02-13', 'deca joins 2026 world tour', '02-07 13:30~14:29', '983筆/1943張', '17筆/28張', '98.3%', '1.7%', '95筆', '0筆'],
  ['2026-02-11', '7-ELEVEN高雄櫻花季 SAKURA FESTIVA', '02-11 11:30~12:29', '8834筆/15945張', '207筆/338張', '97.7%', '2.3%', '108筆', '0筆'],
  ['2026-02-07', '2026蘇永康演唱會', '02-07 13:30~14:29', '983筆/1943張', '17筆/28張', '98.3%', '1.7%', '95筆', '0筆'],
  ['2026-02-07', '2026 SEVENUS SPRING MINI CONCERT ［Stay With Us］ in TAIPEI', '—', '—', '—', '—', '—', '—', '—'],
  ['2026-01-31', '2026 idntt 1st FANMEETING in TAIPEI ＜FIRST ACTION＞', '01-31 11:30~12:29', '414筆/517張', '42筆/57張', '90.8%', '9.2%', '70筆', '0筆'],
  ['2026-01-07', '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards', '01-07 18:30~19:29', '1168筆/1381張', '73筆/87張', '94.1%', '5.9%', '7筆', '6筆'],
].map(([date, name, range, tw, ov, twPct, ovPct, int_, unk]) => {
  const na  = tw === '—';
  const cs  = 'padding:.6rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05)';
  const csr = 'text-align:right;' + cs;
  return '<tr>'
    + '<td style="' + cs + ';white-space:nowrap;color:var(--muted);font-size:.82rem">' + date + '</td>'
    + '<td style="' + cs + ';font-size:.85rem">' + name + '</td>'
    + '<td style="' + cs + ';white-space:nowrap;font-family:monospace;font-size:.8rem;color:var(--muted)">' + range + '</td>'
    + '<td style="' + csr + ';color:' + (na ? 'var(--muted)' : '#4ade80') + '">' + tw + '</td>'
    + '<td style="' + csr + ';color:' + (na ? 'var(--muted)' : '#60a5fa') + '">' + ov + '</td>'
    + '<td style="' + csr + ';color:' + (na ? 'var(--muted)' : '#4ade80') + '">' + twPct + '</td>'
    + '<td style="' + csr + ';color:' + (na ? 'var(--muted)' : '#60a5fa') + '">' + ovPct + '</td>'
    + '<td style="' + csr + ';color:var(--muted)">' + int_ + '</td>'
    + '<td style="' + csr + ';color:var(--muted)">' + unk + '</td>'
    + '</tr>';
}).join('\n');

(async () => {
  await client.connect();
  const col = client.db('QwareAi').collection('Qware_Ticket_Data');
  const all = await col.find({}, {
    projection: { IP:1, '訂單編號':1, '狀態':1, '售價':1, '手續費':1,
                  '交易時間':1, '付款方式':1, '年齡':1,
                  '節目/商品名稱':1, '會員編號':1, '座位資訊/票區':1 }
  }).toArray();
  console.log('Records:', all.length);

  const ipCache = {};
  const lookup = ip => {
    if (!ip) return 'UNKNOWN';
    if (ipCache[ip]) return ipCache[ip];
    if (isPrivateIP(ip)) return (ipCache[ip] = 'INTERNAL');
    const geo = geoip.lookup(ip.toString().trim());
    return (ipCache[ip] = geo ? geo.country : 'UNKNOWN');
  };

  // Build per-day per-country aggregation for client-side filtering
  const dailyMap = {};
  const unknownMap = {};

  all.forEach(r => {
    const country = lookup(r.IP);
    const isTW    = country === 'TW';
    const geoKey  = isTW ? 'TW' : (country === 'INTERNAL' ? 'INTERNAL' : country === 'UNKNOWN' ? 'UNKNOWN' : 'Overseas');
    const orderId = r['訂單編號'] ? r['訂單編號'].toString().split('_')[0] : 'X';
    const price   = toNum(r['售價']);
    const fee     = toNum(r['手續費']);
    const isSale  = r['狀態'] === '正常';
    const isRef   = r['狀態'] === '退票' || r['狀態'] === '已退票';
    const pay     = r['付款方式'] || '其他';
    const age     = parseInt(r['年齡']) || 0;
    const txStr = r['交易時間'] ? r['交易時間'].toString() : '';
    const date  = txStr.split(' ')[0] || null;
    const tp    = txStr.split(' ')[1] || '';
    const slot  = tp ? parseInt(tp)*2 + (parseInt(tp.split(':')[1]||0)>=30?1:0) : 0;

    if (!date) return;
    if (!dailyMap[date]) dailyMap[date] = {};
    if (!dailyMap[date][country]) dailyMap[date][country] = {
      g: geoKey, orders: new Set(), tickets: 0, revenue: 0,
      refOrders: new Set(), refTickets: 0, refFee: 0, pay: {}, age: {},
      hOrders: Array.from({length:48},()=>new Set()), hTickets: new Array(48).fill(0), hRevenue: new Array(48).fill(0)
    };
    const ds = dailyMap[date][country];
    if (isSale) { ds.orders.add(orderId); ds.tickets++; ds.revenue += price; ds.hOrders[slot].add(orderId); ds.hTickets[slot]++; ds.hRevenue[slot] += price; }
    if (isRef)  { ds.refOrders.add(orderId); ds.refTickets++; ds.refFee += fee; }
    if (country === 'UNKNOWN' && isSale) {
      if (!unknownMap[orderId]) unknownMap[orderId] = {
        id: orderId, name: r['節目/商品名稱']||'-', mem: r['會員編號']||'-',
        ip: r.IP||'-', tickets: 0, seats: new Set(), d: date
      };
      unknownMap[orderId].tickets++;
      const seatVal = r['座位資訊/票區'];
      if (seatVal) unknownMap[orderId].seats.add(seatVal);
    }
    if (geoKey !== 'UNKNOWN' && geoKey !== 'INTERNAL' && isSale) {
      if (!ds.pay[pay]) ds.pay[pay] = { orders: new Set(), revenue: 0 };
      ds.pay[pay].orders.add(orderId);
      ds.pay[pay].revenue += price;
    }
    if (geoKey !== 'UNKNOWN' && geoKey !== 'INTERNAL' && isSale && age > 0) {
      const bucket = age < 20 ? '<20' : age < 30 ? '20-29' : age < 40 ? '30-39' :
                     age < 50 ? '40-49' : age < 60 ? '50-59' : '60+';
      ds.age[bucket] = (ds.age[bucket] || 0) + 1;
    }
  });

  // Serialize dailyMap → compact array for embedding
  const allDates = Object.keys(dailyMap).sort();
  const minDate  = allDates[0] || '';
  const maxDate  = allDates[allDates.length - 1] || '';

  const DAILY_DATA = [];
  for (const [date, countries] of Object.entries(dailyMap)) {
    for (const [country, s] of Object.entries(countries)) {
      const entry = {
        d: date, c: country, g: s.g,
        o: s.orders.size, t: s.tickets, r: Math.round(s.revenue),
        ro: s.refOrders.size, rt: s.refTickets, rf: Math.round(s.refFee),
        hd: s.hOrders.map(x=>x.size), ht: s.hTickets.slice(), hr: s.hRevenue.map(Math.round)
      };
      const payObj = {};
      for (const [m, ps] of Object.entries(s.pay)) {
        payObj[m] = [ps.orders.size, Math.round(ps.revenue)];
      }
      if (Object.keys(payObj).length) entry.p = payObj;
      if (Object.keys(s.age).length) entry.a = { ...s.age };
      DAILY_DATA.push(entry);
    }
  }

  const allUnknown = Object.values(unknownMap).map(u => ({
    id: u.id, name: u.name, mem: u.mem, ip: u.ip,
    t: u.tickets, seat: [...u.seats].join(' / '), d: u.d
  })).sort((a,b) => b.d < a.d ? -1 : b.d > a.d ? 1 : b.t - a.t);
  const UNKNOWN_TOTAL = allUnknown.length;
  const UNKNOWN_ORDERS = allUnknown.slice(0, 1000);
  console.log('Unknown orders:', UNKNOWN_TOTAL, '(embedding top 1000)');

  const nowObj = new Date();
  const now = nowObj.toLocaleString('zh-TW');
  const thisYearStart = `${nowObj.getFullYear()}-01-01`;
  const thisYearEnd   = nowObj.toISOString().split('T')[0];

  const hourOpts = (def) => Array.from({length:48},(_,i)=>{
    const h=Math.floor(i/2),m=(i%2)*30;
    return `<option value="${i}"${i===def?' selected':''}>${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}</option>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>歷史 IP 地理分析報表 (A系統)</title>
    <!-- IP Allowlist: internal network only -->
    <style>html { visibility: hidden; }</style>
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
                    '<div style="font-size:5rem;margin-bottom:20px">🔒</div>' +
                    '<h1 style="color:#ef4444;font-size:2rem;margin:0 0 14px">存取被拒絕</h1>' +
                    '<p style="color:#94a3b8;margin:0 0 8px">您目前的 IP 位址：' +
                    '<code style="background:#1e293b;padding:2px 10px;border-radius:4px;color:#f472b6">' + ip + '</code></p>' +
                    '<p style="color:#64748b;font-size:0.88rem">此頁面僅限內部網路存取 &middot; Access restricted to internal network only</p>' +
                    '</div>';
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
    </script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"><\/script>
<style>
:root{--bg:#0f172a;--card:#1e293b;--border:#334155;--text:#e2e8f0;--muted:#94a3b8;--accent:#3b82f6;--warning:#f59e0b;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;min-height:100vh}
header{background:var(--card);border-bottom:1px solid var(--border);padding:14px 28px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
header h1{font-size:1.1rem;font-weight:700;color:var(--accent);white-space:nowrap}
.filter-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto}
.filter-bar input[type=date]{background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 9px;font-size:0.82rem;outline:none}
.filter-bar input[type=date]:focus{border-color:var(--accent)}
.filter-bar select{background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 8px;font-size:0.82rem;outline:none;cursor:pointer}
.btn{padding:5px 12px;border-radius:6px;border:none;cursor:pointer;font-size:0.82rem;font-weight:600;transition:opacity .15s}
.btn-primary{background:var(--accent);color:#fff}
.btn-ghost{background:rgba(255,255,255,0.07);color:var(--muted)}
.btn:hover{opacity:.85}
main{padding:22px 28px;max-width:1400px;margin:0 auto}
.section-title{font-size:0.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:26px 0 11px;display:flex;align-items:center;gap:8px}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:20px}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:13px;margin-bottom:22px}
.kpi{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:15px 18px}
.kpi-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:5px}
.kpi-value{font-size:1.2rem;font-weight:700}
.kpi-sub{font-size:0.76rem;color:var(--muted);margin-top:3px;line-height:1.4}
.tw{color:#4ade80}.ov{color:#60a5fa}.int{color:#f59e0b}.uk{color:var(--muted)}
.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}
@media(max-width:780px){.chart-grid{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:.75rem 1rem;color:var(--text);border-bottom:2px solid var(--border);font-weight:600;font-size:.83rem}
th.r{text-align:right}
footer{text-align:center;padding:22px;color:var(--muted);font-size:.78rem;border-top:1px solid var(--border);margin-top:36px}
#range-info{font-size:.8rem;color:var(--muted)}
</style>
</head>
<body>
<header>
  <div>
    <h1>🌐 歷史 IP 地理分析報表 (A系統)</h1>
    <div style="font-size:.8rem;color:#60a5fa;font-weight:600;">資料範圍：${minDate} ~ ${maxDate}</div>
    <div id="range-info" style="font-size:.78rem;color:var(--muted)">產生時間：${now}</div>
  </div>
  <div class="filter-bar">
    <span style="color:var(--muted);font-size:.82rem;">查詢區間</span>
    <input type="date" id="startDate" value="${minDate}" min="${minDate}" max="${maxDate}">
    <select id="startHour">${hourOpts(0)}</select>
    <span style="color:var(--muted)">~</span>
    <input type="date" id="endDate" value="${maxDate}" min="${minDate}" max="${maxDate}">
    <select id="endHour">${hourOpts(47)}</select>
    <button class="btn btn-primary" onclick="applyFilter()">查詢</button>
    <button class="btn btn-ghost" onclick="setThisYear()">今年</button>
    <button class="btn btn-ghost" onclick="setPreset(30)">近30天</button>
    <button class="btn btn-ghost" onclick="setPreset(90)">近90天</button>
    <button class="btn btn-ghost" onclick="resetFilter()">全部</button>
  </div>
  <a href="report_index.html" style="color:var(--muted);font-size:.8rem;text-decoration:none;white-space:nowrap;">← 返回</a>
</header>

<main>
<div class="section-title">📊 台灣 vs 海外 總覽</div>
<div class="kpi-grid" id="kpi-grid"></div>

<div class="chart-grid">
  <div class="card"><div style="font-weight:600;margin-bottom:14px">海外前 10 國家（購票金額）</div><canvas id="countryBar" height="260"></canvas></div>
  <div class="card"><div style="font-weight:600;margin-bottom:14px">海外前 10 國家（購票筆數 vs 張數）</div><canvas id="countryCountBar" height="260"></canvas></div>
</div>
<div class="chart-grid">
  <div class="card"><div style="font-weight:600;margin-bottom:14px">年齡分布：台灣 vs 海外</div><canvas id="ageBar" height="260"></canvas></div>
  <div class="card" style="display:flex;flex-direction:column;justify-content:center;">
    <div style="font-weight:600;margin-bottom:12px">海外前 10 國家 綜合數據</div>
    <table style="font-size:.8rem;" id="mini-table">
      <thead><tr>
        <th style="padding:5px 8px;border-bottom:1px solid var(--border)">國家</th>
        <th class="r" style="padding:5px 8px;border-bottom:1px solid var(--border);color:#60a5fa">筆數</th>
        <th class="r" style="padding:5px 8px;border-bottom:1px solid var(--border);color:#a78bfa">張數</th>
        <th class="r" style="padding:5px 8px;border-bottom:1px solid var(--border);color:#4ade80">金額</th>
      </tr></thead>
      <tbody id="mini-tbody"></tbody>
    </table>
  </div>
</div>

<div class="section-title">🌍 海外國家明細（依購票金額排序）</div>
<div class="card" style="padding:0;overflow-x:auto">
  <table>
    <thead><tr>
      <th>國家</th><th class="r">購票筆數</th><th class="r">購票張數</th>
      <th class="r" style="color:#4ade80">購票金額</th><th class="r">退票筆數</th>
    </tr></thead>
    <tbody id="country-tbody"></tbody>
  </table>
</div>

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
    <tbody id="pay-tbody"></tbody>
  </table>
</div>

<div class="section-title">📊 購票分布圓餅圖</div>
<div class="chart-grid">
  <div class="card"><div style="font-weight:600;margin-bottom:14px">購票金額分布</div><canvas id="revPie" height="220"></canvas></div>
  <div class="card"><div style="font-weight:600;margin-bottom:14px">訂單數分布</div><canvas id="orderPie" height="220"></canvas></div>
</div>

<div class="section-title">❓ IP 無法識別訂單列表</div>
<div class="card" style="padding:0;overflow-x:auto">
  <div style="padding:10px 20px;font-size:.82rem;color:var(--muted)" id="unk-count"></div>
  <table>
    <thead><tr>
      <th>訂單編號</th><th>節目名稱</th><th>會員編號</th><th>IP</th>
      <th class="r">張數</th><th>座位資訊</th>
    </tr></thead>
    <tbody id="unk-tbody"></tbody>
  </table>
</div>

<div class="section-title">📅 重點活動搶票地理分析</div>
<div class="card" style="padding:0;overflow-x:auto">
  <div style="padding:10px 20px 6px;font-size:.8rem;color:var(--muted)">依各活動搶票時間區間統計｜台灣/海外占比排除內部訂單及未識別 IP</div>
  <table>
    <thead><tr>
      <th style="white-space:nowrap">日期</th>
      <th>節目名稱</th>
      <th style="white-space:nowrap">搶票時間</th>
      <th class="r" style="color:#4ade80;white-space:nowrap">🇹🇼 台灣筆數/張數</th>
      <th class="r" style="color:#60a5fa;white-space:nowrap">🌏 海外筆數/張數</th>
      <th class="r" style="color:#4ade80">台灣占比</th>
      <th class="r" style="color:#60a5fa">海外占比</th>
      <th class="r" style="white-space:nowrap">內部訂單</th>
      <th class="r" style="white-space:nowrap">IP未識別</th>
    </tr></thead>
    <tbody>${EVENT_ROWS}</tbody>
  </table>
</div>
</main>
<footer>A系統 歷史 IP 地理分析 &copy; 2026 Qware Analytics &nbsp;|&nbsp; 資料來源：Qware_Ticket_Data (MongoDB)</footer>

<script>
Chart.register(ChartDataLabels);

const DAILY = ${JSON.stringify(DAILY_DATA)};
const UNK_ORDERS = ${JSON.stringify(UNKNOWN_ORDERS)};
const MIN_DATE = '${minDate}';
const MAX_DATE = '${maxDate}';
const THIS_YEAR_START = '${thisYearStart}';
const THIS_YEAR_END   = '${thisYearEnd}';
const CN = ${JSON.stringify(COUNTRY_NAMES)};
const AGE_B = ['<20','20-29','30-39','40-49','50-59','60+'];
const COLORS4 = ['#4ade80','#60a5fa','#f59e0b','#94a3b8'];
const COLORS_BAR = ['#3b82f6','#f59e0b','#10b981','#f87171','#a78bfa','#fb923c','#34d399','#818cf8','#e879f9','#22d3ee'];

const fmt   = n => Math.round(n).toLocaleString('en-US');
const fmtM  = n => { const a=Math.abs(n); return a>=1e8?(n/1e8).toFixed(2)+'億':(n/1e4).toFixed(1)+'萬'; };
const pct   = (v,t) => t ? (v/t*100).toFixed(1)+'%' : '—';
const cname = c => CN[c] || c;
const badge = (p,col='#94a3b8') => \`<span style="font-size:.7rem;color:\${col};margin-left:4px;">(\${p})</span>\`;
const tdR   = (v,col='') => \`<td style="text-align:right;padding:.65rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);\${col?'color:'+col:''}">\${v}</td>\`;
const td0   = (v,col='') => \`<td style="padding:.65rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);\${col?'color:'+col:''}">\${v}</td>\`;

// Chart instances
const CHARTS = {};

function initCharts() {
  const pieOpts = (labFn, ttFn) => ({
    plugins:{
      legend:{position:'bottom',labels:{color:'#e2e8f0',padding:11,font:{size:11}}},
      datalabels:{color:'#fff',font:{weight:'bold',size:11},formatter:(v,ctx)=>{
        const t=ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
        return t&&v?((v/t)*100).toFixed(1)+'%':'';
      }},
      tooltip:{callbacks:{label:c=>ttFn(c)}}
    }
  });

  CHARTS.revPie = new Chart(document.getElementById('revPie'),{
    type:'pie',
    data:{labels:[],datasets:[{data:[],backgroundColor:COLORS4,borderWidth:2,borderColor:'#1e293b'}]},
    options: pieOpts(null, c=>' NT$'+Math.round(c.raw).toLocaleString('en-US'))
  });
  CHARTS.orderPie = new Chart(document.getElementById('orderPie'),{
    type:'pie',
    data:{labels:[],datasets:[{data:[],backgroundColor:COLORS4,borderWidth:2,borderColor:'#1e293b'}]},
    options: pieOpts(null, c=>' '+c.raw.toLocaleString()+'筆')
  });

  const barOpts = (isRev, grandRef) => ({
    indexAxis:'y',
    plugins:{
      legend:{display:false},
      datalabels:{color:'#e2e8f0',anchor:'end',align:'right',font:{size:10},
        formatter:(v,ctx)=>{
          const tot = window._grand ? (isRev ? window._grand.rev : window._grand.orders) : 1;
          return isRev ? 'NT$'+v.toLocaleString('en-US')+' ('+(v/tot*100).toFixed(1)+'%)' : v+' ('+(v/tot*100).toFixed(1)+'%)';
        }}
    },
    scales:{
      x:{ticks:{color:'#94a3b8',callback:v=>isRev?'$'+v.toLocaleString():v},grid:{color:'rgba(255,255,255,0.05)'}},
      y:{ticks:{color:'#e2e8f0'},grid:{display:false}}
    }
  });

  CHARTS.countryBar = new Chart(document.getElementById('countryBar'),{
    type:'bar',
    data:{labels:[],datasets:[{label:'購票金額',data:[],backgroundColor:[],borderRadius:6}]},
    options: barOpts(true)
  });

  CHARTS.countryCountBar = new Chart(document.getElementById('countryCountBar'),{
    type:'bar',
    data:{labels:[],datasets:[
      {label:'購票筆數',data:[],backgroundColor:'#60a5fa',borderRadius:4},
      {label:'購票張數',data:[],backgroundColor:'#a78bfa',borderRadius:4}
    ]},
    options:{
      indexAxis:'y',
      plugins:{
        legend:{position:'top',labels:{color:'#e2e8f0',padding:10}},
        datalabels:{color:'#fff',anchor:'end',align:'right',font:{size:10},
          formatter:(v,ctx)=>{
            const tot = window._grand ? (ctx.datasetIndex===0?window._grand.orders:window._grand.tickets) : 1;
            return v+' ('+(v/tot*100).toFixed(1)+'%)';
          }}
      },
      scales:{
        x:{ticks:{color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.05)'}},
        y:{ticks:{color:'#e2e8f0'},grid:{display:false}}
      }
    }
  });

  CHARTS.ageBar = new Chart(document.getElementById('ageBar'),{
    type:'bar',
    data:{labels:AGE_B,datasets:[
      {label:'🇹🇼 台灣',data:[],backgroundColor:'#4ade80',borderRadius:4},
      {label:'🌏 海外',data:[],backgroundColor:'#60a5fa',borderRadius:4}
    ]},
    options:{
      plugins:{legend:{position:'top',labels:{color:'#e2e8f0'}},datalabels:{display:false}},
      scales:{
        x:{ticks:{color:'#e2e8f0'},grid:{color:'rgba(255,255,255,0.05)'}},
        y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.05)'}}
      }
    }
  });
}

function aggregate(start, end, sh, eh) {
  if(sh===undefined)sh=0; if(eh===undefined)eh=47;
  const data = (start && end) ? DAILY.filter(e => e.d >= start && e.d <= end) : DAILY;
  const useHour = sh!==0 || eh!==47;

  const byC = {}, payG = {TW:{},Overseas:{}}, ageG = {TW:{},Overseas:{}};

  data.forEach(e => {
    let o=e.o, t=e.t, r=e.r;
    if(useHour && e.hd){o=0;t=0;r=0;for(let h=sh;h<=eh;h++){o+=e.hd[h]||0;t+=e.ht[h]||0;r+=e.hr[h]||0;}}
    if (!byC[e.c]) byC[e.c] = {country:e.c,g:e.g,o:0,t:0,r:0,ro:0,rt:0,rf:0};
    const s = byC[e.c];
    s.o+=o; s.t+=t; s.r+=r; s.ro+=e.ro; s.rt+=e.rt; s.rf+=e.rf;
    if (e.p && (e.g==='TW'||e.g==='Overseas')) {
      for (const [m,[mo,mr]] of Object.entries(e.p)) {
        if (!payG[e.g][m]) payG[e.g][m]={o:0,r:0};
        payG[e.g][m].o+=mo; payG[e.g][m].r+=mr;
      }
    }
    if (e.a && (e.g==='TW'||e.g==='Overseas')) {
      for (const [b,cnt] of Object.entries(e.a)) {
        ageG[e.g][b]=(ageG[e.g][b]||0)+cnt;
      }
    }
  });

  const rows = Object.values(byC).sort((a,b)=>b.r-a.r);
  const tw   = rows.find(r=>r.country==='TW')       || {o:0,t:0,r:0,ro:0,rt:0,rf:0};
  const int_ = rows.find(r=>r.country==='INTERNAL') || {o:0,t:0,r:0,ro:0,rt:0,rf:0};
  const unk  = rows.find(r=>r.country==='UNKNOWN')  || {o:0,t:0,r:0,ro:0,rt:0,rf:0};
  const ovR  = rows.filter(r=>r.country!=='TW'&&r.country!=='UNKNOWN'&&r.country!=='INTERNAL');
  const ov   = ovR.reduce((a,r)=>({o:a.o+r.o,t:a.t+r.t,r:a.r+r.r,ro:a.ro+r.ro,rt:a.rt+r.rt,rf:a.rf+r.rf}),{o:0,t:0,r:0,ro:0,rt:0,rf:0});

  const totalRev   = (tw.r||0)+(ov.r||0)+(int_.r||0)+(unk.r||0);
  const grandRev   = (tw.r||0)+(ov.r||0);
  const grandOrders= (tw.o||0)+(ov.o||0);
  const grandTickets=(tw.t||0)+(ov.t||0);

  return {tw,int_,unk,ov,ovR,payG,ageG,totalRev,grandRev,grandOrders,grandTickets};
}

function render(start, end, sh, eh) {
  if(sh===undefined)sh=0; if(eh===undefined)eh=47;
  const {tw,int_,unk,ov,ovR,payG,ageG,totalRev,grandRev,grandOrders,grandTickets} = aggregate(start,end,sh,eh);
  window._grand = {rev:grandRev, orders:grandOrders, tickets:grandTickets};

  const tRev = totalRev || 1;
  const twPct  = ((tw.r||0)/tRev*100).toFixed(1);
  const ovPct  = (ov.r/tRev*100).toFixed(1);
  const intPct = ((int_.r||0)/tRev*100).toFixed(1);
  const unkPct = ((unk.r||0)/tRev*100).toFixed(1);

  // ── KPI cards ──────────────────────────────────────────
  document.getElementById('kpi-grid').innerHTML = \`
    <div class="kpi">
      <div class="kpi-label">🇹🇼 台灣 購票金額</div>
      <div class="kpi-value tw">NT\$\${fmtM(tw.r||0)}</div>
      <div class="kpi-sub">占比 \${twPct}%&nbsp;|&nbsp;\${fmt(tw.o||0)} 筆 / \${fmt(tw.t||0)} 張</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">🌏 海外 購票金額</div>
      <div class="kpi-value ov">NT\$\${fmtM(ov.r)}</div>
      <div class="kpi-sub">占比 \${ovPct}%&nbsp;|&nbsp;\${fmt(ov.o)} 筆 / \${fmt(ov.t)} 張</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">🏢 內部訂單（內網IP）</div>
      <div class="kpi-value int">NT\$\${fmtM(int_.r||0)}</div>
      <div class="kpi-sub">占比 \${intPct}%&nbsp;|&nbsp;\${fmt(int_.o||0)} 筆 / \${fmt(int_.t||0)} 張</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">❓ IP 無法識別</div>
      <div class="kpi-value uk">NT\$\${fmtM(unk.r||0)}</div>
      <div class="kpi-sub">占比 \${unkPct}%&nbsp;|&nbsp;\${fmt(unk.o||0)} 筆</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">🌍 海外國家數</div>
      <div class="kpi-value" style="color:var(--warning)">\${ovR.length}</div>
      <div class="kpi-sub">個不同國家/地區</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">🇹🇼 台灣 退票筆數</div>
      <div class="kpi-value" style="color:#f87171">\${fmt(tw.ro||0)}</div>
      <div class="kpi-sub">退票張數 \${fmt(tw.rt||0)}張 / 手續費 NT\$\${fmt(tw.rf||0)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">🌏 海外 退票筆數</div>
      <div class="kpi-value" style="color:#f87171">\${fmt(ov.ro)}</div>
      <div class="kpi-sub">退票張數 \${fmt(ov.rt)}張 / 手續費 NT\$\${fmt(ov.rf)}</div>
    </div>\`;

  // ── Pie charts ─────────────────────────────────────────
  CHARTS.revPie.data.labels = [\`台灣 (\${twPct}%)\`,\`海外 (\${ovPct}%)\`,\`內部訂單 (\${intPct}%)\`,\`未識別 (\${unkPct}%)\`];
  CHARTS.revPie.data.datasets[0].data = [tw.r||0, ov.r, int_.r||0, unk.r||0];
  CHARTS.revPie.update();

  CHARTS.orderPie.data.labels = ['台灣','海外','內部訂單','未識別'];
  CHARTS.orderPie.data.datasets[0].data = [tw.o||0, ov.o, int_.o||0, unk.o||0];
  CHARTS.orderPie.update();

  // ── Bar: country revenue ────────────────────────────────
  const top10 = ovR.slice(0,10);
  const cLabels = ['🇹🇼 台灣', ...top10.map(r=>cname(r.country))];
  CHARTS.countryBar.data.labels = cLabels;
  CHARTS.countryBar.data.datasets[0].data = [tw.r||0, ...top10.map(r=>r.r)];
  CHARTS.countryBar.data.datasets[0].backgroundColor = ['#4ade80',...COLORS_BAR];
  CHARTS.countryBar.update();

  // ── Bar: country orders/tickets ─────────────────────────
  CHARTS.countryCountBar.data.labels = cLabels;
  CHARTS.countryCountBar.data.datasets[0].data = [tw.o||0, ...top10.map(r=>r.o)];
  CHARTS.countryCountBar.data.datasets[1].data = [tw.t||0, ...top10.map(r=>r.t)];
  CHARTS.countryCountBar.update();

  // ── Bar: age ───────────────────────────────────────────
  CHARTS.ageBar.data.datasets[0].data = AGE_B.map(b=>ageG.TW[b]||0);
  CHARTS.ageBar.data.datasets[1].data = AGE_B.map(b=>ageG.Overseas[b]||0);
  CHARTS.ageBar.update();

  // ── Mini table (top10 综合) ────────────────────────────
  const gr = grandRev||1, go = grandOrders||1, gt = grandTickets||1;
  document.getElementById('mini-tbody').innerHTML =
    \`<tr style="background:rgba(74,222,128,0.08)">
      <td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:700;color:#4ade80">🇹🇼 台灣</td>
      <td style="text-align:right;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.06);color:#4ade80">\${fmt(tw.o||0)}<span style="font-size:.68rem;opacity:.8;margin-left:2px">\${pct(tw.o||0,go)}</span></td>
      <td style="text-align:right;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.06);color:#4ade80">\${fmt(tw.t||0)}<span style="font-size:.68rem;opacity:.8;margin-left:2px">\${pct(tw.t||0,gt)}</span></td>
      <td style="text-align:right;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.06);color:#4ade80">NT\$\${fmt(tw.r||0)}<span style="font-size:.68rem;opacity:.8;margin-left:2px">\${pct(tw.r||0,gr)}</span></td>
    </tr>\` +
    top10.map(r=>\`<tr>
      <td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.04)">\${cname(r.country)}</td>
      <td style="text-align:right;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.04);color:#60a5fa">\${fmt(r.o)}<span style="font-size:.68rem;opacity:.7;margin-left:2px">\${pct(r.o,go)}</span></td>
      <td style="text-align:right;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.04);color:#a78bfa">\${fmt(r.t)}<span style="font-size:.68rem;opacity:.7;margin-left:2px">\${pct(r.t,gt)}</span></td>
      <td style="text-align:right;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.04);color:#4ade80">NT\$\${fmt(r.r)}<span style="font-size:.68rem;opacity:.7;margin-left:2px">\${pct(r.r,gr)}</span></td>
    </tr>\`).join('');

  // ── Country detail table ───────────────────────────────
  const tdFirst = (rank, name, code, highlight) => {
    const color = highlight ? '#4ade80' : 'var(--text)';
    const border = 'border-bottom:1px solid rgba(255,255,255,0.05)';
    return \`<td style="padding:.65rem 1rem;\${border}"><span style="display:inline-block;width:22px;text-align:center;font-weight:700;color:var(--muted)">\${rank}</span> <span style="font-weight:\${highlight?700:600};color:\${color}">\${name}</span> <span style="color:var(--muted);font-size:.76rem">(\${code})</span></td>\`;
  };
  const twRow = \`<tr style="background:rgba(74,222,128,0.08)">
    \${tdFirst('—','🇹🇼 台灣','TW',true)}
    \${tdR(fmt(tw.o||0)+badge(pct(tw.o||0,go),'#4ade80'),'#4ade80')}
    \${tdR(fmt(tw.t||0)+badge(pct(tw.t||0,gt),'#4ade80'),'#4ade80')}
    \${tdR('NT\$'+fmt(tw.r||0)+badge(pct(tw.r||0,gr),'#4ade80'),'#4ade80')}
    \${tdR(fmt(tw.ro||0),'#f87171')}
  </tr>\`;
  const ovDetailRows = ovR.slice(0,15).map((r,i)=>\`<tr>
    \${tdFirst(i+1, cname(r.country), r.country, false)}
    \${tdR(fmt(r.o)+badge(pct(r.o,go),'#60a5fa'))}
    \${tdR(fmt(r.t)+badge(pct(r.t,gt),'#a78bfa'))}
    \${tdR('NT\$'+fmt(r.r)+badge(pct(r.r,gr),'#4ade80'),'#4ade80')}
    \${tdR(fmt(r.ro),'#94a3b8')}
  </tr>\`).join('');
  document.getElementById('country-tbody').innerHTML = twRow + ovDetailRows;

  // ── Payment table ──────────────────────────────────────
  const allPays = new Set([...Object.keys(payG.TW),...Object.keys(payG.Overseas)]);
  const payRows = [...allPays].map(m=>({
    m, two:payG.TW[m]?.o||0, twr:payG.TW[m]?.r||0,
    ovo:payG.Overseas[m]?.o||0, ovr:payG.Overseas[m]?.r||0
  })).sort((a,b)=>(b.twr+b.ovr)-(a.twr+a.ovr));
  document.getElementById('pay-tbody').innerHTML = payRows.map(p=>\`<tr>
    \${td0(p.m,'',true)}
    \${tdR(fmt(p.two))}
    \${tdR('NT\$'+fmt(p.twr),'#4ade80')}
    \${tdR(fmt(p.ovo))}
    \${tdR('NT\$'+fmt(p.ovr),'#60a5fa')}
  </tr>\`).join('');

  // ── Range info ─────────────────────────────────────────
  const slotFmt = s => { const h=Math.floor(s/2),m=(s%2)*30; return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); };
  const hourLabel = (sh!==0||eh!==47) ? \` | 時段：\${slotFmt(sh)}～\${slotFmt(eh)}\` : '';
  const label = (start&&end) ? \`查詢區間：\${start} ~ \${end}\${hourLabel}\` : \`資料範圍：\${MIN_DATE} ~ \${MAX_DATE}（全部）\${hourLabel}\`;
  document.getElementById('range-info').textContent = label + '  |  產生時間：${now}';

  // ── Unknown IP orders table ────────────────────────────
  const unkFiltered = (start&&end) ? UNK_ORDERS.filter(u=>u.d>=start&&u.d<=end) : UNK_ORDERS;
  document.getElementById('unk-count').textContent = '共 ' + unkFiltered.length + ' 筆訂單（篩選後）';
  document.getElementById('unk-tbody').innerHTML = unkFiltered.map(u=>\`<tr>
    <td style="padding:.6rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);font-family:monospace;font-size:.82rem;color:#94a3b8">\${u.id}</td>
    <td style="padding:.6rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05)">\${u.name}</td>
    <td style="padding:.6rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);font-family:monospace;font-size:.82rem">\${u.mem}</td>
    <td style="padding:.6rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);font-family:monospace;font-size:.82rem;color:var(--muted)">\${u.ip}</td>
    <td style="padding:.6rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right">\${u.t}</td>
    <td style="padding:.6rem 1rem;border-bottom:1px solid rgba(255,255,255,0.05);color:var(--muted);font-size:.82rem">\${u.seat}</td>
  </tr>\`).join('');
}

function applyFilter() {
  const s = document.getElementById('startDate').value;
  const e = document.getElementById('endDate').value;
  const sh = parseInt(document.getElementById('startHour').value);
  const eh = parseInt(document.getElementById('endHour').value);
  if (sh > eh) { alert('起始時間不可晚於結束時間'); return; }
  if (s && e && s <= e) render(s, e, sh, eh);
  else alert('請選擇有效的日期區間');
}

function resetFilter() {
  document.getElementById('startDate').value = MIN_DATE;
  document.getElementById('endDate').value   = MAX_DATE;
  document.getElementById('startHour').value = '0';
  document.getElementById('endHour').value   = '47';
  render(null, null);
}

function setPreset(days) {
  const end = new Date(MAX_DATE);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  const fmt2 = d => d.toISOString().split('T')[0];
  const s = fmt2(start), e = fmt2(end);
  document.getElementById('startDate').value = s;
  document.getElementById('endDate').value   = e;
  document.getElementById('startHour').value = '0';
  document.getElementById('endHour').value   = '47';
  render(s, e);
}

function setThisYear() {
  document.getElementById('startDate').value = THIS_YEAR_START;
  document.getElementById('endDate').value   = THIS_YEAR_END;
  document.getElementById('startHour').value = '0';
  document.getElementById('endHour').value   = '47';
  render(THIS_YEAR_START, THIS_YEAR_END);
}

document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  const params = new URLSearchParams(window.location.search);
  const sd = params.get('startDate'), ed = params.get('endDate');
  const sh = params.get('startHour') !== null ? parseInt(params.get('startHour')) : 0;
  const eh = params.get('endHour') !== null ? parseInt(params.get('endHour')) : 47;
  if (sd && ed) {
    document.getElementById('startDate').value = sd;
    document.getElementById('endDate').value = ed;
    document.getElementById('startHour').value = String(sh);
    document.getElementById('endHour').value = String(eh);
    render(sd, ed, sh, eh);
  } else {
    render(null, null);
  }
});
<\/script>
</body>
</html>`;

  fs.writeFileSync('A_IP_Geo_Analysis_Report_Historical.html', html, 'utf-8');
  console.log('Report generated: A_IP_Geo_Analysis_Report_Historical.html');
  await client.close();
})().catch(console.error);
