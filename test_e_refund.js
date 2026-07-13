require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
async function run() {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('QwareAi');
    const c = db.collection('Qware_Ticket_Data_Esys');
    const r = await c.findOne({ "狀態": { "$in": ["已退票", "退票"] } });
    console.log(r);
    await client.close();
}
run().catch(console.dir);
