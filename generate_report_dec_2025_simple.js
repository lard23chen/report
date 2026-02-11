
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB Connection Setup
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });

async function generateReport() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Fetching data for 2025-12...");
        const data = await collection.find({ "交易時間": { $regex: "^2025-12" } }).toArray();
        console.log(`Fetched ${data.length} records.`);

        // Current Time for the report
        const reportTime = new Date().toLocaleString('zh-TW');

        // Load Logo Base64 (simplified for reliability)
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, 'ibon_logo.png');
            if (fs.existsSync(logoPath)) {
                logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
            }
        } catch (err) { }

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>ibon售票系統 2025年12月 分析報表 (A系統)</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>body{font-family:sans-serif;padding:20px;background:#f5f5f5;} .container{max-width:1200px;margin:0 auto;} .card{background:white;padding:20px;border-radius:8px;margin-bottom:20px;} table{width:100%;border-collapse:collapse;} th,td{padding:10px;border-bottom:1px solid #ddd;}</style>
</head>
<body>
<div class="container">
    <h1>2025年12月 分析報表 (A系統)</h1>
    <div>產出時間: ${reportTime}</div>
    
    <div class="card">
        <h3>Ticket Type Analysis</h3>
        <table id="ticketTypeTable">
            <thead><tr><th>Type</th><th>Orders</th><th>Tickets</th><th>Revenue</th></tr></thead>
            <tbody></tbody>
        </table>
    </div>
    
    <!-- Other tables as placeholders if needed, simplifying for now to ensure JS works -->
</div>
<script>
    const dbData = ${JSON.stringify(data)};
    const validOrders = dbData.filter(d => d['狀態'] === '正常');
    
    const typeStats = {
        'Paper': { t: 0, r: 0, o: new Set() },
        'Running/Electronic': { t: 0, r: 0, o: new Set() },
        'Other': { t: 0, r: 0, o: new Set() }
    };
    
    validOrders.forEach(d => {
        const m = d['取票方式'];
        let k = 'Other';
        if(m === '已取') k = 'Paper';
        else if(m === '未列印') k = 'Running/Electronic';
        
        typeStats[k].t++;
        typeStats[k].r += (d['售價']||0);
        if(d['訂單編號']) typeStats[k].o.add(d['訂單編號'].split('_')[0]);
    });
    
    const tbody = document.querySelector('#ticketTypeTable tbody');
    Object.keys(typeStats).forEach(k => {
        const s = typeStats[k];
        if(s.t === 0) return;
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${k}</td><td>\${s.o.size}</td><td>\${s.t}</td><td>$\${s.r.toLocaleString()}</td>\`;
        tbody.appendChild(tr);
    });
</script>
</body>
</html>`;

        const filePath = path.join(__dirname, 'Qware_Revenue_Report_2025_12_Simple.html');
        fs.writeFileSync(filePath, htmlContent);
        console.log(`Report generated: ${filePath}`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
generateReport();
