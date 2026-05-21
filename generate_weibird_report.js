
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB Connection Setup
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function generateReport() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        
        const collection = db.collection('Qware_Ticket_Data');

        const ACTIVITY_CODE = 'B0ATIQKM';
        const TARGET_NAME = '國泰世華銀行2026韋禮安「 HI WE1 韋，您好 巡迴演唱會」台北場';
        const TARGET_NAME_GA = '國泰世華銀行 2026 韋禮安 韋，您好 HI WE1巡迴演唱會';

        console.log(`Fetching ticket data for ActivityCode: ${ACTIVITY_CODE}...`);
        const data = await collection.find({ '節目代碼': ACTIVITY_CODE }).toArray();
        console.log(`Fetched ${data.length} records.`);

        // Sections data - if empty, we'll handle gracefully
        const sectionData = await db.collection('Qware_A_Section_number').find({ '節目名稱': TARGET_NAME }).toArray();
        console.log(`Fetched ${sectionData.length} section records.`);

        // ActivityID 39484 (Confirmed for WeiBird)
        const topEventId = 39484;
        console.log(`Fetching GA Data for ActivityID: ${topEventId}`);
        const gaSessions = await db.collection("QwareTrafficSession").find({ ActivityID: topEventId }).toArray();
        const gaReads = await db.collection("QwareTrafficGAReadTime").find({ ActivityID: topEventId }).toArray();

        console.log("Fetching Session/Pageview Data (Qware_A_Traffic_session_data)...");
        const pageViews = await db.collection("Qware_A_Traffic_session_data").find({ '節目名稱': TARGET_NAME_GA }).toArray();

        // Map member nationality
        console.log("Fetching Member Data for Nationalities...");
        const memberIds = [...new Set(data.map(d => d['會員編號']).filter(id => id && id !== '-'))];
        const memberColl = db.collection('Qware_Member_data');
        const members = await memberColl.find({ '會員編號': { $in: memberIds } }).toArray();

        const memberNatMap = {};
        const memberCityMap = {};
        members.forEach(m => {
            if (m['會員編號']) {
                if (m['國家']) memberNatMap[m['會員編號']] = m['國家'];
                if (m['縣市別']) memberCityMap[m['會員編號']] = m['縣市別'];
            }
        });

        // Attach nationality and city to ticket data
        data.forEach(d => {
            const memberId = d['會員編號'];
            d['國籍'] = (memberId && memberNatMap[memberId]) ? memberNatMap[memberId] : '未知';
            d['縣市別'] = (memberId && memberCityMap[memberId]) ? memberCityMap[memberId] : '未知';
            
            // Convert Decimals
            if (d['售價'] && d['售價'].$numberDecimal) d['售價'] = parseFloat(d['售價'].$numberDecimal);
            else if (d['售價']) d['售價'] = parseFloat(d['售價']);
            else d['售價'] = 0;

            if (d['原價'] && d['原價'].$numberDecimal) d['原價'] = parseFloat(d['原價'].$numberDecimal);
            else if (d['原價']) d['原價'] = parseFloat(d['原價']);
            else d['原價'] = 0;

            if (d['實退金額'] && d['實退金額'].$numberDecimal) d['實退金額'] = parseFloat(d['實退金額'].$numberDecimal);
            else if (d['實退金額']) d['實退金額'] = parseFloat(d['實退金額']);
            else d['實退金額'] = 0;
        });

        const reportTime = new Date().toLocaleString('zh-TW');

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>韋禮安「HI WE1 韋，您好 巡迴演唱會」台北場 - 專案分析報表</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-color: #38bdf8;
            --accent-secondary: #0ea5e9;
            --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            --success: #22c55e;
            --danger: #ef4444;
        }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background-color: var(--bg-color); color: var(--text-primary); margin: 0; padding: 30px; }
        .container { max-width: 1400px; margin: 0 auto; }
        header { margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; background: linear-gradient(to right, #1e293b, #0f172a); padding: 40px; border-radius: 24px; box-shadow: var(--shadow); border-bottom: 4px solid var(--accent-color); }
        .logo-text { font-size: 2.5rem; font-weight: 800; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; letter-spacing: -1px; }
        .logo-sub { font-size: 1.1rem; color: var(--accent-color); margin-top: 8px; font-weight: 600; }
        .meta { text-align: right; font-size: 0.95rem; color: var(--text-secondary); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 25px; margin-bottom: 40px; }
        .card { background: var(--card-bg); border-radius: 20px; padding: 25px; box-shadow: var(--shadow); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s; }
        .card:hover { border-color: var(--accent-color); transform: translateY(-5px); }
        .card h3 { margin: 0 0 15px 0; font-size: 0.85em; text-transform: uppercase; color: var(--text-secondary); }
        .card .value { font-size: 2.2em; font-weight: 700; color: var(--accent-color); }
        .card .sub { font-size: 0.85em; color: #64748b; margin-top: 8px; }
        .chart-card { background: var(--card-bg); border-radius: 24px; padding: 30px; box-shadow: var(--shadow); min-height: 400px; border: 1px solid rgba(255, 255, 255, 0.05); }
        .chart-card h3 { border-left: 5px solid var(--accent-color); padding-left: 15px; margin-bottom: 25px; font-size: 1.25rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.95em; }
        th, td { padding: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        th { color: var(--accent-color); font-weight: 600; font-size: 0.85rem; }
        .text-right { text-align: right; }
        .peak-table-container { overflow-x: auto; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; background: rgba(15, 23, 42, 0.5); margin-bottom: 20px; }
        .main-content { display: grid; grid-template-columns: 2fr 1fr; gap: 25px; margin-bottom: 40px; }
        .demo-content { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 40px; }
        .show-split { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 40px; }
        .progress-bar { background: rgba(255,255,255,0.05); width: 100%; border-radius: 10px; height: 8px; margin-top: 8px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--accent-color); }
    </style>
</head>
<body>
<div class="container">
    <header>
        <div>
            <div class="logo-text">WeiBird HI WE1 Concert</div>
            <div class="logo-sub">${TARGET_NAME}專案分析</div>
        </div>
        <div class="meta">報表生成: ${reportTime}<br>銷售紀錄: ${data.length.toLocaleString()} 筆</div>
    </header>

    <div class="stats-grid">
        <div class="card"><h3>總成交金額</h3><div class="value" id="val-revenue">--</div></div>
        <div class="card"><h3>總銷售張數</h3><div class="value" id="val-tickets">--</div></div>
        <div class="card"><h3>淨營收 (Net)</h3><div class="value text-success" id="val-net-revenue">--</div></div>
        <div class="card"><h3>退票張數</h3><div class="value text-danger" id="val-refund-tickets">--</div></div>
    </div>

    <div class="show-split">
        <div class="chart-card" style="min-height: 150px;"><h3>5/30 台北場</h3><div id="show1-info" style="font-size: 1.2rem;"></div></div>
        <div class="chart-card" style="min-height: 150px;"><h3>5/31 台北場</h3><div id="show2-info" style="font-size: 1.2rem;"></div></div>
    </div>

    <div class="demo-content">
        <div class="chart-card"><h3>性別分佈</h3><canvas id="genderChart"></canvas></div>
        <div class="chart-card"><h3>年齡分佈</h3><canvas id="ageChart"></canvas></div>
    </div>

    <div class="demo-content">
        <div class="chart-card"><h3>城市分佈 Top 10</h3><canvas id="cityChart"></canvas></div>
        <div class="chart-card"><h3>付款方式</h3><table id="paymentTable"><thead><tr><th>方式</th><th class="text-right">張數</th></tr></thead><tbody></tbody></table></div>
    </div>

    <div class="main-content">
        <div class="chart-card"><h3>銷售趨勢 (Daily)</h3><canvas id="trendChart"></canvas></div>
        <div class="chart-card"><h3>國籍統計</h3><table id="natTable"><thead><tr><th>國籍</th><th class="text-right">張數</th></tr></thead><tbody></tbody></table></div>
    </div>

    <div class="main-content" style="grid-template-columns: 1fr;">
        <div class="chart-card">
            <h3>開賣尖峰時段分析 (3/14 10:50 - 11:20)</h3>
            <div class="peak-table-container"><table id="minuteTable1"><thead><tr><th>時間</th><th>D</th><th>A</th><th>Session</th><th>訂單</th><th>累計</th><th>刷卡</th><th>ATM</th><th>轉換率</th></tr></thead><tbody></tbody></table></div>
        </div>
    </div>

    <div class="main-content" style="grid-template-columns: 1fr;">
        <div class="chart-card">
            <h3>開賣尖峰時段分析 (3/21 10:50 - 11:20)</h3>
            <div class="peak-table-container"><table id="minuteTable2"><thead><tr><th>時間</th><th>D</th><th>A</th><th>Session</th><th>訂單</th><th>累計</th><th>刷卡</th><th>ATM</th><th>轉換率</th></tr></thead><tbody></tbody></table></div>
        </div>
    </div>

    <div class="main-content" style="grid-template-columns: 1fr;">
        <div class="chart-card">
            <h3>各票價銷售概況</h3>
            <table id="priceTable"><thead><tr><th>票價</th><th class="text-right">張數</th><th class="text-right">金額</th><th>進度</th></tr></thead><tbody></tbody></table>
        </div>
    </div>
</div>

<script>
    const dbData = ${JSON.stringify(data)};
    const sectionData = ${JSON.stringify(sectionData)};
    const gaSessions = ${JSON.stringify(gaSessions)};
    const gaReads = ${JSON.stringify(gaReads)};
    const pageViews = ${JSON.stringify(pageViews)};
    
    function init() {
        const valid = dbData.filter(d => d['狀態'] === '正常');
        const refund = dbData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');
        
        const rev = valid.reduce((a, c) => a + (c['售價'] || 0), 0);
        const refAmt = refund.reduce((a, c) => a + (c['實退金額'] || 0), 0);
        
        document.getElementById('val-revenue').innerText = '$' + rev.toLocaleString();
        document.getElementById('val-tickets').innerText = valid.length.toLocaleString();
        document.getElementById('val-net-revenue').innerText = '$' + (rev - refAmt).toLocaleString();
        document.getElementById('val-refund-tickets').innerText = refund.length.toLocaleString();

        // Shows
        const s1 = valid.filter(d => d['演出時間/規格'] && d['演出時間/規格'].includes('2026-05-30'));
        const s2 = valid.filter(d => d['演出時間/規格'] && d['演出時間/規格'].includes('2026-05-31'));
        document.getElementById('show1-info').innerText = s1.length.toLocaleString() + ' 張 (' + Math.round(s1.length/valid.length*100) + '%)';
        document.getElementById('show2-info').innerText = s2.length.toLocaleString() + ' 張 (' + Math.round(s2.length/valid.length*100) + '%)';

        // Gender Chart
        const gStats = {}; valid.forEach(o => { const g = o['性別']; if(g && g !== '-') gStats[g] = (gStats[g]||0)+1; });
        new Chart(document.getElementById('genderChart'), {
            type: 'doughnut',
            data: { labels: Object.keys(gStats), datasets: [{ data: Object.values(gStats), backgroundColor: ['#fb7185', '#38bdf8', '#94a3b8'] }] },
            plugins: [ChartDataLabels],
            options: { plugins: { datalabels: { color: 'white', formatter: (v, ctx) => Math.round(v/ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0)*100)+'%' } } }
        });

        // Age Chart
        const ageStats = {}; valid.forEach(o => { const a = parseInt(o['年齡']); let l = isNaN(a) ? '未知' : (a < 20 ? '<20' : a < 30 ? '20s' : a < 40 ? '30s' : a < 50 ? '40s' : '50+'); ageStats[l] = (ageStats[l]||0)+1; });
        new Chart(document.getElementById('ageChart'), {
            type: 'bar',
            data: { labels: Object.keys(ageStats), datasets: [{ data: Object.values(ageStats), backgroundColor: '#38bdf8' }] }
        });

        // City Chart
        const cityStats = {}; valid.forEach(o => { const c = o['縣市別']; if(c && c !== '格式不符' && c !== '未知') cityStats[c] = (cityStats[c]||0)+1; });
        const topCities = Object.entries(cityStats).sort((a,b) => b[1]-a[1]).slice(0, 10);
        new Chart(document.getElementById('cityChart'), {
            type: 'bar', data: { labels: topCities.map(c=>c[0]), datasets: [{ data: topCities.map(c=>c[1]), backgroundColor: '#818cf8' }] }, options: { indexAxis: 'y' }
        });

        // Trend Chart
        const tStats = {}; valid.forEach(o => { const d = o['交易時間'] ? o['交易時間'].split(' ')[0] : 'Unknown'; tStats[d] = (tStats[d]||0)+1; });
        const sorted = Object.keys(tStats).sort();
        new Chart(document.getElementById('trendChart'), {
            type: 'bar',
            plugins: [ChartDataLabels],
            data: { labels: sorted, datasets: [{ data: sorted.map(d=>tStats[d]), backgroundColor: '#38bdf8' }] },
            options: { plugins: { datalabels: { color: '#94a3b8', anchor: 'end', align: 'top' } } }
        });

        // Peak Logic
        const renderPeak = (tid, date, hS, mS, hE, mE) => {
            const stats = {};
            for(let h=hS; h<=hE; h++) {
                for(let m=0; m<60; m++) {
                    if(h===hS && m<mS) continue; if(h===hE && m>mE) continue;
                    const key = (h<10?'0'+h:h)+':'+(m<10?'0'+m:m);
                    stats[key] = { t: 0, c: 0, a: 0, d: 0, u: 0, s: 0, ords: 0 };
                }
            }
            valid.forEach(o => {
                if(o['交易時間'] && o['交易時間'].startsWith(date)) {
                    const hm = o['交易時間'].split(' ')[1].substring(0, 5);
                    if(stats[hm]) {
                        stats[hm].t++;
                        stats[hm].ords++;
                        if(o['付款方式'].includes('信用卡')) stats[hm].c++; else stats[hm].a++;
                    }
                }
            });
            gaSessions.forEach(s => { if(s.CreateTime && s.CreateTime.includes(date)) { const hm = s.CreateTime.substring(11, 16); if(stats[hm]) stats[hm].s = s.SessionCount; } });
            gaReads.forEach(r => { if(r.CreateTime && r.CreateTime.includes(date)) { const hm = r.CreateTime.substring(11, 16); if(stats[hm]) { stats[hm].d = r.ActiveUsersDMinCount; stats[hm].u = r.ActiveUsersAMinCount; } } });

            const body = document.querySelector(\`#\${tid} tbody\`);
            let cum = 0;
            Object.keys(stats).sort().forEach(k => {
                const s = stats[k]; cum += s.t;
                const tr = document.createElement('tr');
                tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${s.d||'--'}</td><td class="text-right">\${s.u||'--'}</td><td class="text-right">\${s.s||'--'}</td><td class="text-right">\${s.t}</td><td class="text-right">\${cum}</td><td class="text-right">\${s.c}</td><td class="text-right">\${s.a}</td><td class="text-right">\${valid.length>0?Math.round(cum/valid.length*100)+'%':'0%'}</td>\`;
                body.appendChild(tr);
            });
        };
        renderPeak('minuteTable1', '2026-03-14', 10, 50, 11, 20);
        renderPeak('minuteTable2', '2026-03-21', 10, 50, 11, 20);

        // Price Table
        const pStats = {}; valid.forEach(o => { const p = o['售價']||0; pStats[p] = pStats[p] || { c: 0, r: 0 }; pStats[p].c++; pStats[p].r += p; });
        const pBody = document.querySelector('#priceTable tbody');
        Object.entries(pStats).sort((a,b)=>b[0]-a[0]).forEach(([p, s]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`<td>$\${parseInt(p).toLocaleString()}</td><td class="text-right">\${s.c.toLocaleString()}</td><td class="text-right">$\${s.r.toLocaleString()}</td><td><div class="progress-bar"><div class="progress-fill" style="width: 100%"></div></div></td>\`;
            pBody.appendChild(tr);
        });

        // Payment/Nat
        const payBody = document.querySelector('#paymentTable tbody');
        const payStats = {}; valid.forEach(o => { const p = o['付款方式']; payStats[p] = (payStats[p]||0)+1; });
        Object.entries(payStats).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => { const tr = document.createElement('tr'); tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${v}</td>\`; payBody.appendChild(tr); });

        const natBody = document.querySelector('#natTable tbody');
        const natStats = {}; valid.forEach(o => { const n = o['國籍']; natStats[n] = (natStats[n]||0)+1; });
        Object.entries(natStats).sort((a,b)=>b[1]-a[1]).slice(0, 5).forEach(([k,v]) => { const tr = document.createElement('tr'); tr.innerHTML = \`<td>\${k}</td><td class="text-right">\${v}</td>\`; natBody.appendChild(tr); });
    }
    init();
</script>
</body>
</html>
        `;

        const fileName = 'A_WeiBird_Report_2026.html';
        const filePath = path.join(__dirname, fileName);
        fs.writeFileSync(filePath, htmlContent);
        console.log(`Report generated successfully: ${filePath}`);

    } catch (e) {
        console.error("Error generating report:", e);
    } finally {
        await client.close();
    }
}

generateReport();
