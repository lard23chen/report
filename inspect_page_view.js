require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_DMP;

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("trek-first-party-dmp");
        const coll = db.collection("event");

        const sample = await coll.findOne({ event_name: "page_view" });
        console.log("Sample page_view:", JSON.stringify(sample, null, 2));

        const eventNames = await coll.distinct('event_name');
        console.log("Distinct event names:", eventNames);

        // check random document to see time format
        const rand = await coll.findOne({});
        console.log("Random document:", Object.keys(rand));

    } catch (err) {
        console.log("Error:", err.message);
    } finally {
        await client.close();
    }
}
run();
