
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function checkDecRefunds() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        // Look for any data in Dec 2025
        const allDecDocs = await collection.find({ "交易時間": { $regex: "^2025-12" } }).toArray();

        // Check for Refund Status
        const refundDocs = allDecDocs.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');

        // Check for Non-zero Fees
        const feeDocs = allDecDocs.filter(d => d['手續費'] && d['手續費'] > 0);

        // Calculate totals similar to report logic
        const refundOrdersSet = new Set();
        const refundFees = allDecDocs.reduce((acc, cur) => acc + (cur['手續費'] || 0), 0);

        refundDocs.forEach(d => {
            if (d['訂單編號']) refundOrdersSet.add(d['訂單編號'].split('_')[0]);
        });

        // Use the set of orders from refundDocs as "Refund Orders"
        // And total Refund Fees from all docs

        console.log("JSON_START");
        console.log(JSON.stringify({
            refundOrders: refundOrdersSet.size,
            refundFees: refundFees
        }));
        console.log("JSON_END");

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
checkDecRefunds();
