const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/";

// Optimization: Use $in to batch queries for all top 10 programs at once
// instead of 5 separate queries per program (50 -> ~6 queries total)

async function main() {
    const client = new MongoClient(uri);
    try {
        console.log("Connecting to DMP database...");
        await client.connect();
        console.log("Connected!");
        const db = client.db("trek-first-party-dmp");
        const coll = db.collection("event");

        const baseMatch = {
            name: "page_view",
            bu: "D",
            content_name: { $ne: null, $nin: [null, ""] },
            canonical_url: { $regex: /^https:\/\/ticket\.ibon\.com\.tw\// }
        };

        // ============ Step 1: Get Top 10 + total in one pipeline ============
        console.log("Step 1: Getting Top 10 programs...");
        console.time("top10");
        const top10Raw = await coll.aggregate([
            { $match: baseMatch },
            { $group: { _id: "$content_name", attribution_ids: { $addToSet: "$attribution_id" }, views: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 10 }
        ], { allowDiskUse: true }).toArray();
        console.timeEnd("top10");
        console.log(`Got ${top10Raw.length} top programs.`);

        const top10 = top10Raw.map((r, i) => {
            const ids = new Set();
            if (r.attribution_ids) r.attribution_ids.forEach(id => { if (id && id.trim()) ids.add(id); });
            return { name: r._id, totalViews: r.views, ids, rank: i + 1 };
        });

        const top10Names = top10.map(t => t.name);

        // Get overall total
        console.log("Getting total page views...");
        console.time("total");
        const totalResult = await coll.aggregate([
            { $match: baseMatch },
            { $count: "total" }
        ], { allowDiskUse: true }).toArray();
        const overallTotal = totalResult[0]?.total || 0;
        console.timeEnd("total");
        console.log("Total views:", overallTotal);

        // ============ Step 2: Batch queries for all top 10 at once ============
        const detailMatch = {
            ...baseMatch,
            content_name: { $in: top10Names }
        };

        // 2a: Monthly breakdown for all programs at once
        console.log("Step 2a: Monthly breakdown (batch)...");
        console.time("monthly");
        const monthlyAll = await coll.aggregate([
            { $match: { ...detailMatch, time: { $exists: true, $ne: null } } },
            { $group: { _id: { prog: "$content_name", month: { $dateToString: { format: "%Y-%m", date: "$time" } } }, views: { $sum: 1 } } },
            { $sort: { "_id.month": 1 } }
        ], { allowDiskUse: true }).toArray();
        console.timeEnd("monthly");

        // 2b: Daily breakdown for all programs at once
        console.log("Step 2b: Daily breakdown (batch)...");
        console.time("daily");
        const dailyAll = await coll.aggregate([
            { $match: { ...detailMatch, time: { $exists: true, $ne: null } } },
            { $group: { _id: { prog: "$content_name", day: { $dateToString: { format: "%Y-%m-%d", date: "$time" } } }, views: { $sum: 1 } } },
            { $sort: { "_id.day": 1 } }
        ], { allowDiskUse: true }).toArray();
        console.timeEnd("daily");

        // 2c: Device breakdown for all programs at once
        console.log("Step 2c: Device breakdown (batch)...");
        console.time("device");
        const deviceAll = await coll.aggregate([
            { $match: detailMatch },
            { $project: { content_name: 1, device: { $cond: [{ $regexMatch: { input: { $ifNull: ["$user_agent", ""] }, regex: /Mobile|Android|iPhone|iPad/ } }, "Mobile", "Desktop"] } } },
            { $group: { _id: { prog: "$content_name", device: "$device" }, count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ], { allowDiskUse: true }).toArray();
        console.timeEnd("device");

        // 2d: Hourly distribution for all programs at once
        console.log("Step 2d: Hourly distribution (batch)...");
        console.time("hourly");
        const hourlyAll = await coll.aggregate([
            { $match: { ...detailMatch, time: { $exists: true, $ne: null } } },
            { $group: { _id: { prog: "$content_name", hour: { $hour: "$time" } }, views: { $sum: 1 } } },
            { $sort: { "_id.hour": 1 } }
        ], { allowDiskUse: true }).toArray();
        console.timeEnd("hourly");

        // 2e: Unique visitors for all programs at once
        console.log("Step 2e: Unique visitors (batch)...");
        console.time("uv");
        const uvAll = await coll.aggregate([
            { $match: detailMatch },
            { $group: { _id: { prog: "$content_name", fp: "$fp_id" } } },
            { $group: { _id: "$_id.prog", uniqueCount: { $sum: 1 } } }
        ], { allowDiskUse: true }).toArray();
        console.timeEnd("uv");

        // ============ Step 3: Build per-program data maps ============
        console.log("Step 3: Building detail pages...");

        const monthlyMap = {};
        monthlyAll.forEach(m => {
            if (!monthlyMap[m._id.prog]) monthlyMap[m._id.prog] = [];
            monthlyMap[m._id.prog].push({ month: m._id.month, views: m.views });
        });

        const dailyMap = {};
        dailyAll.forEach(d => {
            if (!dailyMap[d._id.prog]) dailyMap[d._id.prog] = [];
            dailyMap[d._id.prog].push({ day: d._id.day, views: d.views });
        });

        const deviceMap = {};
        deviceAll.forEach(d => {
            if (!deviceMap[d._id.prog]) deviceMap[d._id.prog] = [];
            deviceMap[d._id.prog].push({ device: d._id.device, count: d.count });
        });

        const hourlyMap = {};
        hourlyAll.forEach(h => {
            if (!hourlyMap[h._id.prog]) hourlyMap[h._id.prog] = [];
            hourlyMap[h._id.prog].push({ hour: h._id.hour, views: h.views });
        });

        const uvMap = {};
        uvAll.forEach(u => { uvMap[u._id] = u.uniqueCount; });

        // ============ Step 4: Generate detail HTML files ============
        const detailsDir = path.join(__dirname, 'dmp_details_alltime');
        if (!fs.existsSync(detailsDir)) fs.mkdirSync(detailsDir);

        for (let idx = 0; idx < top10.length; idx++) {
            const prog = top10[idx];
            console.log(`  [${idx + 1}/10] Building: ${prog.name}`);

            const monthlyData = (monthlyMap[prog.name] || []).sort((a, b) => a.month.localeCompare(b.month));
            const dailyData = (dailyMap[prog.name] || []).sort((a, b) => a.day.localeCompare(b.day));
            const deviceData = deviceMap[prog.name] || [];
            const hourlyData = hourlyMap[prog.name] || [];
            const uvCount = uvMap[prog.name] || 0;

            const monthLabels = monthlyData.map(d => d.month);
            const monthValues = monthlyData.map(d => d.views);
            const dailyLabels = dailyData.map(d => d.day);
            const dailyValues = dailyData.map(d => d.views);
            const deviceLabels = deviceData.map(d => d.device || 'Unknown');
            const deviceValues = deviceData.map(d => d.count);
            const deviceTotal = deviceValues.reduce((a, b) => a + b, 0);

            const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
            const hourValues = Array.from({ length: 24 }, (_, i) => {
                const found = hourlyData.find(h => h.hour === i);
                return found ? found.views : 0;
            });

            const totalMonthly = monthValues.reduce((a, b) => a + b, 0);
            const monthTableRows = [...monthlyData].reverse().map(m => {
                const pct = totalMonthly > 0 ? ((m.views / totalMonthly) * 100).toFixed(2) : '0.00';
                return `<tr><td style="color:#94a3b8;">${m.month}</td><td style="text-align:right;color:#f8fafc;font-weight:500;">${m.views.toLocaleString()}</td><td style="text-align:right;color:#a78bfa;">${pct}%</td></tr>`;
            }).join('');

            const deviceTableRows = deviceData.map(d => {
                const pct = deviceTotal > 0 ? ((d.count / deviceTotal) * 100).toFixed(1) : '0.0';
                return `<tr><td style="color:#94a3b8;">${d.device || 'Unknown'}</td><td style="text-align:right;color:#f8fafc;font-weight:500;">${d.count.toLocaleString()}</td><td style="text-align:right;color:#34d399;">${pct}%</td></tr>`;
            }).join('');

            const avgDaily = dailyValues.length > 0 ? Math.round(dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length) : 0;
            const peakIdx = dailyValues.length > 0 ? dailyValues.indexOf(Math.max(...dailyValues)) : -1;
            const peakDay = peakIdx >= 0 ? dailyLabels[peakIdx] : '-';
            const peakViews = peakIdx >= 0 ? dailyValues[peakIdx] : 0;

            const detailFileName = `A_DMP_PageView_AllTime_Detail_${idx.toString().padStart(3, '0')}.html`;
            prog.detailLink = `dmp_details_alltime/${detailFileName}`;

            const detailHtml = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${prog.name} - DMP 流量深度分析</title>
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
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg-color: #0f172a; --card-bg: rgba(30, 41, 59, 0.7); --card-border: rgba(255, 255, 255, 0.1); }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background: var(--bg-color); background-image: radial-gradient(at 0% 0%, rgba(59,130,246,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(139,92,246,0.15) 0px, transparent 50%); background-attachment: fixed; color: #f8fafc; padding: 40px 20px; }
        .container { max-width: 1100px; margin: 0 auto; }
        .header { margin-bottom: 30px; border-bottom: 1px solid var(--card-border); padding-bottom: 20px; }
        .header h1 { font-size: 1.8rem; color: #60a5fa; margin-bottom: 10px; font-weight: 700; }
        .header p { color: #94a3b8; font-size: 1rem; }
        .card { background: var(--card-bg); border-radius: 12px; padding: 25px; margin-bottom: 25px; border: 1px solid var(--card-border); backdrop-filter: blur(10px); }
        .chart-container { height: 300px; width: 100%; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .stat-box { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 20px; text-align: center; backdrop-filter: blur(10px); }
        .stat-box .label { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .stat-box .value { font-size: 1.8rem; font-weight: 700; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 10px 12px; color: #94a3b8; border-bottom: 2px solid rgba(255,255,255,0.1); font-size: 0.85rem; }
        td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem; }
        tr:hover { background-color: rgba(255,255,255,0.03); }
        .btn-back { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; margin-bottom: 20px; font-weight: 500; transition: all 0.3s; }
        .btn-back:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(37,99,235,0.4); }
        .table-wrapper { max-height: 400px; overflow-y: auto; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
        @media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <a href="../A_DMP_PageView_Report_AllTime_Top10.html" class="btn-back">← 返回 Top 10 排行榜</a>
        <div class="header">
            <h1>${prog.name}</h1>\n<!-- Data Source Header -->\n<div style="margin-top:8px; color: #888; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px;">\n    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> \n    Data Source: MongoDB (QwareAi / Qware_A_Ticket_data)\n</div>
            <p>First-Party DMP 深度流量分析 · 排名 #${prog.rank}</p>
        </div>

        <div class="stats-grid">
            <div class="stat-box">
                <div class="label">總瀏覽量</div>
                <div class="value" style="color: #60a5fa;">${prog.totalViews.toLocaleString()}</div>
            </div>
            <div class="stat-box">
                <div class="label">不重複訪客</div>
                <div class="value" style="color: #a78bfa;">${uvCount.toLocaleString()}</div>
            </div>
            <div class="stat-box">
                <div class="label">日均瀏覽量</div>
                <div class="value" style="color: #34d399;">${avgDaily.toLocaleString()}</div>
            </div>
            <div class="stat-box">
                <div class="label">尖峰日</div>
                <div class="value" style="color: #fbbf24; font-size: 1.2rem;">${peakDay}<br><span style="font-size:0.85rem;color:#94a3b8;">${peakViews.toLocaleString()} views</span></div>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-bottom: 15px; color: #60a5fa;">📈 每日瀏覽量趨勢</h3>
            <div class="chart-container">
                <canvas id="dailyChart"></canvas>
            </div>
        </div>

        <div class="two-col">
            <div class="card">
                <h3 style="margin-bottom: 15px; color: #a78bfa;">📊 每月數據明細</h3>
                <div class="table-wrapper">
                    <table>
                        <thead><tr><th>月份</th><th style="text-align:right;">瀏覽量</th><th style="text-align:right;">佔比</th></tr></thead>
                        <tbody>${monthTableRows}</tbody>
                    </table>
                </div>
            </div>
            <div class="card">
                <h3 style="margin-bottom: 15px; color: #34d399;">📱 裝置分佈</h3>
                <div style="height: 200px; margin-bottom: 15px;"><canvas id="deviceChart"></canvas></div>
                <table>
                    <thead><tr><th>裝置類型</th><th style="text-align:right;">次數</th><th style="text-align:right;">佔比</th></tr></thead>
                    <tbody>${deviceTableRows}</tbody>
                </table>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-bottom: 15px; color: #fb923c;">🕐 時段分佈 (UTC)</h3>
            <div class="chart-container">
                <canvas id="hourlyChart"></canvas>
            </div>
        </div>
    </div>

    <script>
        Chart.register(ChartDataLabels);

        // Daily Chart
        new Chart(document.getElementById('dailyChart').getContext('2d'), {
            type: 'line',
            data: { labels: ${JSON.stringify(dailyLabels)}, datasets: [{ label: 'Page Views', data: ${JSON.stringify(dailyValues)}, borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 2, tension: 0.2, fill: true, pointRadius: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } }, interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 12, maxRotation: 45, font: { size: 10 } } } } }
        });

        // Device Doughnut
        new Chart(document.getElementById('deviceChart').getContext('2d'), {
            type: 'doughnut',
            data: { labels: ${JSON.stringify(deviceLabels)}, datasets: [{ data: ${JSON.stringify(deviceValues)}, backgroundColor: ['#a78bfa', '#34d399', '#fb923c', '#60a5fa'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0', font: { size: 12 } } }, datalabels: { color: '#fff', formatter: (val, ctx) => { const t = ctx.dataset.data.reduce((a,b)=>a+b,0); return ((val/t)*100).toFixed(1)+'%'; }, font: { weight: 'bold', size: 13 } } } }
        });

        // Hourly Bar
        new Chart(document.getElementById('hourlyChart').getContext('2d'), {
            type: 'bar',
            data: { labels: ${JSON.stringify(hourLabels)}, datasets: [{ label: 'Views', data: ${JSON.stringify(hourValues)}, backgroundColor: 'rgba(251,146,60,0.6)', borderColor: '#fb923c', borderWidth: 1, borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } } } }
        });
    <\/script>
</body>
</html>`;

            fs.writeFileSync(path.join(detailsDir, detailFileName), detailHtml, 'utf8');
            console.log(`    -> Saved ${detailFileName}`);
        }

        // ============ Step 5: Regenerate main Top 10 report ============
        console.log("Step 5: Building main Top 10 report...");

        const tableRows = top10.map((item) => {
            const rankClass = item.rank === 1 ? 'rank-1' : item.rank === 2 ? 'rank-2' : item.rank === 3 ? 'rank-3' : '';
            const pct = ((item.totalViews / overallTotal) * 100).toFixed(2);
            const idStr = item.ids.size > 0 ? Array.from(item.ids).join(', ') : '-';
            return `<tr><td style="text-align:center;"><span class="rank ${rankClass}">${item.rank}</span></td><td style="font-weight:500;"><a href="${item.detailLink}" target="_blank" style="color:#60a5fa;text-decoration:none;border-bottom:1px dashed #60a5fa;">${item.name}</a></td><td style="color:#bbf7d0;font-size:0.85rem;word-break:break-all;">${idStr}</td><td style="text-align:right;color:#f8fafc;font-weight:600;">${item.totalViews.toLocaleString()}</td><td style="text-align:right;color:var(--text-secondary);">${pct}%</td></tr>`;
        }).join('');

        const mainHtml = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DMP 歷史累積 Top 10 節目 Page View 排行榜</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg-color: #0f172a; --card-bg: rgba(30, 41, 59, 0.7); --card-border: rgba(255, 255, 255, 0.1); --text-primary: #f8fafc; --text-secondary: #94a3b8; --accent: #3b82f6; --glass-bg: rgba(15, 23, 42, 0.6); }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background-color: var(--bg-color); background-image: radial-gradient(at 0% 0%, rgba(59,130,246,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(139,92,246,0.15) 0px, transparent 50%); background-attachment: fixed; color: var(--text-primary); min-height: 100vh; padding: 40px 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid var(--card-border); }
        .header-left h1 { font-size: 2.5rem; font-weight: 800; background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
        .header-left p { color: var(--text-secondary); font-size: 1.1rem; }
        .stat-card { background: var(--card-bg); backdrop-filter: blur(12px); border: 1px solid var(--card-border); border-radius: 16px; padding: 24px; display: inline-block; }
        .stat-card h3 { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .stat-card .value { font-size: 2.5rem; font-weight: 700; color: var(--text-primary); text-shadow: 0 0 20px rgba(59,130,246,0.3); }
        .content-grid { display: grid; grid-template-columns: 1fr; gap: 30px; margin-bottom: 40px; }
        .card { background: var(--card-bg); backdrop-filter: blur(12px); border: 1px solid var(--card-border); border-radius: 16px; padding: 30px; }
        .card-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
        .chart-container { height: 400px; width: 100%; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 16px; color: var(--text-secondary); font-weight: 600; border-bottom: 2px solid rgba(255,255,255,0.1); position: sticky; top: 0; background: var(--glass-bg); backdrop-filter: blur(8px); }
        td { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        tbody tr:hover { background-color: rgba(255,255,255,0.03); }
        .rank { display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; background: rgba(255,255,255,0.1); font-weight: bold; font-size: 0.85rem; }
        .rank-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #000; box-shadow: 0 0 10px rgba(245,158,11,0.5); }
        .rank-2 { background: linear-gradient(135deg, #94a3b8, #64748b); color: #fff; }
        .rank-3 { background: linear-gradient(135deg, #b45309, #78350f); color: #fff; }
        .btn-home { position: fixed; bottom: 30px; right: 30px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(37,99,235,0.4); z-index: 50; }
        .btn-home:hover { transform: translateY(-3px); }
        .table-wrapper { max-height: 600px; overflow-y: auto; border-radius: 8px; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        @media (max-width: 768px) { .header { flex-direction: column; align-items: flex-start; gap: 20px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-left">
                <h1>歷史累積 Top 10 節目流量排行榜</h1>
                <p>First-Party DMP 歷史所有資料總計 Page View 排行榜</p>
            </div>
            <div style="display: flex; gap: 15px; align-items: stretch;">
                <div class="stat-card">
                    <h3>歷史總瀏覽量 (All-Time Valid Match)</h3>
                    <div class="value">${overallTotal.toLocaleString()}</div>
                </div>
            </div>
        </div>
        <div class="content-grid">
            <div class="card">
                <div class="card-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                    Top 10 熱門節目 (歷史累積)
                </div>
                <div class="chart-container"><canvas id="top10Chart"></canvas></div>
            </div>
            <div class="card" style="padding: 0;">
                <div style="padding: 30px 30px 15px;">
                    <div class="card-title" style="margin-bottom: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                        節目場次瀏覽量詳情 <span style="font-size:0.85rem;color:#94a3b8;margin-left:8px;">點擊節目名稱查看深度分析</span>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead><tr>
                            <th style="width:80px;text-align:center;">排名</th>
                            <th>節目名稱 (Content Name)</th>
                            <th style="width:15%;color:#bbf7d0;">節目ID</th>
                            <th style="text-align:right;">瀏覽量 (Page Views)</th>
                            <th style="text-align:right;width:120px;">歷史總佔比</th>
                        </tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    <a href="report_index.html" class="btn-home">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
        回首頁
    </a>
    <script>
        const top10Labels = ${JSON.stringify(top10.map(t => t.name))};
        const top10Data = ${JSON.stringify(top10.map(t => t.totalViews))};
        Chart.register(ChartDataLabels);
        const formattedLabels = top10Labels.map(l => l.length > 20 ? l.substring(0, 20) + '...' : l);
        new Chart(document.getElementById('top10Chart').getContext('2d'), {
            type: 'bar',
            data: { labels: formattedLabels, datasets: [{ label: 'Page Views', data: top10Data, backgroundColor: 'rgba(59,130,246,0.7)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 6, hoverBackgroundColor: 'rgba(96,165,250,0.9)' }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', titleFont: { size: 14 }, bodyFont: { size: 14 }, padding: 12, callbacks: { title: ctx => top10Labels[ctx[0].dataIndex], label: ctx => 'Views: ' + ctx.parsed.y.toLocaleString() } }, datalabels: { color: '#f8fafc', anchor: 'end', align: 'top', formatter: v => v.toLocaleString(), font: { weight: 'bold', size: 11 } } },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, border: { display: false } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Noto Sans TC' }, maxRotation: 45, minRotation: 45 }, border: { color: 'rgba(255,255,255,0.1)' } } },
                layout: { padding: { top: 30 } }
            }
        });
    <\/script>
</body>
</html>`;

        fs.writeFileSync(path.join(__dirname, 'A_DMP_PageView_Report_AllTime_Top10.html'), mainHtml, 'utf8');
        console.log('Main report regenerated!');
        console.log('All done!');

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

main().catch(console.dir);
