
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectDeeply() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        const docs = await collection.find({}).limit(2).toArray();
        console.log("Doc 1 Keys:", Object.keys(docs[0]));
        console.log("Doc 1 Values:", Object.values(docs[0]));

        if (docs.length > 1) {
            console.log("\nDoc 2 Keys:", Object.keys(docs[1]));
            console.log("Doc 2 Values:", Object.values(docs[1]));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectDeeply();
