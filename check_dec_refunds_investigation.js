
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

        console.log("Checking Dec 2025 data...");
        // Look for any data in Dec 2025
        const allDecDocs = await collection.find({ "交易時間": { $regex: "^2025-12" } }).toArray();
        console.log(`Total Docs in Dec 2025: ${allDecDocs.length}`);

        // Check for Refund Status
        const refundDocs = allDecDocs.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');
        console.log(`Docs with Status '已退票' or '退票': ${refundDocs.length}`);

        // Check for Non-zero Fees
        const feeDocs = allDecDocs.filter(d => d['手續費'] && d['手續費'] > 0);
        console.log(`Docs with Fee > 0: ${feeDocs.length}`);

        // Calculate totals similar to report logic
        const refundOrdersSet = new Set();
        refundDocs.forEach(d => {
            if (d['訂單編號']) refundOrdersSet.add(d['訂單編號'].split('_')[0]);
        });

        const feeOrdersSet = new Set();
        let totalFees = 0;
        feeDocs.forEach(d => {
            if (d['訂單編號']) feeOrdersSet.add(d['訂單編號'].split('_')[0]);
            totalFees += (d['手續費'] || 0);
        });

        console.log(`Unique Refund Orders (by Status): ${refundOrdersSet.size}`);
        console.log(`Unique Refund Orders (by Fee): ${feeOrdersSet.size}`);
        console.log(`Total Refund Fees: ${totalFees}`);

        if (refundDocs.length > 0) {
            console.log("Sample Refund Doc:", JSON.stringify(refundDocs[0], null, 2));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
checkDecRefunds();
