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
    const months = [...new Set(data.map(d => d.date.substring(0, 7)))].sort();
    const filterOptions = months.reverse().map(m => `<option value="${m}">${m.replace('/', '年 ')}月</option>`).join('');

    // Pre-serialize the data to prevent issues with nested template literals
    const jsonData = JSON.stringify(data);

    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <title>每日雲端費用明細與分析報告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&family=Noto+Sans+TC:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg-color: #0f172a; --card-bg: rgba(30, 41, 59, 0.7); --card-border: rgba(255, 255, 255, 0.1); }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background: var(--bg-color); color: #f8fafc; padding: 40px 20px; margin: 0; }
        .container { max-width: 1450px; margin: 0 auto; }
        .header { margin-bottom: 25px; border-bottom: 1px solid var(--card-border); padding-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header h1 { font-size: 2.2rem; color: #60a5fa; margin: 0; }
        .card { background: var(--card-bg); border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid var(--card-border); backdrop-filter: blur(10px); }
        .chart-container { height: 400px; width: 100%; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { text-align: center; padding: 12px; color: #cbd5e1; border-bottom: 2px solid rgba(255,255,255,0.1); background: rgba(15, 23, 42, 0.85); position: sticky; top: 0; backdrop-filter: blur(8px); z-index: 10; font-size: 0.95rem; }
        td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: top; font-size: 0.9rem; }
        tr:hover { background-color: rgba(255,255,255,0.03); }
        .table-wrapper { max-height: 550px; overflow-y: auto; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .select-month { background: #1e293b; color: #60a5fa; border: 1px solid #3b82f6; padding: 10px 20px; border-radius: 999px; cursor: pointer; font-family: 'Outfit'; font-weight: 600; }
        .btn-home { position: fixed; bottom: 30px; right: 30px; background: rgba(30, 41, 59, 0.8); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 9999px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div><h1>每日雲端報表與費用分析</h1><div style="color: #64748b; font-size: 0.9rem;">Source: MongoDB (AzureMonthlyCost_Daily)</div></div>
            <select id="monthFilter" class="select-month"><option value="all">所有月份 (All Time)</option>${filterOptions}</select>
        </div>
        <div class="card">
            <h3 style="color: #34d399; margin:0 0 15px 0;">每日明細與活動細節</h3>
            <div class="table-wrapper">
                <table id="expenseTable">
                    <thead><tr><th>日期</th><th style="text-align:right">A系統</th><th style="text-align:right">D(AWS)</th><th style="text-align:right">E系統</th><th style="text-align:right">共用</th><th style="text-align:right">會員</th><th style="text-align:right">總計</th><th>主要活動與備註</th></tr></thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
        </div>
        <div class="card">
            <h3 style="color: #a78bfa; margin:0 0 20px 0;">費用趨勢分析圖</h3>
            <div class="chart-container"><canvas id="expenseChart"></canvas></div>
        </div>
    </div>
    <a href="report_index.html" class="btn-home">回首頁</a>
    <script>
        const rawData = ${jsonData};
        let expenseChart;
        function renderTable(dat) {
            document.getElementById('tableBody').innerHTML = dat.map(d => "<tr>" +
                "<td>" + d.date + "</td>" +
                "<td style='text-align:right'>" + d.sysA.toLocaleString() + "</td>" +
                "<td style='text-align:right'>" + d.sysD.toLocaleString() + "</td>" +
                "<td style='text-align:right'>" + d.sysE.toLocaleString() + "</td>" +
                "<td style='text-align:right'>" + d.shared.toLocaleString() + "</td>" +
                "<td style='text-align:right'>" + d.member.toLocaleString() + "</td>" +
                "<td style='text-align:right;color:#60a5fa;font-weight:700'>" + d.total.toLocaleString() + "</td>" +
                "<td style='font-size:0.8em;color:#94a3b8'>" + (d.activity || '') + "<br>" + (d.notes || '') + "</td>" +
                "</tr>"
            ).join('');
        }
        function renderChart(dat) {
            const ctx = document.getElementById('expenseChart').getContext('2d');
            if (expenseChart) expenseChart.destroy();
            expenseChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dat.map(d => d.date),
                    datasets: [
                        { label: '總計', data: dat.map(d=>d.total), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3 },
                        { label: 'A系統', data: dat.map(d=>d.sysA), borderColor: '#8b5cf6', fill: false, tension: 0.3 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e2e8f0' } } } }
            });
        }
        document.getElementById('monthFilter').addEventListener('change', e => {
            const v = e.target.value;
            const f = v === 'all' ? rawData : rawData.filter(d => d.date.startsWith(v));
            renderTable(f); renderChart(f);
        });
        renderTable(rawData); renderChart(rawData);
    </script>
</body>
</html>
    `;

    fs.writeFileSync('daily_expense_report.html', htmlContent, 'utf8');
    console.log('Report updated: daily_expense_report.html');
}

run();
