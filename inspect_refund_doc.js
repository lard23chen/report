
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectRefundValues() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        const refundDoc = await collection.findOne({ '狀態': '退票' });
        if (refundDoc) {
            console.log("Refund Doc:", JSON.stringify(refundDoc, null, 2));
        } else {
            console.log("No refund doc found");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectRefundValues();
