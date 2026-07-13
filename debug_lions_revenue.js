require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function debugRevenue() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const eventName = "中華職棒37年例行賽統一獅主場（上）";
        
        const data = await db.collection("Qware_A_Ticket_data_Daily")
            .find({
                "節目/商品名稱": { $regex: eventName },
                "交易時間": { $regex: "^2026-03-09" }
            })
            .limit(10)
            .toArray();

        console.log(`Found ${data.length} samples.`);
        data.forEach((d, i) => {
            console.log(`Record ${i}: 售價 =`, d['售價'], "Type =", typeof d['售價']);
            if (d['售價'] && typeof d['售價'] === 'object') {
                console.log(`  Keys:`, Object.keys(d['售價']));
                console.log(`  ToString:`, d['售價'].toString());
            }
        });
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
debugRevenue();
