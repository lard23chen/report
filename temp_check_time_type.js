const { MongoClient } = require("mongodb");
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");

        const doc = await db.collection("QwareTrafficSession").findOne({ ActivityID: 39414 }, { sort: { CreateTime: -1 } });
        console.log("Newest document CreateTime Type:", typeof doc.CreateTime, doc.CreateTime instanceof Date ? "Date" : "", doc.CreateTime);
        const docOld = await db.collection("QwareTrafficSession").findOne({ ActivityID: 39414 }, { sort: { CreateTime: 1 } });
        console.log("Oldest document CreateTime Type:", typeof docOld.CreateTime, docOld.CreateTime instanceof Date ? "Date" : "", docOld.CreateTime);

    } finally {
        await client.close();
    }
}
run();
