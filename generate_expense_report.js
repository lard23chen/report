const fs = require('fs');
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('AzureMonthlyCost_Daily');

        console.log("Fetching data from AzureMonthlyCost_Daily...");
        const rawData = await collection.find({}).sort({ Date: 1 }).toArray();

        // Transform data to match the expected format in generateHTML
        const results = rawData.map(d => ({
            date: d.Date,
            sysA: parseFloat(d.ASys) || 0,
            sysD: parseFloat(d.DSysAWS) || 0,
            sysE: parseFloat(d.ESys) || 0,
            shared: parseFloat(d.Shared) || 0,
            member: parseFloat(d.Member) || 0,
            total: parseFloat(d.TotalRevenue) || 0,
            monitorLevel: d.Level || '',
            activity: d.Activity || '',
            notes: d.Note || ''
        }));

        generateHTML(results);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

function generateHTML(data) {
    // Labels and data for Chart.js
    const labels = data.map(d => d.date);
    const sysAData = data.map(d => d.sysA);
    const sysDData = data.map(d => d.sysD);
    const sysEData = data.map(d => d.sysE);
    const totalData = data.map(d => d.total);

    // Filter options for dropdown (Unique months)
    const months = [...new Set(data.map(d => d.date.substring(0, 7)))].sort();
    const filterOptions = months.map(m => `<option value="${m}">${m.replace('/', '年 ')}月</option>`).join('');

    const tableRows = data.map(d => `
        <tr data-month="${d.date.substring(0, 7)}">
            <td>${d.date}</td>
            <td style="text-align: right;">${d.sysA.toLocaleString()}</td>
            <td style="text-align: right;">${d.sysD.toLocaleString()}</td>
            <td style="text-align: right;">${d.sysE.toLocaleString()}</td>
            <td style="text-align: right;">${d.shared.toLocaleString()}</td>
            <td style="text-align: right;">${d.member.toLocaleString()}</td>
            <td style="text-align: right; color: #60a5fa; font-weight: bold;">${d.total.toLocaleString()}</td>
            <td>${(d.monitorLevel || '').replace(/\n/g, '<br>')}</td>
            <td>${(d.activity || '').replace(/\n/g, '<br>')}</td>
            <td style="font-size: 0.85em; color: #94a3b8;">${(d.notes || '').replace(/\n/g, '<br>')}</td>
        </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>跨月份 每日雲端費用分析報告 (Mongo Source)</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --card-border: rgba(255, 255, 255, 0.1);
        }
        body {
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            background: var(--bg-color);
            background-image: 
                radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.15) 0px, transparent 50%);
            background-attachment: fixed;
            color: #f8fafc;
            padding: 40px 20px;
            margin: 0;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { margin-bottom: 30px; border-bottom: 1px solid var(--card-border); padding-bottom: 20px; }
        .header h1 { font-size: 2.2rem; color: #60a5fa; margin-bottom: 10px; font-weight: 700; }
        .header p { color: #94a3b8; font-size: 1.1rem; }
        .card { background: var(--card-bg); border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid var(--card-border); backdrop-filter: blur(10px); }
        .chart-container { height: 400px; width: 100%; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { text-align: center; padding: 12px; color: #cbd5e1; border-bottom: 2px solid rgba(255,255,255,0.1); background: rgba(15, 23, 42, 0.6); position: sticky; top: 0; backdrop-filter: blur(8px); }
        td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: top; }
        tr:hover { background-color: rgba(255,255,255,0.03); }
        
        .table-wrapper { max-height: 800px; overflow-y: auto; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
        
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }

        .btn-home {
            position: fixed; bottom: 30px; right: 30px;
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 9999px;
            font-weight: 600; display: inline-flex; align-items: center; gap: 8px;
            box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4); z-index: 50;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>每日雲端費用分析報告</h1>
            <div style="margin-top:8px; color: #888; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px;">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> 
                Data Source: MongoDB (AzureMonthlyCost_Daily)
            </div>
            <p>包含 A系統、D系統、E系統、共用與會員機器的每日費用及活動明細</p>
        </div>

        <div class="card">
            <h3 style="margin-top:0; color: #a78bfa;">總計與各系統費用趨勢</h3>
            <div class="chart-container">
                <canvas id="expenseChart"></canvas>
            </div>
        </div>

        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #34d399;">每日費用明細</h3>
                <select id="monthFilter" style="background: rgba(15, 23, 42, 0.8); color: #cbd5e1; border: 1px solid var(--card-border); padding: 8px 16px; border-radius: 6px; font-family: 'Outfit'; font-size: 1rem; outline: none; cursor: pointer;">
                    <option value="all">所有月份 (All Months)</option>
                    ${filterOptions}
                </select>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="min-width: 100px;">日期 (年/月)</th>
                            <th style="min-width: 80px;">A系統</th>
                            <th style="min-width: 80px;">D系統(AWS)</th>
                            <th style="min-width: 80px;">E系統</th>
                            <th style="min-width: 80px;">共用</th>
                            <th style="min-width: 80px;">會員</th>
                            <th style="min-width: 90px; color: #60a5fa;">總計[未稅]</th>
                            <th style="min-width: 150px;">機器監控等級</th>
                            <th style="min-width: 250px;">活動名稱</th>
                            <th style="min-width: 300px;">備註說明</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    
    <a href="report_index.html" class="btn-home">回首頁</a>

    <script>
        const ctx = document.getElementById('expenseChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [
                    {
                        label: '總計',
                        data: ${JSON.stringify(totalData)},
                        borderColor: '#60a5fa',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        borderWidth: 3,
                        pointRadius: 2,
                        fill: true,
                        tension: 0.2
                    },
                    {
                        label: 'A系統',
                        data: ${JSON.stringify(sysAData)},
                        borderColor: '#a78bfa',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 1,
                        tension: 0.2
                    },
                    {
                        label: 'D系統(AWS)',
                        data: ${JSON.stringify(sysDData)},
                        borderColor: '#f472b6',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 1,
                        tension: 0.2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#e2e8f0' } },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => context.dataset.label + ': $' + context.parsed.y.toLocaleString()
                        }
                    }
                },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 15 } }
                }
            }
        });

        document.getElementById('monthFilter').addEventListener('change', function() {
            const selectedMonth = this.value;
            const rows = document.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const month = row.getAttribute('data-month');
                if (selectedMonth === 'all' || month === selectedMonth) row.style.display = '';
                else row.style.display = 'none';
            });
        });
    </script>
</body>
</html>`;

    fs.writeFileSync('daily_expense_report.html', html, 'utf8');
    console.log('Report generated: daily_expense_report.html');
}

run();
