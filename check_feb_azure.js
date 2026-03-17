const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('AzureMonthlyCost');
        const doc = await collection.findOne({ YearMonth: "2026/02" });
        console.log("Found 2026/02:", !!doc);
        if (doc) console.log(JSON.stringify(doc, null, 2));
    } finally {
        await client.close();
    }
}
check();
