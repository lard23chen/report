
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
        const collection = db.collection('Qware_Member_Data'); // Note: Case sensitivity might matter, user said qware_member_data, I'll try to list collections first or just guess based on previous naming convention (PascalCase usually in this DB?)

        console.log("Listing collections...");
        const collections = await db.listCollections().toArray();
        collections.forEach(c => console.log(c.name));

        console.log("\nFetching one member record...");
        const data = await collection.findOne({});

        if (data) {
            console.log("Data found. Keys:");
            console.log(Object.keys(data));
            console.log("Sample Data:", JSON.stringify(data, null, 2));
        } else {
            console.log("No data found in Qware_Member_Data.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkMemberSchema();
