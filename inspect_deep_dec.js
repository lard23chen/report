const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectDeepDec() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Deep searching for '2025-12' or refund data...");

        // 1. Get a sample document to list all keys
        const sample = await collection.findOne();
        if (sample) {
            console.log("All Keys:", Object.keys(sample));
        }

        // 2. Search for ANY field containing '2025-12' AND status '退票'
        // This is expensive but needed. Actually, just check if ANY record matching status '退票' has a date field in Dec.
        const refundSample = await collection.findOne({ '狀態': { $in: ['退票', '已退票'] } });
        if (refundSample) {
            console.log("\nSample Refund Record:");
            console.log(JSON.stringify(refundSample, null, 2));
        }

        // 3. Check count of Refunds where ANY field matches 2025-12
        // We can use $or across known date fields
        const dateFields = ['交易時間', '退票時間', '演出時間/規格', '取票時間', 'EventDate', 'RefundDate', 'OrderDate'];

        const query = {
            $or: [],
            '狀態': { $in: ['退票', '已退票'] }
        };

        // Add regex checks for known fields
        dateFields.forEach(f => {
            query.$or.push({ [f]: { $regex: /2025[-/]12/ } });
        });

        // Also check if status is NOT normal, regardless of date, just to see if there are ANY non-Jan refunds
        const nonJanRefunds = await collection.countDocuments({
            '狀態': { $in: ['退票', '已退票'] },
            '交易時間': { $not: { $regex: /^2026-01/ } }
        });
        console.log(`\nRefunds with '交易時間' NOT in 2026-01: ${nonJanRefunds}`);
        if (nonJanRefunds > 0) {
            const others = await collection.find({
                '狀態': { $in: ['退票', '已退票'] },
                '交易時間': { $not: { $regex: /^2026-01/ } }
            }).limit(5).toArray();
            console.log("Sample Non-Jan Refund:", JSON.stringify(others[0], null, 2));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectDeepDec();
