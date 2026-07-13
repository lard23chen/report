require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('AzureMonthlyCost');
        const docs = await collection.find({}).sort({ YearMonth: -1 }).limit(1).toArray();
        console.log(JSON.stringify(docs[0], null, 2));
    } finally {
        await client.close();
    }
}
check();
