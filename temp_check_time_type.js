require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require("mongodb");
const uri = process.env.MONGODB_URI_QWARE;
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
