
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectDecRefunds() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Querying for 2025-12 data...");

        // 1. Total December Records
        const totalDec = await collection.countDocuments({ "交易時間": { $regex: "^2025-12" } });
        console.log(`Total records in 2025-12: ${totalDec}`);

        // 2. Refunds in December (Status based)
        const refundsStatus = await collection.countDocuments({
            "交易時間": { $regex: "^2025-12" },
            "狀態": { $in: ['退票', '已退票'] }
        });
        console.log(`Refunds (Status='退票'/'已退票') in 2025-12: ${refundsStatus}`);

        // 3. Refunds in December (Fee based)
        const refundsFee = await collection.countDocuments({
            "交易時間": { $regex: "^2025-12" },
            "手續費": { $gt: 0 }
        });
        console.log(`Refunds (Fee > 0) in 2025-12: ${refundsFee}`);

        // 4. Sample Refund Doc if any
        if (refundsStatus > 0) {
            const sample = await collection.findOne({
                "交易時間": { $regex: "^2025-12" },
                "狀態": { $in: ['退票', '已退票'] }
            });
            console.log("\nSample Refund Doc (2025-12):", JSON.stringify(sample, null, 2));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectDecRefunds();
