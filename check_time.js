const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/";

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
