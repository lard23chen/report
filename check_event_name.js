
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function checkEventName() {
    try {
        await client.connect();
        const db = client.db("allticket");
        const collection = db.collection('Qware_DashBoard');

        // Search for event names containing "金唱片"
        const events = await collection.distinct('節目商品名稱', { '節目商品名稱': { $regex: '金唱片' } });
        console.log("Found Events:", events);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkEventName();
