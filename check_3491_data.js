const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';
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
