require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function analyze() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('GA_MonthlyStats');

        const count = await collection.countDocuments();
        console.log(`Total documents: ${count}`);

        const sample = await collection.find({}).limit(5).toArray();
        console.log("Sample documents:");
        console.log(JSON.stringify(sample, null, 2));

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

analyze();
