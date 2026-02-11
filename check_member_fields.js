
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function checkFields() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Member_data');

        const sample = await collection.findOne({});
        console.log("Sample Document Keys:", Object.keys(sample));
        console.log("Sample Document:", JSON.stringify(sample, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkFields();
