require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const stats = await db.collection("QwareTrafficSession").aggregate([
            { "$match": { "ActivityID": 39484 } },
            { "$group": { "_id": { "$substr": ["$CreateTime", 0, 10] }, "count": { "$sum": 1 } } }
        ]).toArray();
        console.log("Traffic Dates for WeiBird:", stats);
    } finally {
        await client.close();
    }
}
check();
