
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function findLoginField() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Member_data');
        const sample = await collection.findOne({ 最後登入時間: { $exists: true, $ne: null } });
        if (sample) {
            console.log("Found field '最後登入時間' with sample:", sample['最後登入時間']);
        } else {
            console.log("Searching for login-related fields...");
            const doc = await collection.findOne({});
            console.log("Keys in document:", Object.keys(doc));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
findLoginField();
