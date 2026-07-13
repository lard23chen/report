require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('GA_MonthlyStats');
        const doc = await collection.findOne({ YearMonth: "2026-02" });
        console.log(JSON.stringify(doc, null, 2));
    } finally {
        await client.close();
    }
}
check();
