
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectNewData() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        const docs = await collection.find({}).limit(3).toArray();
        if (docs.length === 0) {
            console.log("No documents found in Qware_Ticket_Data");
        } else {
            console.log("First document structure:", JSON.stringify(docs[0], null, 2));

            // Check specific fields used in report
            const fieldsToCheck = ['狀態', '售價', '節目商品名稱', '交易時間', '付款方式', '退票手續費', '銷售點'];
            console.log("\nChecking essential fields:");
            docs.forEach((d, i) => {
                const missing = fieldsToCheck.filter(f => d[f] === undefined);
                console.log(`Doc ${i + 1} missing fields:`, missing.length > 0 ? missing : 'None');
                if (missing.length > 0) console.log("  Sample keys present:", Object.keys(d));
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectNewData();
