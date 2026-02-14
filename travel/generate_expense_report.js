const fs = require('fs');
const path = require('path');

const csvFilePath = 'd:/2025/AI/MongoDB/travel/new_analysis_data.csv';
const htmlFilePath = 'd:/2025/AI/MongoDB/travel/expense_report.html';

try {
    const fileContent = fs.readFileSync(csvFilePath, 'utf8');
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

    const headers = lines[0].split(',');
    // Headers: 消費日期,消費類別,消費項目,消費金額,付款方式,付款人,照片連結,備註

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        // Handle CSV split correctly (naive split by comma might break if quoted fields contain commas)
        // For simplicity, assuming no commas in fields based on sample, but safer to use regex or library if complex.
        // Given the sample, fields don't seem to have quotes.
        const cols = lines[i].split(',');
        if (cols.length < 8) continue;

        const date = cols[0];
        const category = cols[1];
        const item = cols[2];
        const amountStr = cols[3];
        const paymentMethod = cols[4];
        const payer = cols[5];
        const photoLink = cols[6];
        const note = cols[7]; // might contain commas if not careful, but last field ok for now if just simple split

        // Clean amount
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        data.push({
            date, category, item, amount, paymentMethod, payer, photoLink, note
        });
    }

    // Analysis
    let totalExpense = 0;
    const categoryStats = {};
    const payerStats = {};
    const methodStats = {};
    const dailyStats = {};

    data.forEach(d => {
        if (isNaN(d.amount)) return;

        // Treat positive as expense, negative as adjustment (or ignore for total expense?)
        // Usually negative means money back or exchange. Let's separate them.
        if (d.amount > 0) {
            totalExpense += d.amount;

            // Category
            categoryStats[d.category] = (categoryStats[d.category] || 0) + d.amount;

            // Payer
            payerStats[d.payer] = (payerStats[d.payer] || 0) + d.amount;

            // Method
            methodStats[d.paymentMethod] = (methodStats[d.paymentMethod] || 0) + d.amount;

            // Daily
            dailyStats[d.date] = (dailyStats[d.date] || 0) + d.amount;
        }
    });

    // Generate HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📊 旅遊消費分析報告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #FF8BA7;
            --secondary: #FFC6C7;
            --bg: #FAFAFA;
            --text: #33272a;
        }
        body { font-family: 'Zen Maru Gothic', sans-serif; background: var(--bg); color: var(--text); padding: 20px; margin: 0; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
        h1 { text-align: center; color: var(--primary); margin-bottom: 40px; font-size: 2.5rem; }
        .summary-card { display: flex; justify-content: space-around; margin-bottom: 40px; text-align: center; background: #fffcfc; padding: 20px; border-radius: 15px; border: 1px dashed #eee; }
        .stat-item h3 { margin: 0 0 10px; color: #888; font-size: 1rem; }
        .stat-item .value { font-size: 2rem; font-weight: bold; color: var(--text); }
        .chart-container { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .chart-box { background: white; padding: 20px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.03); border: 1px solid #f0f0f0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.95rem; }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f9f9f9; color: #666; font-weight: bold; }
        tr:hover { background: #fdfdfd; }
        .amount { font-weight: bold; color: var(--primary); }
        .amount.negative { color: #4ecdc4; }
        a.photo-link { display: inline-block; padding: 5px 10px; background: #eee; border-radius: 5px; text-decoration: none; color: #555; font-size: 0.8rem; }
        a.photo-link:hover { background: #ddd; }
        
        @media (max-width: 768px) {
            .chart-container { grid-template-columns: 1fr; }
            .container { padding: 20px; }
        }
    </style>
</head>
<body>

<div class="container">
    <h1>📊 旅遊消費分析報告</h1>

    <div class="summary-card">
        <div class="stat-item">
            <h3>總消費金額 (Total)</h3>
            <div class="value">NT$ ${totalExpense.toLocaleString()}</div>
        </div>
        <div class="stat-item">
            <h3>總筆數 (Count)</h3>
            <div class="value">${data.filter(d => d.amount > 0).length}</div>
        </div>
    </div>

    <div class="chart-container">
        <div class="chart-box">
            <canvas id="categoryChart"></canvas>
        </div>
        <div class="chart-box">
            <canvas id="payerChart"></canvas>
        </div>
    </div>
    
    <div class="chart-container">
        <div class="chart-box" style="grid-column: 1 / -1;">
             <canvas id="methodChart"></canvas>
        </div>
    </div>

    <h2>📋 詳細消費清單</h2>
    <table>
        <thead>
            <tr>
                <th>日期</th>
                <th>類別</th>
                <th>項目</th>
                <th>金額</th>
                <th>支付</th>
                <th>付款人</th>
                <th>備註</th>
            </tr>
        </thead>
        <tbody>
            ${data.map(d => `
            <tr>
                <td>${d.date}</td>
                <td>${d.category}</td>
                <td>${d.item}</td>
                <td class="amount ${d.amount < 0 ? 'negative' : ''}">${d.amount.toLocaleString()}</td>
                <td>${d.paymentMethod}</td>
                <td>${d.payer}</td>
                <td>${d.photoLink && d.photoLink !== '無照片' ? `<a href="${d.photoLink}" target="_blank" class="photo-link">📷 照片</a>` : ''} ${d.note}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div style="text-align:center; margin-top: 40px;">
        <a href="index.html" style="color: #999; text-decoration: none;">← 返回旅遊日記</a>
    </div>

</div>

<script>
    // Data Preparation
    const categoryData = ${JSON.stringify(categoryStats)};
    const payerData = ${JSON.stringify(payerStats)};
    const methodData = ${JSON.stringify(methodStats)};

    // Colors
    const colors = ['#FF8BA7', '#FFC6C7', '#FAEEE7', '#33272a', '#594a4e', '#3da9fc', '#ff9f1c'];

    // Category Chart
    new Chart(document.getElementById('categoryChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: '消費類別分佈 (By Category)' }
            }
        }
    });

    // Payer Chart
    new Chart(document.getElementById('payerChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(payerData),
            datasets: [{
                label: '付款金額',
                data: Object.values(payerData),
                backgroundColor: '#FF8BA7',
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: '付款人統計 (By Payer)' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Method Chart
    new Chart(document.getElementById('methodChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(methodData),
            datasets: [{
                label: '金額',
                data: Object.values(methodData),
                backgroundColor: '#3da9fc',
                borderRadius: 10
            }]
        },
        options: {
             indexAxis: 'y',
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: '支付方式統計 (By Payment Method)' }
            }
        }
    });
</script>

</body>
</html>
    `;

    fs.writeFileSync(htmlFilePath, htmlContent);
    console.log('Successfully generated expense report!');

} catch (err) {
    console.error(err);
}
