const fs = require('fs');
const { MongoClient } = require('mongodb');
const cheerio = require('cheerio');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        const html = fs.readFileSync('sheet_preview.html', 'utf8');
        const $ = cheerio.load(html);

        const rows = [];
        $('table.waffle tr').each((i, tr) => {
            const row = [];
            $(tr).find('td').each((j, td) => {
                row.push($(td).text().trim());
            });
            if (row.length > 0 && row.some(cell => cell !== "")) {
                rows.push(row);
            }
        });

        // The data has multiple sections. Let's try to identify them.
        // Row 0 is header for Section 1 (Insurance Summary)
        // Row 7 is header for Section 2 (Policy Details)
        // etc.

        const insuranceData = {
            summary: [],
            details: [],
            updatedAt: new Date()
        };

        let currentSection = '';
        rows.forEach((row, index) => {
            const firstCell = row[0] || '';
            if (firstCell.includes('商品名稱')) {
                currentSection = 'summary';
                return;
            }
            if (firstCell.includes('日期') || firstCell.includes('保單號碼')) {
                currentSection = 'details';
                return;
            }

            if (currentSection === 'summary' && row[0] !== '' && row[0] !== '商品名稱') {
                insuranceData.summary.push({
                    name: row[0],
                    years: row[1],
                    annualPremium: row[2],
                    totalEstimatedPremium: row[3],
                    totalPremium: row[4],
                    maturityYear: row[5],
                    maturityAmount: row[6],
                    return5yr: row[7],
                    return10yr: row[8],
                    return2024: row[9],
                    memo: row[10]
                });
            } else if (currentSection === 'details' && row[1] !== '' && row[1] !== '保單號碼') {
                insuranceData.details.push({
                    date: row[0],
                    policyNumber: row[1],
                    name: row[2],
                    premiumYears: row[3],
                    paidYears: row[4],
                    annualPremium: row[5],
                    accumulatedPremium: row[6],
                    totalPremium: row[7],
                    return5yr: row[8],
                    return10yr: row[9],
                    returnNov2025: row[10],
                    memo: row[11]
                });
            }
        });

        const mergedData = [];
        
        // Use summary as the base
        insuranceData.summary.forEach(sum => {
            // Find matching details
            const matchedDetails = insuranceData.details.filter(det => det.name.includes(sum.name) || sum.name.includes(det.name));
            
            if (matchedDetails.length > 0) {
                matchedDetails.forEach(det => {
                    mergedData.push({
                        ...sum,
                        ...det,
                        source: 'Merged'
                    });
                });
            } else {
                mergedData.push({
                    ...sum,
                    date: '',
                    policyNumber: '',
                    premiumYears: '',
                    paidYears: '',
                    accumulatedPremium: '',
                    returnNov2025: '',
                    source: 'Summary Only'
                });
            }
        });

        // Add details that didn't match any summary
        insuranceData.details.forEach(det => {
            const isMatched = insuranceData.summary.some(sum => det.name.includes(sum.name) || sum.name.includes(det.name));
            if (!isMatched) {
                mergedData.push({
                    name: det.name,
                    years: det.premiumYears,
                    annualPremium: det.annualPremium,
                    totalEstimatedPremium: '',
                    totalPremium: det.totalPremium,
                    maturityYear: '',
                    maturityAmount: '',
                    return5yr: det.return5yr,
                    return10yr: det.return10yr,
                    return2024: '',
                    memo: det.memo,
                    date: det.date,
                    policyNumber: det.policyNumber,
                    paidYears: det.paidYears,
                    accumulatedPremium: det.accumulatedPremium,
                    returnNov2025: det.returnNov2025,
                    source: 'Detail Only'
                });
            }
        });

        console.log(`Merged into ${mergedData.length} integrated records.`);

        // Save to MongoDB
        await client.connect();
        const db = client.db('QwareAi');
        const col = db.collection('AlexLFE_insurance');

        await col.deleteMany({});
        await col.insertMany(mergedData);
        console.log('Saved merged data to MongoDB QwareAi.AlexLFE_insurance');

        // Generate HTML Report
        const htmlContent = generateHTML(mergedData);
        fs.writeFileSync('A_Insurance_Report.html', htmlContent, 'utf8');
        console.log('Generated A_Insurance_Report.html');

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

function generateHTML(data) {
    const headers = [
        '保單名稱', '成交日', '保單號碼', '繳費年期', '年繳保費', 
        '累計繳費', '滿期年', '滿期金', '5年領回', '10年領回', '2025領回', '備註'
    ];
    const fields = [
        'name', 'date', 'policyNumber', 'years', 'annualPremium', 
        'accumulatedPremium', 'maturityYear', 'maturityAmount', 'return5yr', 'return10yr', 'returnNov2025', 'memo'
    ];

    return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>保單資產整合分析報表</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #2563eb;
            --secondary: #64748b;
            --bg: #f1f5f9;
            --card: #ffffff;
            --text: #1e293b;
            --accent: #3b82f6;
        }
        body {
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        header {
            text-align: center;
            margin-bottom: 30px;
        }
        h1 {
            font-weight: 800;
            font-size: 2.5em;
            margin-bottom: 10px;
            color: var(--primary);
        }
        .card {
            background: var(--card);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            overflow-x: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            white-space: nowrap;
        }
        th {
            background: #f8fafc;
            color: var(--secondary);
            text-align: left;
            padding: 12px 15px;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 2px solid #e2e8f0;
        }
        td {
            padding: 12px 15px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 0.95em;
        }
        tr:hover {
            background: #f8fafc;
        }
        .memo-cell {
            max-width: 300px;
            white-space: normal;
            font-size: 0.85em;
            color: #64748b;
        }
        .footer {
            text-align: center;
            color: var(--secondary);
            font-size: 0.85em;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>保單資產整合分析報表</h1>
            <p>最後更新時間：${new Date().toLocaleString('zh-TW')}</p>
        </header>

        <div class="card">
            <table>
                <thead>
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${data.map(row => {
                        const displayName = row.name && row.name.length > 10 ? row.name.substring(0, 10) + '...' : (row.name || '-');
                        return `
                        <tr>
                            <td>${displayName}</td>
                            ${fields.slice(1).map(f => `<td class="${f === 'memo' ? 'memo-cell' : ''}">${row[f] || '-'}</td>`).join('')}
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>&copy; 2026 AlexLFE Insurance Portfolio. Merged View Analysis.</p>
        </div>
    </div>
</body>
</html>`;
}

run();
