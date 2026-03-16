const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_A_Traffic_session_data');

        console.log("Fetching and processing all traffic data...");
        const rawData = await collection.find({}).toArray();

        // Grouping
        const projects = {};
        rawData.forEach(item => {
            const name = item['節目名稱'] || '未命名項目';
            if (!projects[name]) {
                projects[name] = {
                    name: name,
                    daily: {},
                    totalViews: 0
                };
            }
            const dateStr = item['瀏覽日期'] ? new Date(item['瀏覽日期']).toISOString().split('T')[0] : '未知日期';
            projects[name].daily[dateStr] = (projects[name].daily[dateStr] || 0) + (parseInt(item['瀏覽量']) || 0);
            projects[name].totalViews += (parseInt(item['瀏覽量']) || 0);
        });

        const sortedProjects = Object.values(projects).sort((a, b) => b.totalViews - a.totalViews);

        sortedProjects.forEach(p => {
            p.chartLabels = Object.keys(p.daily).sort((a,b) => new Date(a) - new Date(b)); 
            p.chartData = p.chartLabels.map(l => p.daily[l]);
            p.minDate = p.chartLabels[0];
            p.maxDate = p.chartLabels[p.chartLabels.length - 1];
            p.entryCount = p.chartLabels.length;
        });

        const reportTime = new Date().toLocaleString('zh-TW');

        const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DMP 流量項目流線分析 - Qware_A_Traffic_session_data</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
    <style>
        :root {
            --bg-color: #0b1f31;
            --card-bg: #162638;
            --accent: #00d2ff;
            --accent-glow: rgba(0, 210, 255, 0.4);
            --text: #f1f5f9;
            --text-muted: #94a3b8;
            --gradient: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%);
        }
        body {
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            background-color: var(--bg-color);
            color: var(--text);
            margin: 0;
            padding: 40px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        header {
            text-align: center;
            margin-bottom: 50px;
            padding-bottom: 30px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        h1 {
            font-size: 3rem;
            background: var(--gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 15px;
            font-weight: 800;
        }
        .meta { color: var(--text-muted); font-size: 1rem; }
        
        .project-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 30px;
        }

        .project-card {
            background: var(--card-bg);
            border-radius: 24px;
            display: grid;
            grid-template-columns: 320px 1fr;
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.08);
            overflow: hidden;
            position: relative;
        }

        .info-panel {
            padding: 40px;
            background: rgba(0,0,0,0.15);
            border-right: 1px solid rgba(255,255,255,0.05);
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .chart-panel {
            padding: 40px 40px 20px 20px;
        }

        .project-name { 
            font-size: 1.5rem; 
            font-weight: 800; 
            margin-bottom: 15px; 
            line-height: 1.2;
            color: #fff;
        }
        
        .stat-value {
            font-size: 2.5rem;
            font-weight: 800;
            color: var(--accent);
            text-shadow: 0 0 20px var(--accent-glow);
        }

        .badge {
            display: inline-block;
            background: rgba(0, 210, 255, 0.1);
            color: var(--accent);
            padding: 4px 12px;
            border-radius: 8px;
            font-size: 0.7rem;
            font-weight: 700;
            margin-bottom: 15px;
            border: 1px solid rgba(0, 210, 255, 0.2);
        }

        .date-info {
            margin-top: 20px;
            font-size: 0.8rem;
            color: var(--text-muted);
        }
        
        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }
        .chart-title {
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>DMP 流量流線分析</h1>
            <div class="meta">資料來源：QwareAi.Qware_A_Traffic_session_data | ${reportTime}</div>
        </header>

        <div class="project-grid">
            ${sortedProjects.map((p, i) => `
            <div class="project-card">
                <div class="info-panel">
                    <span class="badge">ANALYTICS ${i+1}</span>
                    <div class="project-name">${p.name}</div>
                    
                    <div style="margin-top: 30px;">
                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Total Page Views</div>
                        <div class="stat-value">${p.totalViews.toLocaleString()}</div>
                    </div>

                    <div class="date-info">
                        🕒 數據區間：${p.entryCount} 天<br>
                        📅 ${p.minDate} &rarr; ${p.maxDate}
                    </div>
                </div>
                <div class="chart-panel">
                    <div class="chart-header">
                        <div class="chart-title">流量趨勢端點數值 <span style="font-size: 0.75rem; color: #3a7bd5; margin-left:10px;">(Daily Labels Enabled)</span></div>
                    </div>
                    <div style="height: 350px;">
                        <canvas id="chart-${i}"></canvas>
                    </div>
                </div>
            </div>
            `).join('')}
        </div>
    </div>

    <script>
        const projectData = ${JSON.stringify(sortedProjects)};
        
        // 註冊 DataLabels 插件
        Chart.register(ChartDataLabels);

        window.onload = function() {
            projectData.forEach((p, i) => {
                const ctx = document.getElementById('chart-' + i).getContext('2d');
                
                const gradient = ctx.createLinearGradient(0, 0, 0, 350);
                gradient.addColorStop(0, 'rgba(0, 210, 255, 0.3)');
                gradient.addColorStop(1, 'rgba(0, 210, 255, 0)');

                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: p.chartLabels,
                        datasets: [{
                            label: '瀏覽量',
                            data: p.chartData,
                            borderColor: '#00d2ff',
                            borderWidth: 3,
                            pointBackgroundColor: '#00d2ff',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 7,
                            tension: 0.4,
                            fill: true,
                            backgroundColor: gradient
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: {
                            padding: {
                                top: 30 // 為上端數字留空間
                            }
                        },
                        plugins: {
                            legend: { display: false },
                            datalabels: {
                                align: 'top',
                                anchor: 'end',
                                offset: 8,
                                color: '#00d2ff',
                                font: {
                                    family: 'Outfit',
                                    size: 11,
                                    weight: 'bold'
                                },
                                formatter: function(value) {
                                    return value > 0 ? value.toLocaleString() : '';
                                },
                                // 避免太擠，如果數據點太多可以考慮 skip
                                display: function(context) {
                                    return true; 
                                }
                            },
                            tooltip: {
                                backgroundColor: '#1e293b',
                                titleColor: '#00d2ff',
                                padding: 15,
                                displayColors: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(255, 255, 255, 0.03)' },
                                ticks: { 
                                    color: '#64748b',
                                    font: { size: 10 }
                                }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { 
                                    color: '#64748b', 
                                    font: { size: 10 }
                                }
                            }
                        }
                    }
                });
            });
        };
    </script>
</body>
</html>
        `;

        fs.writeFileSync('DMP_Project_List.html', html);
        console.log("Report updated with Data Labels: DMP_Project_List.html");

    } finally {
        await client.close();
    }
}

run();
