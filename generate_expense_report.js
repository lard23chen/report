const fs = require('fs');
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('AzureMonthlyCost_Daily');
        console.log("Fetching latest data from MongoDB...");
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
    const jsonData = JSON.stringify(data);

    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <title>每日雲端費用明細與分析報告</title>
    <!-- Chart.js and DataLabels Plugin -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&family=Noto+Sans+TC:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg-color: #0f172a; --card-bg: rgba(30, 41, 59, 0.7); --card-border: rgba(255, 255, 255, 0.1); }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background: var(--bg-color); color: #f8fafc; padding: 40px 20px; margin: 0; }
        .container { max-width: 1550px; margin: 0 auto; }
        .header { margin-bottom: 25px; border-bottom: 2px solid var(--card-border); padding-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header h1 { font-size: 2.3rem; color: #60a5fa; margin: 0; font-weight: 800; }
        .card { background: var(--card-bg); border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid var(--card-border); backdrop-filter: blur(10px); }
        .chart-container { height: 500px; width: 100%; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 12px; color: #cbd5e1; border-bottom: 2px solid rgba(255,255,255,0.1); background: rgba(15, 23, 42, 0.9); position: sticky; top: 0; z-index: 10; font-size: 0.95rem; }
        td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: top; font-size: 0.9rem; }
        tr:hover { background-color: rgba(255,255,255,0.03); }
        .table-wrapper { max-height: 550px; overflow-y: auto; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .select-month { background: #1e293b; color: #60a5fa; border: 2px solid #3b82f6; padding: 10px 25px; border-radius: 999px; cursor: pointer; font-size: 1.1rem; font-weight: 700; outline: none; }
        .btn-home { position: fixed; bottom: 30px; right: 30px; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: bold; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); z-index: 50; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div><h1>每日雲端報表與費用分析</h1><div style="color: #94a3b8; margin-top: 5px;">Source: MongoDB (AzureMonthlyCost_Daily) • 全域連動面板</div></div>
            <select id="monthFilter" class="select-month"><option value="all">所有月份 (All History)</option>${filterOptions}</select>
        </div>
        <div class="card">
            <h3 style="color: #34d399; margin: 0 0 15px 0; font-size: 1.25rem;">📊 每日經費明細與活動細目</h3>
            <div class="table-wrapper">
                <table id="expenseTable">
                    <thead><tr><th style="min-width:110px">日期</th><th style="text-align:right">A系統</th><th style="text-align:right">D(AWS)</th><th style="text-align:right">E系統</th><th style="text-align:right">共用</th><th style="text-align:right">會員</th><th style="text-align:right;color:#60a5fa">總計[未稅]</th><th>主要活動與備註</th></tr></thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
        </div>
        <div class="card">
            <h3 style="color: #a78bfa; margin: 0 0 20px 0; font-size: 1.25rem;">📈 全系統費用走勢趨勢圖</h3>
            <div class="chart-container"><canvas id="expenseChart"></canvas></div>
        </div>
    </div>
    <a href="report_index.html" class="btn-home">回首頁</a>
    <script>
        const rawData = ${jsonData};
        let expenseChart;
        Chart.register(ChartDataLabels);

        function renderTable(dat) {
            document.getElementById('tableBody').innerHTML = dat.map(d => "<tr>" +
                "<td style='font-weight:600'>" + d.date + "</td>" +
                "<td style='text-align:right'>" + d.sysA.toLocaleString() + "</td>" +
                "<td style='text-align:right'>" + d.sysD.toLocaleString() + "</td>" +
                "<td style='text-align:right'>" + d.sysE.toLocaleString() + "</td>" +
                "<td style='text-align:right'>" + d.shared.toLocaleString() + "</td>" +
                "<td style='text-align:right'>" + d.member.toLocaleString() + "</td>" +
                "<td style='text-align:right;color:#60a5fa;font-weight:700'>" + d.total.toLocaleString() + "</td>" +
                "<td style='font-size:0.85em;color:#94a3b8'><strong style='color:#34d399'>" + (d.activity || '') + "</strong><br>" + (d.notes || '') + "</td>" +
                "</tr>"
            ).join('');
        }

        function renderChart(dat) {
            const ctx = document.getElementById('expenseChart').getContext('2d');
            if (expenseChart) expenseChart.destroy();
            
            const showLabels = dat.length <= 31; // Only show data labels if viewing one month

            expenseChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dat.map(d => d.date.substring(5)), // Show MM/DD to save space
                    datasets: [
                        { label: '總計', data: dat.map(d=>d.total), borderColor: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.1)', fill: true, tension: 0.3, borderWidth: 4, pointRadius: 4 },
                        { label: 'A系統', data: dat.map(d=>d.sysA), borderColor: '#a78bfa', fill: false, tension: 0.3, pointRadius: 2 },
                        { label: 'D系統', data: dat.map(d=>d.sysD), borderColor: '#f472b6', fill: false, tension: 0.3, pointRadius: 2 },
                        { label: 'E系統', data: dat.map(d=>d.sysE), borderColor: '#fbbf24', fill: false, tension: 0.3, pointRadius: 2 },
                        { label: '共用', data: dat.map(d=>d.shared), borderColor: '#10b981', fill: false, tension: 0.3, pointRadius: 2 },
                        { label: '會員', data: dat.map(d=>d.member), borderColor: '#94a3b8', fill: false, tension: 0.3, pointRadius: 2 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { color: '#e2e8f0', font: { family: 'Outfit', size: 14 } } },
                        tooltip: { mode: 'index', intersect: false },
                        datalabels: {
                            display: showLabels,
                            align: 'top',
                            color: '#fff',
                            font: { weight: 'bold', size: 10 },
                            offset: 5,
                            formatter: (v) => v > 0 ? v.toLocaleString() : ''
                        }
                    },
                    scales: {
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                        x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 15 } }
                    }
                }
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
}

run();
