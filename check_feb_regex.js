require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('AzureMonthlyCost');
        const docs = await collection.find({ YearMonth: /2026\/0?2/ }).toArray();
        console.log("Docs found for 2026/02:", docs.length);
        if (docs.length > 0) console.log(JSON.stringify(docs, null, 2));
    } finally {
        await client.close();
    }
}
check();
