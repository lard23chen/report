require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('GA_MonthlyStats');
        const docs = await collection.find({}).sort({ ID: -1 }).limit(5).toArray();
        console.log(JSON.stringify(docs, null, 2));
    } finally {
        await client.close();
    }
}
check();
