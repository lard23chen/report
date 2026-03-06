const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("trek-first-party-dmp");
        const coll = db.collection("event");

        const sample = await coll.findOne({});
        console.log("Any Sample:", JSON.stringify(sample, null, 2));

        const newest = await coll.find({}).sort({ $natural: -1 }).limit(1).toArray();
        if (newest.length) {
            console.log("\nNewest Sample:", JSON.stringify(newest[0], null, 2));
        }

        const indexes = await coll.listIndexes().toArray();
        console.log("\nIndexes:", indexes);

    } catch (err) {
        console.log("Error:", err.message);
    } finally {
        await client.close();
    }
}
run();
