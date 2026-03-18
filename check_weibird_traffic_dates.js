const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const stats = await db.collection("QwareTrafficSession").aggregate([
            { "$match": { "ActivityID": 39484 } },
            { "$group": { "_id": { "$substr": ["$CreateTime", 0, 10] }, "count": { "$sum": 1 } } }
        ]).toArray();
        console.log("Traffic Dates for WeiBird:", stats);
    } finally {
        await client.close();
    }
}
check();
