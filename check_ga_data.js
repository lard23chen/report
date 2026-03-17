const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('GA_MonthlyStats');
        const docs = await collection.find({}).sort({ ID: -1 }).limit(5).toArray();
        console.log(JSON.stringify(docs, null, 2));
    } finally {
        await client.close();
    }
}
check();
