const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const csvFilePath = path.join(__dirname, 'new_data_gid_1320702581.csv');
const htmlFilePath = path.join(__dirname, 'shopping_report.html');

try {
    // Read file manually to ensure encoding
    const buffer = fs.readFileSync(csvFilePath);

    // Parse using xlsx with explicit codepage (65001 is UTF-8)
    // If it fails, try without codepage or auto-detect
    const workbook = xlsx.read(buffer, { type: 'buffer', codepage: 65001 });
    const sheetName = workbook.SheetNames[0];

    // Check if sheet is empty
    if (!sheetName) throw new Error('Sheet is empty');

    // Get raw JSON
    // header: 1 returns array of arrays which is safer for headers with special chars
    const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });

    if (rawData.length < 2) {
        console.log('Not enough data rows');
        process.exit(1);
    }

    // Process Headers
    const headers = rawData[0];
    const headerMap = {};
    const productHeaders = [];

    headers.forEach((h, index) => {
        if (!h) return;
        const cleanH = h.toString().trim();
        headerMap[cleanH] = index;

        // Identification of product columns:
        // Exclude: '時間戳記', '姓名', '總金額', '備註' (if any), '許願沒有在清單請填這裡'
        // Include columns that look like products (often start with numbers like '001-' or contain product names)
        if (cleanH !== '時間戳記' && cleanH !== '姓名' && cleanH !== '總金額' && cleanH !== '許願沒有在清單請填這裡' && !cleanH.startsWith('數量總計')) {
            productHeaders.push({ name: cleanH, index: index });
        }
    });

    console.log(`Found ${productHeaders.length} products.`);

    // Process Rows
    const orders = [];
    const productStats = {}; // { productName: { quantity: 0, revenue: 0 } } (Revenue hard if price not in header, assume just qty for now)
    // Actually, headers don't have prices. The '總金額' column has the total order price.
    // We can just track Quantity per product.

    // Initialize product stats
    productHeaders.forEach(p => {
        productStats[p.name] = 0;
    });

    let totalRevenue = 0;

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const timestamp = row[headerMap['時間戳記'] || 0];
        const name = row[headerMap['姓名'] || 1];
        const totalAmount = parseFloat(row[headerMap['總金額'] || 2]);

        // Filter out empty or summary rows
        if (!name && !timestamp) continue;
        if (typeof name === 'string' && name.includes('數量總計')) continue;

        // Valid order
        const order = {
            timestamp,
            name,
            totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
            products: []
        };

        if (order.totalAmount > 0) totalRevenue += order.totalAmount;

        // Check products
        productHeaders.forEach(p => {
            const qtyStr = row[p.index];
            const qty = parseFloat(qtyStr);
            if (!isNaN(qty) && qty > 0) {
                order.products.push({ name: p.name, quantity: qty });
                productStats[p.name] += qty;
            }
        });

        orders.push(order);
    }

    // Sort products by popularity (quantity)
    const sortedProducts = Object.entries(productStats)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty);

    console.log(`Processed ${orders.length} orders. Total Revenue: ${totalRevenue}`);

    // Generate HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🛍️ 泰國代購統計報告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #FF9F1C; /* Orange for shopping/vitality */
            --secondary: #FFBF69;
            --bg: #FAFAFA;
            --text: #33272a;
            --accent: #2EC4B6;
        }
        body { font-family: 'Zen Maru Gothic', sans-serif; background: var(--bg); color: var(--text); padding: 20px; margin: 0; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
        h1 { text-align: center; color: var(--primary); margin-bottom: 20px; font-size: 2.5rem; }
        .subtitle { text-align: center; color: #888; margin-bottom: 40px; margin-top: -10px; }

        .summary-card { display: flex; justify-content: center; gap: 40px; margin-bottom: 40px; flex-wrap: wrap; }
        .stat-item { background: #fffcfc; padding: 20px 40px; border-radius: 15px; border: 1px dashed #eee; text-align: center; min-width: 200px; }
        .stat-item h3 { margin: 0 0 10px; color: #888; font-size: 1rem; }
        .stat-item .value { font-size: 2rem; font-weight: bold; color: var(--text); }
        
        .chart-section { margin-bottom: 50px; }
        .chart-box { background: white; padding: 20px; border-radius: 15px; border: 1px solid #f0f0f0; height: 500px; position: relative; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.95rem; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f9f9f9; color: #666; font-weight: bold; white-space: nowrap; }
        tr:hover { background: #fdfdfd; }
        .product-tag { 
            display: inline-block; background: #eafbea; color: #2d6a4f; 
            padding: 3px 8px; border-radius: 10px; font-size: 0.85rem; margin: 2px;
        }
        .qty-badge {
            background: var(--primary); color: white; border-radius: 50%; 
            width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center;
            font-size: 0.75rem; margin-left: 5px;
        }

        @media (max-width: 768px) {
            .container { padding: 15px; }
            .chart-box { height: 400px; }
            td { font-size: 0.9rem; }
        }
    </style>
</head>
<body>

<div class="container">
    <h1>🛍️ 泰國代購統計報告</h1>
    <p class="subtitle">更新時間: ${new Date().toLocaleString('zh-TW')}</p>

    <div class="summary-card">
        <div class="stat-item">
            <h3>總銷售額 (Total Revenue)</h3>
            <div class="value">NT$ ${totalRevenue.toLocaleString()}</div>
        </div>
        <div class="stat-item">
            <h3>總訂單數 (Total Orders)</h3>
            <div class="value">${orders.length}</div>
        </div>
        <div class="stat-item">
            <h3>總售出商品數 (Items Sold)</h3>
            <div class="value">${Object.values(productStats).reduce((a, b) => a + b, 0)}</div>
        </div>
    </div>

    <div class="chart-section">
        <h2 style="text-align:center; margin-bottom:20px; color:#555;">🔥 熱銷商品排行榜 (Top Products)</h2>
        <div class="chart-box">
            <canvas id="productChart"></canvas>
        </div>
    </div>

    <h2 style="margin-top:50px; margin-bottom:20px; border-left: 5px solid var(--primary); padding-left:15px;">📦 訂單詳細清單 (Order Details)</h2>
    <div style="overflow-x: auto;">
        <table>
            <thead>
                <tr>
                    <th>下單時間</th>
                    <th>姓名</th>
                    <th>總金額</th>
                    <th>購買商品 (數量)</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map(o => `
                <tr>
                    <td>${o.timestamp ? o.timestamp.toString().replace(/T/, ' ').replace(/\..+/, '') : ''}</td>
                    <td style="font-weight:bold;">${o.name}</td>
                    <td style="color:var(--primary); font-weight:bold;">NT$ ${o.totalAmount.toLocaleString()}</td>
                    <td>
                        ${o.products.map(p => `
                            <span class="product-tag">${p.name} <span class="qty-badge">${p.quantity}</span></span>
                        `).join('')}
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div style="text-align:center; margin-top: 40px;">
        <a href="index.html" style="color: #999; text-decoration: none;">← 返回首頁</a>
    </div>
</div>

<script>
    Chart.register(ChartDataLabels);

    const productLabels = ${JSON.stringify(sortedProducts.slice(0, 15).map(p => p.name))}; // Top 15
    const productData = ${JSON.stringify(sortedProducts.slice(0, 15).map(p => p.qty))};

    // Clean up long labels
    const cleanLabels = productLabels.map(l => {
        // Keep first 20 chars
        return l.length > 25 ? l.substring(0, 25) + '...' : l;
    });

    new Chart(document.getElementById('productChart'), {
        type: 'bar',
        data: {
            labels: cleanLabels,
            datasets: [{
                label: '銷售數量 (Quantity)',
                data: productData,
                backgroundColor: '#FF9F1C',
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal Bar Chart
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false },
                datalabels: {
                    color: '#444',
                    anchor: 'end',
                    align: 'right',
                    font: { weight: 'bold' },
                    formatter: Math.round
                },
                tooltip: {
                    callbacks: {
                        title: (items) => productLabels[items[0].index] // Show full name on hover
                    }
                }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });
</script>

</body>
</html>
    `;

    fs.writeFileSync(htmlFilePath, htmlContent);
    console.log('Successfully generated Shopping Report!');

} catch (err) {
    console.error('Error:', err);
}
