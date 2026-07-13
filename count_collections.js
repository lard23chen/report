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
        const db = client.db("QwareAi");

        const count1 = await db.collection("QwareTrafficGAReadTime").countDocuments();
        console.log("QwareTrafficGAReadTime count:", count1);

        const count2 = await db.collection("QwareTrafficSession").countDocuments();
        console.log("QwareTrafficSession count:", count2);

    } finally {
        await client.close();
    }
}
run().catch(console.dir);
