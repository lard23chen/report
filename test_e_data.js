require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
async function run() {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('QwareAi');
    const c = db.collection('Qware_Ticket_Data_Esys');
    const r = await c.aggregate([{ $group: { _id: { $substr: ['$交易時間', 0, 7] }, count: { $sum: 1 } } }]).toArray();
    console.log(r);
    await client.close();
}
run().catch(console.dir);
