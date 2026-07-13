require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require("mongodb");
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    await client.connect();
    const db = client.db("QwareAi");
    const doc = await db.collection("QwareTrafficSession").findOne({ ActivityInfoName: { $regex: "金唱片" } });
    console.log(doc ? doc.ActivityID : "Not found");
    await client.close();
}
run();
