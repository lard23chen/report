// Alex 個人資產配置分析報表產出腳本
// 資料來源：MongoDB (alex / AssetSnapshots)，執行：node alex/generate_alex_asset_report.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI_PERSONAL;
if (!uri) { console.error('MONGODB_URI_PERSONAL not set'); process.exit(1); }

// 分類固定色序（dataviz 驗證通過的 dark categorical palette，不可循環或重排）
const CATEGORY_ORDER = ['股票/基金', '銀行帳戶(國內)', '保險', '電子支付', '禮券', '加密貨幣', '其他', '不動產'];
const CATEGORY_COLORS = ['#3987e5', '#008300', '#d55181', '#c98500', '#199e70', '#d95926', '#9085e9', '#e66767'];

const fmt = n => 'NT$' + Math.round(n).toLocaleString();
const pct = (part, whole) => whole ? (part / whole * 100).toFixed(1) + '%' : '—';

async function main() {
    const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1 } });
    console.log('Connecting to MongoDB (alex/AssetSnapshots)...');
    await client.connect();
    const snapshots = await client.db('alex').collection('AssetSnapshots')
        .find({}).sort({ SnapshotDate: 1 }).toArray();
    await client.close();
    if (!snapshots.length) { console.error('No snapshots found'); process.exit(1); }

    const snap = snapshots[snapshots.length - 1];
    const reportTime = new Date().toLocaleString('zh-TW');

    // 分類彙總（正值資產）
    const catSums = {};
    for (const it of snap.Items) {
        if (it.Amount != null && it.Amount > 0) catSums[it.Category] = (catSums[it.Category] || 0) + it.Amount;
    }
    const assetCats = CATEGORY_ORDER.filter(c => catSums[c] > 0);
    const totalAssets = snap.TotalAssets;

    // Top 10 資產項目
    const top10 = snap.Items.filter(it => it.Amount != null && it.Amount > 0)
        .sort((a, b) => b.Amount - a.Amount).slice(0, 10);

    // 分析數據
    const liquid = (catSums['銀行帳戶(國內)'] || 0) + (catSums['電子支付'] || 0);
    const invest = (catSums['股票/基金'] || 0) + (catSums['加密貨幣'] || 0);
    const insurance = catSums['保險'] || 0;
    const insuranceDollar = snap.Items.filter(it => it.Category === '保險' && it.CurrencyMark === '$' && it.Amount > 0)
        .reduce((s, it) => s + it.Amount, 0);

    // 表格（依分類分組，含小計）
    const tableRows = CATEGORY_ORDER.filter(c => snap.Items.some(it => it.Category === c)).map((c, idx) => {
        const ci = CATEGORY_ORDER.indexOf(c);
        const rows = snap.Items.filter(it => it.Category === c).map(it => {
            const amt = it.Amount == null ? '<span class="muted">—（未估值）</span>'
                : it.Amount < 0 ? `<span class="neg">-${fmt(Math.abs(it.Amount))}</span>`
                : fmt(it.Amount);
            const share = (it.Amount != null && it.Amount > 0) ? pct(it.Amount, totalAssets) : '';
            const markNote = it.CurrencyMark === '$' ? ' <span class="tag-d">$口徑外</span>' : '';
            return `<tr><td>${it.Item}${markNote}</td><td class="num">${amt}</td><td class="num muted">${share}</td></tr>`;
        }).join('');
        const subtotal = snap.Items.filter(it => it.Category === c && it.Amount != null).reduce((s, it) => s + it.Amount, 0);
        return `<tbody class="cat-group">
            <tr class="cat-head"><td colspan="3"><span class="dot" style="background:${CATEGORY_COLORS[ci]}"></span>${c}<span class="cat-sub">小計 ${subtotal < 0 ? '-' + fmt(Math.abs(subtotal)) : fmt(subtotal)}（${subtotal > 0 ? pct(subtotal, totalAssets) : '負債'}）</span></td></tr>
            ${rows}
        </tbody>`;
    }).join('\n');

    const chartData = {
        cats: assetCats,
        catValues: assetCats.map(c => catSums[c]),
        catColors: assetCats.map(c => CATEGORY_COLORS[CATEGORY_ORDER.indexOf(c)]),
        top10Labels: top10.map(it => it.Item),
        top10Values: top10.map(it => it.Amount),
        history: snapshots.map(s => ({ d: s.SnapshotDate, net: s.NetAssets, assets: s.TotalAssets }))
    };

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alex 個人資產配置分析</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg:#121212; --card:#1e1e1e; --ink:#e0e0e0; --ink-2:#a0a0a0; --accent:#3987e5; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:var(--bg); color:var(--ink); font-family:'Outfit','Noto Sans TC',sans-serif; padding:24px; }
        .wrap { max-width:1100px; margin:0 auto; }
        header { background:var(--card); border-radius:12px; padding:24px 28px; border-bottom:3px solid var(--accent); display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; }
        h1 { font-size:1.6em; font-weight:800; color:var(--accent); }
        h1 span { color:var(--ink); font-weight:300; }
        .meta { color:var(--ink-2); font-size:0.85em; text-align:right; line-height:1.6; }
        .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; margin:18px 0; }
        .stat { background:var(--card); border-radius:10px; padding:18px 20px; border-left:3px solid var(--accent); }
        .stat .lbl { color:var(--ink-2); font-size:0.82em; margin-bottom:6px; }
        .stat .val { font-size:1.55em; font-weight:800; }
        .stat.hero { border-left-color:#199e70; } .stat.hero .val { color:#7fd4ae; }
        .stat.liab { border-left-color:#e66767; } .stat.liab .val { color:#e66767; }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
        @media (max-width:900px){ .grid2 { grid-template-columns:1fr; } }
        .card { background:var(--card); border-radius:10px; padding:20px; }
        .card h3 { font-size:1.02em; font-weight:600; border-left:3px solid var(--accent); padding-left:10px; margin-bottom:14px; }
        .chart-box { position:relative; height:340px; }
        table { width:100%; border-collapse:collapse; font-size:0.9em; }
        th, td { padding:8px 10px; text-align:left; border-bottom:1px solid #2c2c2c; }
        th { color:var(--ink-2); font-weight:600; font-size:0.85em; }
        td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
        .cat-head td { background:#252525; font-weight:700; padding-top:10px; }
        .cat-sub { color:var(--ink-2); font-weight:400; font-size:0.85em; margin-left:10px; }
        .dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:8px; vertical-align:baseline; }
        .muted { color:var(--ink-2); }
        .neg { color:#e66767; }
        .tag-d { font-size:0.72em; color:#d55181; border:1px solid #d55181; border-radius:3px; padding:0 4px; margin-left:4px; vertical-align:middle; }
        .analysis { background:#252525; border-left:3px solid var(--accent); border-radius:8px; padding:16px 20px; line-height:2; font-size:0.92em; margin-top:14px; }
        .analysis h4 { color:var(--accent); margin-bottom:6px; }
        footer { color:var(--ink-2); font-size:0.8em; text-align:center; margin:26px 0 8px; }
        .home-btn { position:fixed; right:22px; bottom:22px; background:#2c2c2c; color:var(--ink); text-decoration:none; padding:10px 18px; border-radius:24px; font-size:0.9em; box-shadow:0 4px 14px rgba(0,0,0,0.5); }
    </style>
</head>
<body>
<div class="wrap">
    <header>
        <div>
            <h1>ALEX <span>個人資產配置分析</span></h1>
            <div style="color:var(--ink-2);font-size:0.85em;margin-top:4px;">Data Source: Google Sheets → MongoDB (alex / AssetSnapshots)</div>
        </div>
        <div class="meta">資產快照日期: ${snap.SnapshotDate}<br>產生時間: ${reportTime}</div>
    </header>

    <div class="stats">
        <div class="stat hero"><div class="lbl">淨資產（全項目 − 負債）</div><div class="val">${fmt(snap.NetAssets)}</div></div>
        <div class="stat"><div class="lbl">總資產（含 $ 口徑保險）</div><div class="val">${fmt(snap.TotalAssets)}</div></div>
        <div class="stat liab"><div class="lbl">負債（富邦房貸）</div><div class="val">-${fmt(snap.TotalLiabilities)}</div></div>
        <div class="stat"><div class="lbl">NT$ 現值總計（試算表口徑）</div><div class="val">${fmt(snap.NtdPositiveTotal)}</div></div>
    </div>

    <div class="grid2">
        <div class="card"><h3>資產配置（依分類，佔總資產）</h3><div class="chart-box"><canvas id="allocChart"></canvas></div></div>
        <div class="card"><h3>Top 10 資產項目</h3><div class="chart-box"><canvas id="topChart"></canvas></div></div>
    </div>

    <div class="card">
        <h3>全部項目明細（${snap.Items.length} 項）</h3>
        <table>
            <thead><tr><th>項目</th><th class="num">金額</th><th class="num">佔總資產</th></tr></thead>
            ${tableRows}
            <tfoot>
                <tr style="border-top:2px solid var(--accent);font-weight:700;"><td>淨資產合計</td><td class="num">${fmt(snap.NetAssets)}</td><td></td></tr>
            </tfoot>
        </table>
        <div class="analysis">
            <h4>📊 配置分析</h4>
            💧 <b>流動性資金</b>（銀行 + 電子支付）：${fmt(liquid)}，佔總資產 ${pct(liquid, totalAssets)}<br>
            📈 <b>投資部位</b>（股票/基金 + 加密貨幣）：${fmt(invest)}，佔總資產 ${pct(invest, totalAssets)}<br>
            🛡️ <b>保險現值</b>：${fmt(insurance)}，佔總資產 ${pct(insurance, totalAssets)}（其中 ${fmt(insuranceDollar)} 為「$」標記保單，不列入試算表 NT$ 總計口徑）<br>
            🏠 <b>不動產</b>：汐止觀止、台東成功土地未估值，僅列房貸負債 -${fmt(snap.TotalLiabilities)}，實際淨資產應高於上列數字
        </div>
    </div>

    <footer>本頁由 alex/generate_alex_asset_report.js 自動產出 ｜ 手動修改將於下次執行時被覆蓋</footer>
</div>
<a class="home-btn" href="../report_index.html">🏠 回首頁</a>

<script>
const D = ${JSON.stringify(chartData)};
const SURFACE = '#1e1e1e';

// 資產配置 doughnut：直接標籤（分類 + %）作為 CVD 次要編碼，2px surface 間隔
new Chart(document.getElementById('allocChart'), {
    type: 'doughnut',
    data: { labels: D.cats, datasets: [{ data: D.catValues, backgroundColor: D.catColors, borderColor: SURFACE, borderWidth: 2 }] },
    options: {
        responsive: true, maintainAspectRatio: false, cutout: '55%',
        plugins: {
            legend: { position: 'right', labels: { color: '#e0e0e0', font: { family: 'Outfit', size: 12 }, boxWidth: 12, boxHeight: 12 } },
            datalabels: {
                display: ctx => ctx.dataset.data[ctx.dataIndex] != null,
                color: '#e0e0e0',
                backgroundColor: 'rgba(18,18,18,0.82)', borderRadius: 4,
                padding: { top: 3, bottom: 3, left: 6, right: 6 },
                font: { size: 10, weight: 'bold', family: 'Outfit' },
                formatter: (v, ctx) => {
                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const p = v / total * 100;
                    return p >= 3 ? ctx.chart.data.labels[ctx.dataIndex] + ' ' + p.toFixed(1) + '%' : '';
                }
            },
            tooltip: {
                backgroundColor: 'rgba(20,20,20,0.9)', titleColor: '#e0e0e0', bodyColor: '#a0a0a0', borderColor: '#333', borderWidth: 1,
                callbacks: { label: c => \` \${c.label}: NT$\${c.parsed.toLocaleString()} (\${(c.parsed / c.dataset.data.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%)\` }
            }
        }
    },
    plugins: [ChartDataLabels]
});

// Top 10 橫向長條：單一色相（量值），4px 圓角資料端
new Chart(document.getElementById('topChart'), {
    type: 'bar',
    data: { labels: D.top10Labels, datasets: [{ data: D.top10Values, backgroundColor: '#3987e5', borderRadius: 4, barThickness: 16 }] },
    options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            datalabels: {
                display: ctx => ctx.dataset.data[ctx.dataIndex] != null,
                anchor: 'end', align: 'end', offset: 2, clamp: true,
                color: '#a0a0a0', font: { size: 10, family: 'Outfit', weight: 'bold' },
                formatter: v => (v / 10000).toFixed(0) + '萬'
            },
            tooltip: {
                backgroundColor: 'rgba(20,20,20,0.9)', titleColor: '#e0e0e0', bodyColor: '#a0a0a0', borderColor: '#333', borderWidth: 1,
                callbacks: { label: c => ' NT$' + c.parsed.x.toLocaleString() }
            }
        },
        scales: {
            x: { ticks: { color: '#a0a0a0', font: { size: 10 }, callback: v => (v / 10000) + '萬' }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: '#e0e0e0', font: { size: 11 } }, grid: { display: false } }
        },
        layout: { padding: { right: 42 } }
    },
    plugins: [ChartDataLabels]
});
</script>
</body>
</html>`;

    const outPath = path.join(__dirname, 'Alex_Asset_Report.html');
    fs.writeFileSync(outPath, html, 'utf8');
    console.log('Report generated successfully at ' + outPath);
    console.log(`Snapshot: ${snap.SnapshotDate}, categories: ${assetCats.length}, items: ${snap.Items.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
