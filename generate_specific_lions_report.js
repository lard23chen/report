
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function main() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");

        const activityID = 39455;
        const activityName = "中華職棒37年例行賽統一獅主場（上）";
        const qStart = new Date("2026-03-09T18:00:00+08:00");
        const qEnd = new Date("2026-03-09T23:59:59+08:00");

        console.log(`Fetching data for ${activityName} (ID: ${activityID})...`);
        
        let evSessions = await db.collection("QwareTrafficSession")
            .find({ ActivityID: activityID, CreateTime: { $gte: qStart, $lte: qEnd } })
            .sort({ CreateTime: 1 })
            .toArray();

        let evReads = await db.collection("QwareTrafficGAReadTime")
            .find({ ActivityID: activityID, CreateTime: { $gte: qStart, $lte: qEnd } })
            .sort({ CreateTime: 1 })
            .toArray();

        console.log(`Processing ${evSessions.length} session records and ${evReads.length} read records...`);

        function formatDateStr(val) {
            if (!val) return '';
            const dt = new Date(val);
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            const h = String(dt.getHours()).padStart(2, '0');
            const min = String(dt.getMinutes()).padStart(2, '0');
            return y + '-' + m + '-' + d + ' ' + h + ':' + min;
        }

        let timeMap = new Map();

        evSessions.forEach(s => {
            let timeKey = formatDateStr(s.CreateTime);
            if (!timeMap.has(timeKey)) {
                timeMap.set(timeKey, { time: timeKey, session: s.SessionCount, activeD: 0, activeA: 0, activeDMin: 0, activeAMin: 0 });
            } else {
                timeMap.get(timeKey).session = Math.max(timeMap.get(timeKey).session, s.SessionCount);
            }
        });

        evReads.forEach(r => {
            let timeKey = formatDateStr(r.CreateTime);
            let dCount = (r.ActiveUsersDCount === 'NULL' || !r.ActiveUsersDCount ? 0 : Number(r.ActiveUsersDCount));
            let aCount = (r.ActiveUsersACount === 'NULL' || !r.ActiveUsersACount ? 0 : Number(r.ActiveUsersACount));
            let dMinCount = (r.ActiveUsersDMinCount === 'NULL' || !r.ActiveUsersDMinCount ? 0 : Number(r.ActiveUsersDMinCount));
            let aMinCount = (r.ActiveUsersAMinCount === 'NULL' || !r.ActiveUsersAMinCount ? 0 : Number(r.ActiveUsersAMinCount));

            if (!timeMap.has(timeKey)) {
                timeMap.set(timeKey, { time: timeKey, session: 0, activeD: dCount, activeA: aCount, activeDMin: dMinCount, activeAMin: aMinCount });
            } else {
                let d = timeMap.get(timeKey);
                d.activeD = Math.max(d.activeD, dCount);
                d.activeA = Math.max(d.activeA, aCount);
                d.activeDMin = Math.max(d.activeDMin, dMinCount);
                d.activeAMin = Math.max(d.activeAMin, aMinCount);
            }
        });

        let dailyData = Array.from(timeMap.values()).sort((a, b) => a.time.localeCompare(b.time));

        let maxSession = 0;
        let maxSessionTime = '';
        dailyData.forEach(item => {
            if (item.session > maxSession) {
                maxSession = item.session;
                maxSessionTime = item.time;
            }
        });

        const reportData = {
            name: activityName,
            activityId: activityID,
            maxSession: maxSession,
            maxSessionTime: maxSessionTime,
            data: dailyData,
            period: "2026/03/09 18:00 ~ 23:59"
        };

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>${activityName} - 流量深分析</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-primary: #f8fafc;
            --accent-color: #3b82f6;
        }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background: var(--bg-color); color: var(--text-primary); padding: 40px; }
        .header { margin-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px; }
        .header h1 { margin: 0; background: linear-gradient(to right, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .card { background: var(--card-bg); padding: 25px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); }
        .card .lab { font-size: 0.9rem; color: #94a3b8; margin-bottom: 10px; }
        .card .val { font-size: 2rem; font-weight: 700; color: var(--accent-color); }
        .chart-container { background: var(--card-bg); padding: 30px; border-radius: 20px; height: 500px; margin-bottom: 40px; }
        table { width: 100%; border-collapse: collapse; background: var(--card-bg); border-radius: 12px; overflow: hidden; }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }
        th { background: rgba(255,255,255,0.05); color: #94a3b8; }
        tr:hover { background: rgba(255,255,255,0.02); }
    </style>
</head>
<body>
    <div class="header">
        <h1>流量深度分析報告</h1>
        <p style="color: #94a3b8;">${activityName} | 分析時段: ${reportData.period}</p>
    </div>

    <div class="summary">
        <div class="card">
            <div class="lab">最高連線數 (Peak Sessions)</div>
            <div class="val">${reportData.maxSession.toLocaleString()}</div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 5px;">Peak Time: ${reportData.maxSessionTime}</div>
        </div>
        <div class="card">
            <div class="lab">數據點總數 (Data Points)</div>
            <div class="val">${reportData.data.length}</div>
        </div>
    </div>

    <div class="chart-container">
        <canvas id="mainChart"></canvas>
    </div>

    <table>
        <thead>
            <tr>
                <th>時間</th>
                <th>連線數 (Sessions)</th>
                <th>Active D (排隊)</th>
                <th>Active A (搶票)</th>
            </tr>
        </thead>
        <tbody>
            ${reportData.data.map(d => `
                <tr>
                    <td>${d.time}</td>
                    <td style="color: #60a5fa; font-weight: bold;">${d.session.toLocaleString()}</td>
                    <td>${d.activeDMin.toLocaleString()}</td>
                    <td>${d.activeAMin.toLocaleString()}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <script>
        const ctx = document.getElementById('mainChart').getContext('2d');
        const labels = ${JSON.stringify(reportData.data.map(d => d.time.slice(11)))};
        const sessions = ${JSON.stringify(reportData.data.map(d => d.session))};
        const activeD = ${JSON.stringify(reportData.data.map(d => d.activeDMin))};
        const activeA = ${JSON.stringify(reportData.data.map(d => d.activeAMin))};

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Sessions',
                        data: sessions,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Active D (排隊)',
                        data: activeD,
                        borderColor: '#f59e0b',
                        tension: 0.3
                    },
                    {
                        label: 'Active A (搶票)',
                        data: activeA,
                        borderColor: '#10b981',
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                },
                plugins: {
                    legend: { labels: { color: '#f8fafc' } }
                }
            }
        });
    </script>
</body>
</html>
        `;

        const outPath = path.join(__dirname, 'A_UniformLions_GA_Analysis_20260309.html');
        fs.writeFileSync(outPath, htmlContent, 'utf8');
        console.log('Report generated at ' + outPath);

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}
main();
