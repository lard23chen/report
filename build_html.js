const fs = require('fs');

function generateHTML() {
  const data = JSON.parse(fs.readFileSync('all_data.json', 'utf8'));
  // sort data by date just in case
  data.sort((a, b) => a.date.localeCompare(b.date));

  const labels = data.map(d => d.date);
  const sysAData = data.map(d => d.sysA);
  const sysDData = data.map(d => d.sysD);
  const sysEData = data.map(d => d.sysE);
  const sharedData = data.map(d => d.shared);
  const memberData = data.map(d => d.member);
  const totalData = data.map(d => d.total);

  const tableRows = data.map(d => `
    <tr data-month="${d.date.substring(0, 7)}">
      <td>${d.date}</td>
      <td style="text-align: right;">${d.sysA.toLocaleString()}</td>
      <td style="text-align: right;">${d.sysD.toLocaleString()}</td>
      <td style="text-align: right;">${d.sysE.toLocaleString()}</td>
      <td style="text-align: right;">${d.shared.toLocaleString()}</td>
      <td style="text-align: right;">${d.member.toLocaleString()}</td>
      <td style="text-align: right; color: #60a5fa; font-weight: bold;">${d.total.toLocaleString()}</td>
      <td>${d.monitorLevel.replace(/\n/g, '<br>')}</td>
      <td>${d.activity.replace(/\n/g, '<br>')}</td>
      <td style="font-size: 0.85em; color: #94a3b8;">${d.notes.replace(/\n/g, '<br>')}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>2025年11月至2026年1月 每日費用分析報告</title>
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
        
        /* Custom Scrollbar */
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
        .btn-home:hover { opacity: 0.9; transform: translateY(-3px); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header" style="display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <h1>2025年11月 -  2026年1月 每日費用分析報告</h1>
                <p style="margin-bottom: 0;">包含 A系統、D系統、E系統、共用與會員機器的每日費用及活動明細</p>
            </div>
            <select id="monthFilter" style="background: rgba(15, 23, 42, 0.8); color: #cbd5e1; border: 1px solid var(--card-border); padding: 8px 16px; border-radius: 6px; font-family: 'Outfit'; font-size: 1rem; outline: none; cursor: pointer; margin-bottom: 5px;">
                <option value="all">所有月份 (All Months)</option>
                <option value="2025/11">2025年 11月</option>
                <option value="2025/12">2025年 12月</option>
                <option value="2026/01">2026年 01月</option>
            </select>
        </div>

        <div class="card">
            <h3 style="margin-top:0; color: #a78bfa;">總計與各系統費用趨勢</h3>
            <div class="chart-container">
                <canvas id="expenseChart"></canvas>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-top:0; color: #34d399; margin-bottom: 15px;">每日費用明細</h3>
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
    
    <a href="report_index.html" class="btn-home">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
        回首頁
    </a>

    <script>
        const originalLabels = ${JSON.stringify(labels)};
        const originalData = {
            total: ${JSON.stringify(totalData)},
            sysA: ${JSON.stringify(sysAData)},
            sysD: ${JSON.stringify(sysDData)},
            sysE: ${JSON.stringify(sysEData)},
            shared: ${JSON.stringify(sharedData)},
            member: ${JSON.stringify(memberData)},
            monitor: ${JSON.stringify(data.map(d => d.monitorLevel))},
            activity: ${JSON.stringify(data.map(d => d.activity))}
        };

        const ctx = document.getElementById('expenseChart').getContext('2d');
        const expenseChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: originalLabels,
                datasets: [
                    { label: '總計', data: originalData.total, borderColor: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.1)', borderWidth: 3, pointRadius: 2, fill: true, tension: 0.2 },
                    { label: 'A系統', data: originalData.sysA, borderColor: '#a78bfa', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 1, tension: 0.2 },
                    { label: 'D系統(AWS)', data: originalData.sysD, borderColor: '#f472b6', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 1, tension: 0.2 },
                    { label: 'E系統', data: originalData.sysE, borderColor: '#fbbf24', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 1, tension: 0.2 },
                    { label: '共用', data: originalData.shared, borderColor: '#2dd4bf', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 1, tension: 0.2 },
                    { label: '會員', data: originalData.member, borderColor: '#fb923c', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 1, tension: 0.2 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0', font: { family: 'Noto Sans TC' } }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 14 },
                        bodyFont: { size: 14 },
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(context.parsed.y);
                                }
                                return label;
                            },
                            afterBody: function(context) {
                                if (context.length > 0) {
                                    const dateLabel = context[0].label;
                                    const index = originalLabels.indexOf(dateLabel);
                                    if (index !== -1) {
                                        const monitor = originalData.monitor[index];
                                        const acts = originalData.activity[index];
                                        let extra = [];
                                        if (monitor || acts) extra.push('');
                                        if (monitor) extra.push('機器級別: ' + monitor.replace(/\\n/g, ' '));
                                        if (acts) {
                                            extra.push('活動名稱:');
                                            acts.split('\\n').forEach(l => {
                                                if(l.trim()) extra.push('- ' + l.trim());
                                            });
                                        }
                                        return extra;
                                    }
                                }
                                return [];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', maxTicksLimit: 15 }
                    }
                }
            }
        });

        document.getElementById('monthFilter').addEventListener('change', function() {
            const selectedMonth = this.value;
            
            // Filter Table
            const rows = document.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const month = row.getAttribute('data-month');
                if (selectedMonth === 'all' || month === selectedMonth) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });

            // Filter Chart
            let filteredLabels = [];
            let filteredData = { total: [], sysA: [], sysD: [], sysE: [], shared: [], member: [] };
            
            for(let i = 0; i < originalLabels.length; i++) {
                const month = originalLabels[i].substring(0, 7);
                if (selectedMonth === 'all' || month === selectedMonth) {
                    filteredLabels.push(originalLabels[i]);
                    filteredData.total.push(originalData.total[i]);
                    filteredData.sysA.push(originalData.sysA[i]);
                    filteredData.sysD.push(originalData.sysD[i]);
                    filteredData.sysE.push(originalData.sysE[i]);
                    filteredData.shared.push(originalData.shared[i]);
                    filteredData.member.push(originalData.member[i]);
                }
            }
            
            expenseChart.data.labels = filteredLabels;
            expenseChart.data.datasets[0].data = filteredData.total;
            expenseChart.data.datasets[1].data = filteredData.sysA;
            expenseChart.data.datasets[2].data = filteredData.sysD;
            expenseChart.data.datasets[3].data = filteredData.sysE;
            expenseChart.data.datasets[4].data = filteredData.shared;
            expenseChart.data.datasets[5].data = filteredData.member;
            expenseChart.update();
        });
    </script>
</body>
</html>`;

  fs.writeFileSync('daily_expense_report.html', html, 'utf8');
}

generateHTML();
