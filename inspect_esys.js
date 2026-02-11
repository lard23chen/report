
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

async function inspectEsys() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data_Esys');

        // Fetch a few documents to inspect structure
        const samples = await collection.find({}).limit(3).toArray();
        console.log("ESYS Data Sample:", JSON.stringify(samples, null, 2));

        if (samples.length === 0) {
            console.log("No documents found in Qware_Ticket_Data_Esys.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectEsys();
