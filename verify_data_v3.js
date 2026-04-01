
const { MongoClient } = require('mongodb');
const fs = require('fs');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/";
const client = new MongoClient(uri);

async function scanDB(month) {
    await client.connect();
    const cursor = client.db("QwareAi").collection("Qware_Ticket_Data").find();
    let totalRev = 0;
    let ticketCount = 0;

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        let isMonth = false;
        let prices = [];

        for (let k in doc) {
            const v = doc[k];
            const s = String(v);
            if (s.startsWith(month)) isMonth = true;
            
            // 嘗試從字串中提取數字 (例如 "600", "4500.00")
            if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) {
                prices.push(parseFloat(v));
            } else if (v && v.$numberDecimal) {
                prices.push(parseFloat(v.$numberDecimal));
            }
        }

        if (isMonth) {
            ticketCount++;
            // 假設最大的那個數字通常是售價 (排除像 1, 2 這種張數或編號)
            const salePrice = Math.max(0, ...prices.filter(p => p > 50)); 
            totalRev += salePrice;
        }
    }
    return { ticketCount, totalRev };
}

async function main() {
    console.log("Checking 2026-03 Data...");
    const dbStats = await scanDB("2026-03");
    
    console.log(`\n[Database Scan] Tickets: ${dbStats.ticketCount}, Revenue: ${dbStats.totalRev}`);

    // Read HTML file data
    const htmlPath = "A_Qware_Revenue_Report_2026年03月_分析報表.html";
    if (fs.existsSync(htmlPath)) {
        const content = fs.readFileSync(htmlPath, 'utf8');
        const match = content.match(/const summaryData = ({.*?});/);
        if (match) {
            const reportData = JSON.parse(match[1]);
            console.log(`[Report File]  Tickets: ${reportData.totalTickets}, Revenue: ${reportData.totalRevenue}`);
            
            if (Math.abs(dbStats.totalRev - reportData.totalRevenue) < 1) {
                console.log("\n✅ Verification SUCCESS: Report matches Database scan.");
            } else {
                console.log("\n❌ Verification FAILED: Significant discrepancy detected.");
            }
        }
    }
    process.exit();
}
main();
