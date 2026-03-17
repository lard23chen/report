const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('AzureMonthlyCost');
        const docs = await collection.find({}).sort({ YearMonth: 1 }).toArray();
        console.log("Found YearMonths:", docs.map(d => d.YearMonth));
    } finally {
        await client.close();
    }
}
check();
