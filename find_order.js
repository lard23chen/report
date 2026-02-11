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

async function findOrder() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Searching for A251201000001 range...");

        // Find everything around A251201000001
        const docs = await collection.find({
            '訂單編號': { $regex: '^A251201000001' }
        }).toArray();

        // Sort them for clarity
        docs.sort((a, b) => a['訂單編號'].localeCompare(b['訂單編號']));

        if (docs.length > 0) {
            console.log(`Found ${docs.length} matches:`);
            docs.forEach(d => console.log(`- ${d['訂單編號']} [${d['狀態']}]`));
        } else {
            console.log("No matches found starting with A251201000001");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
        console.log("Connection closed.");
    }
}

findOrder();
