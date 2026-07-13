require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const partialName = "韋禮安";
        
        const sessions = await db.collection("QwareTrafficSession").find({
            "ActivityInfoName": { "$regex": partialName }
        }, { projection: { ActivityID: 1, ActivityInfoName: 1, CreateTime: 1 } }).sort({ CreateTime: 1 }).toArray();
        console.log("Traffic Records:");
        sessions.forEach(s => console.log(JSON.stringify(s, null, 2)));

    } finally {
        await client.close();
    }
}
check();
