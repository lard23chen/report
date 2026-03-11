const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/";

async function main() {
    const client = new MongoClient(uri);
    try {
        console.log("Connecting to DMP database...");
        await client.connect();
        const db = client.db("trek-first-party-dmp");
        const coll = db.collection("event");

        const startDt = new Date("2025-11-30T16:00:00.000Z"); // 台灣時間 2025-12-01 00:00
        const endDt = new Date("2025-12-31T16:00:00.000Z");   // 台灣時間 2025-12-01 00:00

        console.log("Running aggregation pipeline for daily stats...");
        const pipeline = [
            {
                $match: {
                    name: "page_view",
                    bu: "D",
                    time: { $gte: startDt, $lt: endDt },
                    content_name: { $ne: null, $ne: "" },
                    canonical_url: { $regex: /^https:\/\/ticket\.ibon\.com\.tw\// }
                }
            },
            {
                $group: {
                    _id: {
                        name: "$content_name",
                        day: { $dateToString: { format: "%Y-%m-%d", date: "$time", timezone: "+08:00" } }
                    },
                    attribution_ids: { $addToSet: "$attribution_id" },
                    views: { $sum: 1 }
                }
            }
        ];

        const rawDailyResults = await coll.aggregate(pipeline).toArray();
        console.log(`Aggregation complete. Grouping results...`);

        const programMap = new Map();
        rawDailyResults.forEach(r => {
            const name = r._id.name;
            const day = r._id.day;
            const views = r.views;
            if (!name || name.trim() === '' || name === 'null' || name === 'undefined') return;

            if (!programMap.has(name)) {
                programMap.set(name, { name, totalViews: 0, daily: {}, ids: new Set() });
            }
            const prog = programMap.get(name);
            prog.totalViews += views;
            prog.daily[day] = (prog.daily[day] || 0) + views;

            if (r.attribution_ids && Array.isArray(r.attribution_ids)) {
                r.attribution_ids.forEach(id => {
                    if (id && id.trim() !== '' && id !== 'null' && id !== 'undefined') prog.ids.add(id);
                });
            }
        });

        // 移除瀏覽量少於 50 的
        const validPrograms = Array.from(programMap.values()).filter(p => p.totalViews >= 50);
        validPrograms.sort((a, b) => b.totalViews - a.totalViews);

        console.log(`Found ${validPrograms.length} unique programs with >= 50 views.`);

        const top10 = validPrograms.slice(0, 10);
        const totalViews = validPrograms.reduce((sum, item) => sum + item.totalViews, 0);

        // 建立 dmp_details_dec 資料夾
        const detailsDir = path.join(__dirname, 'dmp_details_dec');
        if (!fs.existsSync(detailsDir)) {
            fs.mkdirSync(detailsDir);
        }

        // 產生所有日期的陣列，讓趨勢圖可以補 0
        const allDays = [];
        let curr = new Date("2025-12-01T00:00:00.000Z");
        while (curr <= new Date("2025-12-31T00:00:00.000Z")) {
            const dStr = curr.toISOString().slice(0, 10);
            allDays.push(dStr);
            curr.setDate(curr.getDate() + 1);
        }

        // 產生獨立每日報表
        console.log("Building detail reports...");
        validPrograms.forEach((prog, idx) => {
            const safeName = "Dec_Detail_" + String(idx).padStart(3, '0');
            const detailFileName = `A_DMP_PageView_${safeName}.html`;
            prog.detailLink = `dmp_details_dec/${detailFileName}`;

            const chartData = allDays.map(d => prog.daily[d] || 0);

            const tableRowsHtml = allDays.map(d => {
                const amount = prog.daily[d] || 0;
                const pct = prog.totalViews > 0 ? ((amount / prog.totalViews) * 100).toFixed(2) : "0.00";
                return `<tr>
                    <td style="text-align: center;">${d}</td>
                    <td style="text-align: right; color: #60a5fa; font-weight: ${amount > 0 ? '600' : '400'};">${amount.toLocaleString()}</td>
                    <td style="text-align: right; color: var(--text-secondary);">${pct}%</td>
                </tr>`;
            }).join('');

            const detailHtml = `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${prog.name} - 流量趨勢分析</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --card-border: rgba(255, 255, 255, 0.1);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --glass-bg: rgba(15, 23, 42, 0.6);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            padding: 40px 20px;
        }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { margin-bottom: 30px; border-bottom: 1px solid var(--card-border); padding-bottom: 20px; }
        .header h1 { font-size: 2rem; color: #a78bfa; margin-bottom: 10px; }
        .header p { color: var(--text-secondary); font-size: 1.1rem; }
        
        .card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 30px;
        }
        .chart-container { height: 350px; width: 100%; }
        
        table { width: 100%; border-collapse: collapse; }
        th { text-align: right; padding: 12px; color: var(--text-secondary); border-bottom: 2px solid rgba(255,255,255,0.1); }
        th:first-child { text-align: center; }
        td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        tr:hover { background-color: rgba(255,255,255,0.03); }
        
        .btn-back {
            display: inline-flex; align-items: center; gap: 8px;
            background: rgba(255,255,255,0.1); color: #fff;
            text-decoration: none; padding: 10px 20px; border-radius: 8px;
            margin-bottom: 20px; transition: 0.2s;
        }
        .btn-back:hover { background: rgba(255,255,255,0.2); }
    </style>
</head>
<body>
    <div class="container">
        <a href="#" onclick="window.close(); return false;" class="btn-back">✖ 關閉視窗</a>
        <div class="header">
            <h1>${prog.name}</h1>\n<!-- Data Source Header -->\n<div style="margin-top:8px; color: #888; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px;">\n    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> \n    Data Source: MongoDB (QwareAi / Qware_A_Ticket_data)\n</div>
            <p>2025年12月 每日流量趨勢 (總瀏覽量: ${prog.totalViews.toLocaleString()})</p>
        </div>

        <div class="card">
            <h3 style="margin-bottom: 15px; color: #60a5fa;">每日瀏覽量趨勢</h3>
            <div class="chart-container">
                <canvas id="trendChart"></canvas>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-bottom: 15px; color: #a78bfa;">每日數據明細</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 40%;">日期 (Date)</th>
                        <th style="width: 30%;">瀏覽量 (Page Views)</th>
                        <th style="width: 30%;">佔比</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>
        </div>
    </div>
    
    <script>
        const labels = ${JSON.stringify(allDays)};
        const data = ${JSON.stringify(chartData)};

        Chart.register(ChartDataLabels);
        const ctx = document.getElementById('trendChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Page Views',
                    data: data,
                    borderColor: '#a78bfa',
                    backgroundColor: 'rgba(167, 139, 250, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#a78bfa',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#f8fafc',
                        align: 'top',
                        offset: 4,
                        font: { size: 10 },
                        formatter: val => val > 0 ? val.toLocaleString() : ''
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                    x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } } }
                },
                layout: { padding: { top: 20 } }
            }
        });
    </script>
</body>
</html>`;
            fs.writeFileSync(path.join(detailsDir, detailFileName), detailHtml, 'utf8');
        });

        const rawDataArr = [];
        validPrograms.forEach(prog => {
            const attributionIdStr = prog.ids.size > 0 ? Array.from(prog.ids).join(', ') : '-';
            allDays.forEach(d => {
                const amt = prog.daily[d] || 0;
                if (amt > 0) {
                    rawDataArr.push({ name: prog.name, attr: attributionIdStr, date: d, views: amt });
                }
            });
        });

        // 產生主表 tableRows
        const tableRows = validPrograms.map((item, index) => {
            const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
            const percentage = ((item.totalViews / totalViews) * 100).toFixed(2);
            const attributionIdStr = item.ids.size > 0 ? Array.from(item.ids).join(', ') : '-';
            return '<tr>' +
                '<td style="text-align: center;"><span class="rank ' + rankClass + '">' + (index + 1) + '</span></td>' +
                `<td style="font-weight: 500;"><a href="#" onclick="window.open('${item.detailLink}', 'detail_${index}', 'width=800,height=800,scrollbars=yes'); return false;" style="color: #60a5fa; text-decoration: none; border-bottom: 1px dashed rgba(96,165,250,0.5); padding-bottom: 2px; display: inline-block;">${item.name}</a></td>` +
                '<td style="color: #bbf7d0; font-size: 0.85rem; word-break: break-all;">' + attributionIdStr + '</td>' +
                '<td style="text-align: right; color: #f8fafc; font-weight: 600;">' + item.totalViews.toLocaleString() + '</td>' +
                '<td style="text-align: right; color: var(--text-secondary);">' + percentage + '%</td>' +
                '</tr>';
        }).join('');

        console.log("Building Main HTML report...");

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DMP 12月份 節目 Page View 統計</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --card-border: rgba(255, 255, 255, 0.1);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent: #3b82f6;
            --accent-glow: rgba(59, 130, 246, 0.5);
            --glass-bg: rgba(15, 23, 42, 0.6);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.15) 0px, transparent 50%);
            background-attachment: fixed;
            color: var(--text-primary);
            min-height: 100vh;
            padding: 40px 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--card-border);
        }

        .header-left h1 {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 8px;
        }

        .header-left p {
            color: var(--text-secondary);
            font-size: 1.1rem;
        }

        .stat-card {
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            display: inline-block;
        }
        
        .stat-card h3 {
            font-size: 0.9rem;
            color: var(--text-secondary);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .stat-card .value {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--text-primary);
            text-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
        }

        .content-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }

        .card {
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .card-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .chart-container {
            height: 400px;
            width: 100%;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th {
            text-align: left;
            padding: 16px;
            color: var(--text-secondary);
            font-weight: 600;
            border-bottom: 2px solid rgba(255, 255, 255, 0.1);
            position: sticky;
            top: 0;
            background: var(--glass-bg);
            backdrop-filter: blur(8px);
        }

        td {
            padding: 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            transition: background-color 0.2s;
        }

        tbody tr:hover {
            background-color: rgba(255, 255, 255, 0.03);
        }

        .rank {
            display: inline-block;
            width: 28px;
            height: 28px;
            line-height: 28px;
            text-align: center;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            font-weight: bold;
            font-size: 0.85rem;
        }

        .rank-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #000; box-shadow: 0 0 10px rgba(245, 158, 11, 0.5); }
        .rank-2 { background: linear-gradient(135deg, #94a3b8, #64748b); color: #fff; box-shadow: 0 0 10px rgba(148, 163, 184, 0.5); }
        .rank-3 { background: linear-gradient(135deg, #b45309, #78350f); color: #fff; box-shadow: 0 0 10px rgba(180, 83, 9, 0.5); }

        .btn-home {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: #fff;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 9999px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
            transition: all 0.3s ease;
            z-index: 50;
        }

        .btn-home:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.6);
        }

        @media (max-width: 768px) {
            .header { flex-direction: column; align-items: flex-start; gap: 20px; }
            .stat-card { width: 100%; }
        }
        
        .table-wrapper {
            max-height: 600px;
            overflow-y: auto;
            border-radius: 8px;
            position: relative;
        }
        
        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }

        /* tooltip styling specific to link */
        td a:hover {
            color: #93c5fd;
        }

    </style>
</head>
<body>

    <div class="container">
        <div class="header">
            <div class="header-left">
                <h1>2025年12月 節目流量統計</h1>
                <p>First-Party DMP Page View 分析報表 (點擊名稱查看每日趨勢)</p>
            </div>
            <div style="display: flex; gap: 15px; align-items: stretch;">
                <button onclick="exportRawData()" style="cursor: pointer; background: rgba(167, 139, 250, 0.2); color: #a78bfa; border: 1px solid #a78bfa; padding: 0 20px; border-radius: 12px; font-weight: 600; font-family: 'Outfit', 'Noto Sans TC', sans-serif; transition: all 0.3s;" onmouseover="this.style.background='rgba(167, 139, 250, 0.3)'" onmouseout="this.style.background='rgba(167, 139, 250, 0.2)'">匯出 Raw Data</button>
                <div class="stat-card">
                    <h3>總瀏覽量 (Total Page Views)</h3>
                    <div class="value">${totalViews.toLocaleString()}</div>
                </div>
            </div>
        </div>

        <div class="content-grid">
            <div class="card">
                <div class="card-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                    Top 10 熱門節目
                </div>
                <div class="chart-container">
                    <canvas id="top10Chart"></canvas>
                </div>
            </div>

            <div class="card" style="padding: 0;">
                <div style="padding: 30px 30px 15px;">
                    <div class="card-title" style="margin-bottom: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                        節目場次瀏覽量排行 (點擊節目名稱可查看詳細圖表)
                    </div>
                </div>
                
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 80px; text-align: center;">排名</th>
                                <th>節目名稱 (Content Name)</th>
                                <th style="width: 15%; color: #bbf7d0;">節目ID</th>
                                <th style="text-align: right;">瀏覽量 (Page Views)</th>
                                <th style="text-align: right; width: 120px;">佔比</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <a href="report_index.html" class="btn-home">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
        回首頁
    </a>

    <script>
        const rawData = ${JSON.stringify(rawDataArr)};
        const top10Labels = ${JSON.stringify(top10.map(t => t.name))};
        const top10Data = ${JSON.stringify(top10.map(t => t.totalViews))};

        function exportRawData() {
            let csvContent = "\\uFEFF節目名稱,節目ID,日期,瀏覽量\\n";
            for (let i = 0; i < rawData.length; i++) {
                let item = rawData[i];
                let safeName = item.name.replace(/"/g, '""');
                let safeAttr = item.attr.replace(/"/g, '""');
                csvContent += '"' + safeName + '","' + safeAttr + '",' + item.date + ',' + item.views + "\\n";
            }
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', 'DMP_PageView_RawData_2025-12.csv');
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // Initialize Chart
        Chart.register(ChartDataLabels);
        const ctx = document.getElementById('top10Chart').getContext('2d');
        
        // Trim labels if they are too long
        const formattedLabels = top10Labels.map(label => label.length > 20 ? label.substring(0, 20) + '...' : label);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: formattedLabels,
                datasets: [{
                    label: 'Page Views',
                    data: top10Data,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 6,
                    hoverBackgroundColor: 'rgba(96, 165, 250, 0.9)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 14, family: 'Outfit' },
                        bodyFont: { size: 14, family: 'Outfit' },
                        padding: 12,
                        callbacks: {
                            title: function(context) { return top10Labels[context[0].dataIndex]; },
                            label: function(context) { return 'Views: ' + context.parsed.y.toLocaleString(); }
                        }
                    },
                    datalabels: {
                        color: '#f8fafc',
                        anchor: 'end',
                        align: 'top',
                        formatter: function(value) { return value.toLocaleString(); },
                        font: { weight: 'bold', size: 11 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { 
                            color: '#94a3b8',
                            font: { family: 'Noto Sans TC' },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        border: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                },
                layout: { padding: { top: 30 } }
            }
        });
    </script>
</body>
</html>
        `;

        const outPath = path.join(__dirname, 'A_DMP_PageView_Report_2025-12.html');
        fs.writeFileSync(outPath, htmlContent, 'utf8');
        console.log('Main report generated successfully at ' + outPath);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

main().catch(console.dir);
