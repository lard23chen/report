require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    await client.connect();
    const doc = await client.db("QwareAi").collection("Qware_Ticket_Data").findOne({ _id: "6985a77d9afb53341a70b2d8" });
    
    console.log("Keys in document:");
    for (let key in doc) {
        const val = doc[key];
        const valStr = String(val);
        
        let type = typeof val;
        if (val && val.$numberDecimal) type = "Decimal128";

        console.log(`Key: [${key}] | Type: ${type} | Sample: ${valStr.substring(0, 50)}`);
        
        // 探測時間欄位 (格式如 2026-01-03)
        if (/\d{4}-\d{2}-\d{2}/.test(valStr)) {
            console.log(`   >>> POSSIBLE TIME FIELD: ${key}`);
        }
        
        // 探測金額欄位
        if (type === "Decimal128" || (type === "number" && val > 100)) {
            console.log(`   >>> POSSIBLE REVENUE FIELD: ${key}`);
        }
    }
    process.exit();
}
run();
