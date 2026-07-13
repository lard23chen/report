require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
async function run() {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('QwareAi');
    const c = db.collection('Qware_Ticket_Data_Esys');

    const r = await c.aggregate([
        { $match: { "狀態": { $in: ["退票", "已退票"] } } },
        { $project: { feeType: { $type: "$手續費" }, feeValue: "$手續費" } },
        { $limit: 3 }
    ]).toArray();
    console.log(r);

    await client.close();
}
run().catch(console.dir);
