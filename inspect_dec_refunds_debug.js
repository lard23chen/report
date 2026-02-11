const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectDecData() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Checking for any refunds...");
        // Check distinct statuses again
        const statuses = await collection.distinct('狀態');
        console.log("Distinct Statuses:", statuses);

        // Check for ANY record with '2025-12' in '交易時間' AND status '退票' or '已退票'
        const decRefunds = await collection.find({
            '交易時間': { $regex: /^2025-12/ },
            '狀態': { $in: ['退票', '已退票'] }
        }).toArray();

        console.log(`Found ${decRefunds.length} refund records with 交易時間 in 2025-12.`);

        if (decRefunds.length > 0) {
            console.log("Sample Dec Refund:", JSON.stringify(decRefunds[0], null, 2));
        } else {
            // Look for refunds that might have happened in Dec but transaction time is different?
            // Or maybe look for any refunds and see their dates
            console.log("No refunds found with '交易時間' starting with 2025-12.");

            console.log("Checking first 5 refunds ever:");
            const randomRefunds = await collection.find({ '狀態': { $in: ['退票', '已退票'] } }).limit(5).toArray();
            randomRefunds.forEach(r => {
                console.log(`Time: ${r['交易時間']}, Status: ${r['狀態']}, Fee: ${r['手續費']}`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectDecData();
