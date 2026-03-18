const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
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
