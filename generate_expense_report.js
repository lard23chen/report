require('dotenv').config({ path: __dirname + '/.env', quiet: true });
﻿const fs = require('fs');
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('AzureMonthlyCost_Daily');
        console.log("Updating report with activity data in chart tooltips...");
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
        .select-month { background: #1e293b; color: #34d399; border: 2px solid #34d399; padding: 10px 25px; border-radius: 999px; cursor: pointer; font-size: 1.1rem; font-weight: 700; outline: none; }
        .btn-home { position: fixed; bottom: 30px; right: 30px; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: bold; z-index: 50; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div><h1>每日雲端報表與費用分析</h1><div style="color: #94a3b8; margin-top: 5px;">Source: MongoDB (AzureMonthlyCost_Daily) • 圖表已整合活動名稱</div></div>
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
            <h3 style="color: #a78bfa; margin: 0 0 20px 0; font-size: 1.25rem;">📈 全系統費用走勢趨勢圖 (滑鼠移至總計點查看活動)</h3>
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
            
            const showLabels = dat.length <= 31;

            expenseChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dat.map(d => d.date.substring(5)),
                    datasets: [
                        { label: '總計', data: dat.map(d=>d.total), borderColor: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.1)', fill: true, tension: 0.3, borderWidth: 4, pointRadius: 5,
                          datalabels: {
                            display: (ctx) => showLabels,
                            align: 'top',
                            anchor: 'end',
                            offset: 4,
                            color: '#60a5fa',
                            backgroundColor: 'rgba(15, 23, 42, 0.85)',
                            borderRadius: 4,
                            padding: { top: 3, bottom: 3, left: 6, right: 6 },
                            font: { size: 10, weight: 'bold' },
                            formatter: (v) => '$' + Math.round(v).toLocaleString()
                          } },
                        { label: 'A系統', data: dat.map(d=>d.sysA), borderColor: '#a78bfa', fill: false, tension: 0.3,
                          pointRadius: dat.map(d => d.activity ? 6 : 2),
                          pointBackgroundColor: dat.map(d => d.activity ? '#a78bfa' : 'transparent'),
                          datalabels: {
                            display: (ctx) => showLabels && !!dat[ctx.dataIndex].activity,
                            align: 'top',
                            anchor: 'end',
                            offset: 6,
                            color: '#e2e8f0',
                            backgroundColor: 'rgba(30, 41, 59, 0.85)',
                            borderRadius: 4,
                            padding: { top: 4, bottom: 4, left: 6, right: 6 },
                            font: { size: 10, weight: 'bold' },
                            formatter: (v, ctx) => {
                                const act = dat[ctx.dataIndex].activity || '';
                                const lines = act.split('\\n');
                                return lines.map(l => l.length > 18 ? l.substring(0, 18) + '…' : l).join('\\n');
                            }
                          }
                        },
                        { label: 'D系統', data: dat.map(d=>d.sysD), borderColor: '#f472b6', fill: false, tension: 0.3,
                          pointRadius: showLabels ? 4 : 2,
                          datalabels: {
                            display: (ctx) => showLabels,
                            align: 'bottom',
                            anchor: 'center',
                            offset: 6,
                            color: '#f472b6',
                            backgroundColor: 'rgba(15, 23, 42, 0.85)',
                            borderRadius: 4,
                            padding: { top: 2, bottom: 2, left: 5, right: 5 },
                            font: { size: 9, weight: 'bold' },
                            formatter: (v) => '$' + Math.round(v).toLocaleString()
                          }
                        },
                        { label: 'E系統', data: dat.map(d=>d.sysE), borderColor: '#fbbf24', fill: false, tension: 0.3, pointRadius: 2, datalabels: { display: false } },
                        { label: '共用', data: dat.map(d=>d.shared), borderColor: '#10b981', fill: false, tension: 0.3, pointRadius: 2, datalabels: { display: false } },
                        { label: '會員', data: dat.map(d=>d.member), borderColor: '#94a3b8', fill: false, tension: 0.3, pointRadius: 2, datalabels: { display: false } }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { color: '#e2e8f0', font: { family: 'Outfit', size: 13 } } },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            padding: 15,
                            titleFont: { size: 14 },
                            bodyFont: { size: 14 },
                            callbacks: {
                                label: (c) => {
                                    let label = c.dataset.label + ': $' + c.parsed.y.toLocaleString();
                                    return label;
                                },
                                afterBody: (items) => {
                                    // Get original index of the hovered point
                                    const idx = items[0].dataIndex;
                                    const actualData = dat[idx];
                                    if (actualData && actualData.activity) {
                                        return '\\n活動: ' + actualData.activity.substring(0, 50) + '...';
                                    }
                                    return '';
                                }
                            }
                        },
                        datalabels: { display: false }
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
