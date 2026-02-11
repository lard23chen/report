
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function checkRefundFee() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        // Find a document that has some refund related info or just list all keys from a few docs
        const doc = await collection.findOne({ '狀態': { $regex: '退票' } });
        if (doc) {
            console.log("Refund Doc Keys:", Object.keys(doc));
            // Check for '退票手續費'
            const feeKey = Object.keys(doc).find(k => k.includes('手續費'));
            console.log("Found Fee Key:", feeKey);
        } else {
            console.log("No refund doc found.");
            // fallback check
            const doc2 = await collection.findOne({});
            console.log("Normal Doc Keys:", Object.keys(doc2));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkRefundFee();
