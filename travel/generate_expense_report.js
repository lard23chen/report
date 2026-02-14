const fs = require('fs');
const path = require('path');

const csvFilePath = path.join(__dirname, 'new_analysis_data.csv');
const htmlFilePath = path.join(__dirname, 'expense_report.html');

try {
    const fileContent = fs.readFileSync(csvFilePath, 'utf8');
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

    // Headers: 消費日期,消費類別,消費項目,消費金額,付款方式,付款人,照片連結,備註

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 8) continue;

        const date = cols[0];
        const category = cols[1];
        const item = cols[2];
        const amountStr = cols[3];
        const paymentMethod = cols[4];
        const payer = cols[5];
        const photoLink = cols[6];
        const note = cols[7];

        const amount = parseFloat(amountStr.replace(/,/g, ''));

        data.push({
            date, category, item, amount, paymentMethod, payer, photoLink, note
        });
    }

    // Sort Data by Date
    data.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
    });

    // Analysis for Charts
    let totalExpense = 0;
    const categoryStats = {};
    const payerStats = {};
    const methodStats = {};

    // For Filters
    const uniqueDates = new Set();
    const uniquePayers = new Set();

    data.forEach(d => {
        if (!isNaN(d.amount) && d.amount > 0) {
            totalExpense += d.amount;
            categoryStats[d.category] = (categoryStats[d.category] || 0) + d.amount;
            payerStats[d.payer] = (payerStats[d.payer] || 0) + d.amount;
            methodStats[d.paymentMethod] = (methodStats[d.paymentMethod] || 0) + d.amount;
        }
        // Collect filter options (include all rows)
        if (d.date) uniqueDates.add(d.date);
        if (d.payer) uniquePayers.add(d.payer);
    });

    const sortedDates = Array.from(uniqueDates).sort();
    const sortedPayers = Array.from(uniquePayers).sort();

    // Helper to converting drive link to preview link
    const getPreviewLink = (link) => {
        if (!link) return '';
        if (link.includes('drive.google.com')) {
            return link.replace(/\/view.*/, '/preview');
        }
        return link;
    };

    // Generate HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📊 2026年2月旅遊消費分析報告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
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
        
        /* Table & Filters */
        .filters { display: flex; gap: 15px; margin-bottom: 15px; align-items: center; background: #f9f9f9; padding: 15px; border-radius: 10px; }
        .filters select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 5px; font-family: inherit; font-size: 0.95rem; outline: none; }
        .filters label { font-weight: bold; color: #666; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.95rem; }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f9f9f9; color: #666; font-weight: bold; }
        tr:hover { background: #fdfdfd; }
        .amount { font-weight: bold; color: var(--primary); }
        .amount.negative { color: #4ecdc4; }
        
        /* Photo Button */
        button.photo-btn { 
            display: inline-flex; align-items: center; gap: 5px;
            padding: 5px 10px; background: #eee; border: none; border-radius: 5px; 
            cursor: pointer; color: #555; font-size: 0.8rem; font-family: inherit;
            transition: background 0.2s;
        }
        button.photo-btn:hover { background: #ddd; }

        /* Modal */
        .modal-overlay {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center;
        }
        .modal-content {
            background: white; width: 90%; max-width: 800px; height: 80%; max-height: 600px;
            border-radius: 10px; overflow: hidden; position: relative;
            display: flex; flex-direction: column;
        }
        .modal-header { padding: 10px 15px; background: #fff; border-bottom: 1px solid #eee; display: flex; justify-content: flex-end; }
        .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #999; }
        .close-btn:hover { color: #333; }
        .modal-body { flex: 1; background: #000; }
        iframe { width: 100%; height: 100%; border: none; }

        @media (max-width: 768px) {
            .chart-container { grid-template-columns: 1fr; }
            .container { padding: 20px; }
            .filters { flex-direction: column; align-items: stretch; }
        }
    </style>
</head>
<body>

<div class="container">
    <h1>📊 2026年2月旅遊消費分析報告</h1>

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
    
    <div class="filters">
        <div>
            <label>📅 日期：</label>
            <select id="dateFilter">
                <option value="all">全部 (All)</option>
                ${sortedDates.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
        </div>
        <div>
            <label>👤 付款人：</label>
            <select id="payerFilter">
                <option value="all">全部 (All)</option>
                ${sortedPayers.map(p => `<option value="${p}">${p}</option>`).join('')}
            </select>
        </div>
    </div>

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
        <tbody id="expenseTableBody">
            ${data.map(d => `
            <tr data-date="${d.date}" data-payer="${d.payer}">
                <td>${d.date}</td>
                <td>${d.category}</td>
                <td>${d.item}</td>
                <td class="amount ${d.amount < 0 ? 'negative' : ''}">${d.amount.toLocaleString()}</td>
                <td>${d.paymentMethod}</td>
                <td>${d.payer}</td>
                <td>
                    ${d.photoLink && d.photoLink !== '無照片' ?
            `<button class="photo-btn" onclick="openModal('${getPreviewLink(d.photoLink)}')">📷 照片</button>` : ''} 
                    ${d.note}
                </td>
            </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div style="text-align:center; margin-top: 40px;">
        <a href="index.html" style="color: #999; text-decoration: none;">← 返回旅遊日記</a>
    </div>

</div>

<!-- Modal -->
<div class="modal-overlay" id="photoModal">
    <div class="modal-content">
        <div class="modal-header">
            <button class="close-btn" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <iframe id="photoFrame" src=""></iframe>
        </div>
    </div>
</div>

<script>
    // Register the datalabels plugin
    Chart.register(ChartDataLabels);

    // Data Preparation
    const categoryData = ${JSON.stringify(categoryStats)};
    const payerData = ${JSON.stringify(payerStats)};
    const methodData = ${JSON.stringify(methodStats)};

    // Colors
    const colors = ['#FF8BA7', '#FFC6C7', '#FAEEE7', '#33272a', '#594a4e', '#3da9fc', '#ff9f1c'];
    const commonDatalabels = { color: '#444', font: { weight: 'bold' }, formatter: (value) => value.toLocaleString() };

    // Create Charts (Configs same as before)
    new Chart(document.getElementById('categoryChart'), {
        type: 'doughnut',
        data: { labels: Object.keys(categoryData), datasets: [{ data: Object.values(categoryData), backgroundColor: colors, borderWidth: 0 }] },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: '消費類別分佈 (By Category)' },
                datalabels: { ...commonDatalabels, color: '#333', backgroundColor: '#fff', borderRadius: 4, anchor: 'end', align: 'start', offset: 10 }
            },
            layout: { padding: 20 }
        }
    });

    new Chart(document.getElementById('payerChart'), {
        type: 'bar',
        data: { labels: Object.keys(payerData), datasets: [{ label: '付款金額', data: Object.values(payerData), backgroundColor: '#FF8BA7', borderRadius: 10 }] },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, title: { display: true, text: '付款人統計 (By Payer)' }, datalabels: { ...commonDatalabels, anchor: 'end', align: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });

    new Chart(document.getElementById('methodChart'), {
        type: 'bar',
        data: { labels: Object.keys(methodData), datasets: [{ label: '金額', data: Object.values(methodData), backgroundColor: '#3da9fc', borderRadius: 10 }] },
        options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false }, title: { display: true, text: '支付方式統計 (By Payment Method)' }, datalabels: { ...commonDatalabels, anchor: 'end', align: 'right' } } }
    });

    // --- Filter Logic ---
    const dateFilter = document.getElementById('dateFilter');
    const payerFilter = document.getElementById('payerFilter');
    const tableRows = document.querySelectorAll('#expenseTableBody tr');

    function applyFilters() {
        const selectedDate = dateFilter.value;
        const selectedPayer = payerFilter.value;

        tableRows.forEach(row => {
            const rowDate = row.getAttribute('data-date');
            const rowPayer = row.getAttribute('data-payer');

            const dateMatch = (selectedDate === 'all' || rowDate === selectedDate);
            const payerMatch = (selectedPayer === 'all' || rowPayer === selectedPayer);

            if (dateMatch && payerMatch) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    dateFilter.addEventListener('change', applyFilters);
    payerFilter.addEventListener('change', applyFilters);

    // --- Modal Logic ---
    const modal = document.getElementById('photoModal');
    const iframe = document.getElementById('photoFrame');

    function openModal(url) {
        if(!url) return;
        iframe.src = url;
        modal.style.display = 'flex';
    }

    function closeModal() {
        modal.style.display = 'none';
        iframe.src = ''; // Stop video/clear content
    }

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

</script>

</body>
</html>
    `;

    fs.writeFileSync(htmlFilePath, htmlContent);
    console.log('Successfully generated expense report with filters and modal!');

} catch (err) {
    console.error(err);
}
