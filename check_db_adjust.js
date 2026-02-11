
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function checkStructure() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        const docs = await collection.find({}).limit(1).toArray();
        if (docs.length > 0) {
            console.log("Latest Doc Keys:", Object.keys(docs[0]));
            // Check if standard keys exist
            const hasStatus = docs[0].hasOwnProperty('狀態');
            const hasPrice = docs[0].hasOwnProperty('售價');
            console.log("Has '狀態'?", hasStatus);
            console.log("Has '售價'?", hasPrice);
        } else {
            console.log("No data found.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkStructure();
