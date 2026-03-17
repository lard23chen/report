const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Member_data');
        const doc = await collection.findOne({ "更新時間": { $exists: true } });
        console.log("Sample Update Time:", doc ? doc["更新時間"] : "Not found");
    } finally {
        await client.close();
    }
}
check();
