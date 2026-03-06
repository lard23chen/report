const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/QwareAi?retryWrites=true&w=majority";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();

        // try QwareAi first
        let db = client.db("QwareAi");
        console.log("Collections in QwareAi:");
        let collections = await db.listCollections().toArray();
        collections.forEach(c => console.log(` - ${c.name}`));

        // grab a sample from GA-related table
        const coll1 = db.collection("QwareTrafficGAReadTime");
        const s1 = await coll1.findOne({});
        console.log("\nSample from QwareTrafficGAReadTime:", s1);

        const coll2 = db.collection("QwareTrafficSession");
        const s2 = await coll2.findOne({});
        console.log("\nSample from QwareTrafficSession:", s2);

        // Maybe there's a new table for GA?
        const coll3 = db.collection("events"); // just in case
        const s3 = await coll3.findOne({});
        if (s3) console.log("\nSample from events:", s3);

    } catch (err) {
        console.log("Error:", err.message);
    } finally {
        await client.close();
    }
}
run();
