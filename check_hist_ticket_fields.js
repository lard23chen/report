require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const count = await db.collection("Qware_Ticket_Data").countDocuments({ "交易時間": { "$exists": true } });
        console.log("Records with 交易時間 in Qware_Ticket_Data:", count);
        if (count > 0) {
            const sample = await db.collection("Qware_Ticket_Data").findOne({ "交易時間": { "$exists": true } });
            console.log("Sample keys:", Object.keys(sample));
            console.log("Sample name:", sample['節目/商品名稱']);
        } else {
             const first = await db.collection("Qware_Ticket_Data").findOne();
             console.log("First record keys:", Object.keys(first));
        }
    } finally {
        await client.close();
    }
}
check();
