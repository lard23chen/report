require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");

        console.log("Searching for QwareTrafficSession activities...");
        const d = await db.collection("QwareTrafficSession").distinct("ActivityName", {});
        console.log(d.join("\n"));

        console.log("Searching for QwareTrafficSession ID by ActivityName...");

        const listItems = await db.collection("QwareTrafficSession").aggregate([
            { $group: { _id: "$ActivityID", name: { $first: "$ActivityName" } } }
        ]).toArray();
        console.log(listItems);
    } finally {
        await client.close();
    }
}
run();
