const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
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
