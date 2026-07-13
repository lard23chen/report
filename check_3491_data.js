require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const MONGO_URI = process.env.MONGODB_URI_PERSONAL;
async function run() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db('AlexLIFE');
        const r = await db.collection('Stock_Portfolio').findOne({ code: { $regex: '3491' } });
        console.log('Result:', JSON.stringify(r));
    } catch(e) { console.error(e); }
    finally { await client.close(); }
}
run();
