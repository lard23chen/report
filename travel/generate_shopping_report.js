const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Handle both local and relative paths
let csvFilePath = path.join(__dirname, 'new_data_gid_1320702581.csv');
let referenceHtmlPath = path.join(__dirname, 'reference_site.html');
let htmlFilePath = path.join(__dirname, 'shopping_report.html');

// Fallback for direct node execution if needed (or keep absolute if env matches)
if (!fs.existsSync(csvFilePath)) {
    csvFilePath = 'd:/2025/AI/MongoDB/travel/new_data_gid_1320702581.csv';
    referenceHtmlPath = 'd:/2025/AI/MongoDB/travel/reference_site.html';
    htmlFilePath = 'd:/2025/AI/MongoDB/travel/shopping_report.html';
}

// Function to extract photo map from reference HTML
function extractPhotoMap(htmlPath) {
    const map = {};
    try {
        if (fs.existsSync(htmlPath)) {
            const content = fs.readFileSync(htmlPath, 'utf8');
            // Regex to find "const products = [...]"
            const regex = /const products = (\[[\s\S]*?\]);/;
            const match = content.match(regex);

            if (match && match[1]) {
                const arrayStr = match[1];
                // Safely parse the array string using Function constructor or simple eval 
                // Since this is from a trusted update source, eval is okay-ish but Function is clearer
                // Note: The array contains comments like //..., those need to be handled if using JSON.parse (which won't work).
                // New Function is best for JS subset.
                const products = new Function('return ' + arrayStr)();

                products.forEach(p => {
                    if (p.name && p.img) {
                        map[p.name.trim()] = p.img;
                    }
                });
                console.log(`Extracted ${Object.keys(map).length} product images from reference site.`);
            } else {
                console.log('Could not find products array in reference site.');
            }
        } else {
            console.log('Reference site HTML not found, skipping image extraction.');
        }
    } catch (e) {
        console.error('Error extracting photos:', e);
    }
    return map;
}

try {
    // 1. Extract Photos
    const photoMap = extractPhotoMap(referenceHtmlPath);

    // 2. Process CSV
    const buffer = fs.readFileSync(csvFilePath);
    const workbook = xlsx.read(buffer, { type: 'buffer', codepage: 65001 });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) throw new Error('Sheet is empty');

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

        if (cleanH !== '時間戳記' && cleanH !== '姓名' && cleanH !== '總金額' && cleanH !== '許願沒有在清單請填這裡' && !cleanH.startsWith('數量總計')) {
            productHeaders.push({ name: cleanH, index: index });
        }
    });

    console.log(`Found ${productHeaders.length} products.`);

    // Process Rows
    const orders = [];
    const productStats = {}; // { productName: { quantity: 0 } }

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

        if (!name && !timestamp) continue;
        if (typeof name === 'string' && name.includes('數量總計')) continue;

        const order = {
            timestamp,
            name,
            totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
            products: []
        };

        if (order.totalAmount > 0) totalRevenue += order.totalAmount;

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

    // Sort products by popularity
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
    <title>🛍️ 2026年2月泰國代購統計報告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #FF9F1C;
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
        .chart-box { background: white; padding: 20px; border-radius: 15px; border: 1px solid #f0f0f0; height: 600px; position: relative; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.95rem; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f9f9f9; color: #666; font-weight: bold; white-space: nowrap; }
        tr:hover { background: #fdfdfd; }
        .product-tag { 
            display: inline-block; background: #eafbea; color: #2d6a4f; 
            padding: 3px 8px; border-radius: 10px; font-size: 0.85rem; margin: 2px;
            cursor: pointer; transition: background 0.2s;
        }
        .product-tag:hover { background: #cce3de; }
        
        .qty-badge {
            background: var(--primary); color: white; border-radius: 50%; 
            width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center;
            font-size: 0.75rem; margin-left: 5px;
        }
        
        /* Modal Styles */
        .modal-overlay {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center;
        }
        .modal-content {
            background: white; width: 90%; max-width: 600px; padding: 0;
            border-radius: 15px; overflow: hidden; position: relative;
            display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        }
        .modal-header { padding: 15px 20px; background: #fff; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .modal-title { font-size: 1.2rem; font-weight: bold; color: var(--text); }
        .close-btn { background: none; border: none; font-size: 1.8rem; cursor: pointer; color: #999; }
        .close-btn:hover { color: #333; }
        .modal-body { padding: 30px; display: flex; flex-direction: column; align-items: center; gap: 20px; background: #f9f9f9; }
        .modal-img { max-width: 100%; max-height: 400px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .modal-actions { text-align: center; width: 100%; }
        .btn-search {
            display: inline-block; padding: 10px 25px; background: var(--primary); color: white;
            text-decoration: none; border-radius: 25px; font-weight: bold;
            box-shadow: 0 4px 10px rgba(255, 159, 28, 0.3); transition: transform 0.2s;
        }
        .btn-search:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(255, 159, 28, 0.4); }

        @media (max-width: 768px) {
            .container { padding: 15px; }
            .chart-box { height: 400px; }
            td { font-size: 0.9rem; }
        }
    </style>
</head>
<body>

<div class="container">
    <h1>🛍️ 2026年2月泰國代購統計報告</h1>
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
        <p style="text-align:center; color:#999; font-size:0.9rem; margin-bottom:20px;">💡 點擊圖表中的長條或名稱可查看商品照片</p>
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
                            <span class="product-tag" onclick="openProductModal('${p.name.replace(/'/g, "\\'")}')">
                                ${p.name} <span class="qty-badge">${p.quantity}</span>
                            </span>
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

<!-- Product Modal -->
<div class="modal-overlay" id="productModal">
    <div class="modal-content">
        <div class="modal-header">
            <div class="modal-title" id="modalTitle">商品名稱</div>
            <button class="close-btn" onclick="closeProductModal()">×</button>
        </div>
        <div class="modal-body">
            <!-- Placeholder Image logic -->
            <img id="modalImg" src="" class="modal-img" alt="Product Image">
            <div class="modal-actions">
                <p style="color:#666; margin-bottom:15px;" id="missingText">暫無詳細照片，您可以：</p>
                <a id="searchLink" href="#" target="_blank" class="btn-search">🔍 Google 搜尋圖片</a>
            </div>
        </div>
    </div>
</div>

<script>
    Chart.register(ChartDataLabels);

    const fullProductLabels = ${JSON.stringify(sortedProducts.slice(0, 15).map(p => p.name))};
    const productData = ${JSON.stringify(sortedProducts.slice(0, 15).map(p => p.qty))};
    const photoMap = ${JSON.stringify(photoMap)}; // Injected Photo Map

    // Chart Configuration
    const ctx = document.getElementById('productChart').getContext('2d');
    const myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: fullProductLabels.map(l => l.length > 20 ? l.substring(0, 20) + '...' : l),
            datasets: [{
                label: '銷售數量 (Quantity)',
                data: productData,
                backgroundColor: '#FF9F1C',
                borderRadius: 5,
                barPercentage: 0.7
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    window.openProductModal(fullProductLabels[index]);
                }
            },
            onHover: (e, elements) => {
                e.native.target.style.cursor = elements.length ? 'pointer' : 'default';
            },
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
                        title: (items) => fullProductLabels[items[0].index]
                    }
                }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });

    // Modal Logic
    const modal = document.getElementById('productModal');
    const modalTitleElement = document.getElementById('modalTitle');
    const modalImgElement = document.getElementById('modalImg');
    const searchLinkElement = document.getElementById('searchLink');
    const missingTextElement = document.getElementById('missingText');

    window.openProductModal = function(productName) {
        if (!productName) return;
        
        modalTitleElement.innerText = productName;
        
        // 1. Check Map
        const cleanName = productName.trim();
        if (photoMap[cleanName]) {
            modalImgElement.src = photoMap[cleanName];
            missingTextElement.style.display = 'none';
        } else {
            // 2. Placeholder
            const safeText = encodeURIComponent(productName.substring(0, 20));
            modalImgElement.src = \`https://placehold.co/600x400/FF9F1C/white?text=\${safeText}\`;
            missingTextElement.style.display = 'block';
        }
        
        // Google Search Link
        searchLinkElement.href = \`https://www.google.com/search?tbm=isch&q=\${encodeURIComponent(productName)}\`;
        
        modal.style.display = 'flex';
    };

    window.closeProductModal = function() {
        modal.style.display = 'none';
    };

    modal.addEventListener('click', (e) => {
        if (e.target === modal) window.closeProductModal();
    });

</script>

</body>
</html>
    `;

    fs.writeFileSync(htmlFilePath, htmlContent);
    console.log('Successfully generated Shopping Report with Photo Links!');

} catch (err) {
    console.error('Error:', err);
}
