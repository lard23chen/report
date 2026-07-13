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

        const topEvents = await db.collection("QwareTrafficSession").aggregate([
            {
                $group: {
                    _id: "$ActivityID",
                    Name: { $first: "$ActivityInfoName" },
                    MaxSessions: { $max: "$SessionCount" },
                    AvgSessions: { $avg: "$SessionCount" }
                }
            },
            { $sort: { MaxSessions: -1 } },
            { $limit: 10 }
        ]).toArray();

        console.log(topEvents);

    } finally {
        await client.close();
    }
}
run().catch(console.dir);
