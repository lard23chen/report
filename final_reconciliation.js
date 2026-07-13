require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function reconcile() {
    await client.connect();
    const cursor = client.db("QwareAi").collection("Qware_Ticket_Data").find();
    
    const results = {
        "2026-01": { tickets: 0, revenue: 0 },
        "2026-02": { tickets: 0, revenue: 0 },
        "2026-03": { tickets: 0, revenue: 0 }
    };

    console.log("Starting deep reconciliation...");

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        let month = null;
        let price = 0;

        for (let k in doc) {
            const v = doc[k];
            const s = String(v);

            // 1. 識別月份 (排除非 2026 的資料)
            if (s.startsWith("2026-01")) month = "2026-01";
            else if (s.startsWith("2026-02")) month = "2026-02";
            else if (s.startsWith("2026-03")) month = "2026-03";

            // 2. 識別售價 (尋找合理範圍內的金額)
            let val = 0;
            if (v && v.$numberDecimal) val = parseFloat(v.$numberDecimal);
            else if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) val = parseFloat(v);
            else if (typeof v === 'number') val = v;

            // 排除 ID 或流水號 (假設售價為 50~10000 之間)
            if (val >= 50 && val <= 10000) {
                if (val > price) price = val; 
            }
        }

        if (month) {
            results[month].tickets++;
            results[month].revenue += price;
        }
    }

    console.log("\n--- FINAL RECONCILIATION RESULTS ---");
    console.table(results);
    process.exit();
}
reconcile();
