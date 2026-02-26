const { MongoClient } = require("mongodb");
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    await client.connect();
    const db = client.db("QwareAi");
    const doc = await db.collection("QwareTrafficSession").findOne({ ActivityInfoName: { $regex: "金唱片" } });
    console.log(doc ? doc.ActivityID : "Not found");
    await client.close();
}
run();
