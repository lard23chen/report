
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function findAnyDate() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const aId = "39455";
        
        console.log(`Finding all dates for ActivityID: ${aId}`);
        const sample = await db.collection("QwareTrafficSession").find({ ActivityID: aId }).sort({CreateTime: -1}).limit(20).toArray();
        sample.forEach(s => console.log(s.CreateTime));

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
findAnyDate();
