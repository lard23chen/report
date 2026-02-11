
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function verifyFields() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        // Check Price Field candidate '998'
        const distinctPrices = await collection.distinct('998');
        console.log("Distinct values for '998' (Price?):", distinctPrices.slice(0, 10));

        // Check Refund Fee Field candidate '-'
        const distinctRefunds = await collection.distinct('-');
        console.log("Distinct values for '-' (Refund Fee?):", distinctRefunds.slice(0, 10));

        // Find a refund record
        const refundDoc = await collection.findOne({ '正常': { $regex: '退票' } });
        if (refundDoc) {
            console.log("\nRefund Doc found:");
            console.log("Status (Key='正常'):", refundDoc['正常']);
            console.log("Refund Fee Candidate (Key='-'):", refundDoc['-']);
            console.log("Refund Value (Key='未列印'):", refundDoc['未列印']);
        } else {
            console.log("No refund doc found with key '正常' matching '退票'");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

verifyFields();
