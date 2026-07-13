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

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi"); // Assuming it's in QwareAi, we can check.

        console.log("--- QwareTrafficGAReadTime Sample ---");
        const sample1 = await db.collection("QwareTrafficGAReadTime").findOne({});
        console.log(sample1);

        console.log("\n--- QwareTrafficSession Sample ---");
        const sample2 = await db.collection("QwareTrafficSession").findOne({});
        console.log(sample2);

    } finally {
        await client.close();
    }
}
run().catch(console.dir);
