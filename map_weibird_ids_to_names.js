const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const partialName = "韋禮安";
        
        const activityIds = await db.collection("QwareTrafficSession").distinct("ActivityID", {
            "ActivityInfoName": { "$regex": partialName }
        });
        console.log("Activity IDs for WeiBird:", activityIds);
        
        for (let id of activityIds) {
            const names = await db.collection("QwareTrafficSession").distinct("ActivityInfoName", { ActivityID: id });
            console.log(`Names for ActivityID ${id}:`, names);
        }

    } finally {
        await client.close();
    }
}
check();
