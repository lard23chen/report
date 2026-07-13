require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_DMP;

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("trek-first-party-dmp");
        const coll = db.collection("event");

        const sample = await coll.findOne({ name: "page_view" });
        console.log("Time type:", typeof sample.time);
        if (sample.time instanceof Date) {
            console.log("It's a Date object:", sample.time.toISOString());
        } else {
            console.log("Value:", sample.time);
        }

    } finally {
        await client.close();
    }
}
run();
