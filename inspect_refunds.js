
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectRefunds() {
    try {
        await client.connect();
        const db = client.db("allticket");
        const collection = db.collection('Qware_DashBoard');

        // Check for distinct statuses
        const statuses = await collection.distinct('狀態');
        console.log("All Statuses:", statuses);

        // Check for records with refund fees > 0
        const refundFeeRecords = await collection.find({ '退票手續費': { $gt: 0 } }).limit(5).toArray();
        console.log("\nRecords with Refund Fee > 0:");
        refundFeeRecords.forEach(r => {
            console.log(`Event: ${r['節目商品名稱']}, Status: ${r['狀態']}, Fee: ${r['退票手續費']}, Reason: ${r['退票因素']}`);
        });

        // Check for Golden Disc Awards refunds
        const eventName = "第40屆金唱片頒獎典禮 The 40th Golden Disc Awards";
        const gdaRefunds = await collection.find({
            '節目商品名稱': eventName,
            '狀態': '退票'
        }).limit(5).toArray();

        console.log(`\nRefunds for ${eventName}:`, gdaRefunds.length);
        gdaRefunds.forEach(r => {
            console.log(`Status: ${r['狀態']}, Fee: ${r['退票手續費']} (Type: ${typeof r['退票手續費']}), Reason: ${r['退票因素']}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectRefunds();
