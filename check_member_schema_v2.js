
const { MongoClient, ServerApiVersion } = require('mongodb');

// MongoDB Connection Setup
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function checkMemberSchema() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Member_data'); // Updated to correct case

        console.log("Fetching one member record from Qware_Member_data...");
        const data = await collection.findOne({});

        if (data) {
            console.log("Data Keys:", Object.keys(data));
            console.log("Sample Data:", JSON.stringify(data, null, 2));
        } else {
            console.log("Still no data found in Qware_Member_data.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkMemberSchema();
