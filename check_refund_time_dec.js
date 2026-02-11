const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function checkRefundTimeDec() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Checking for records with '退票時間' in 2025-12...");

        const decRefunds = await collection.find({
            '退票時間': { $regex: /^2025-12/ }
        }).toArray();

        console.log(`Found ${decRefunds.length} records with '退票時間' in 2025-12.`);

        if (decRefunds.length > 0) {
            console.log("Sample Dec Refund Time Record:", JSON.stringify(decRefunds[0], null, 2));
            // Check its Transaction Time
            console.log("Transaction Time for this record:", decRefunds[0]['交易時間']);
        } else {
            // Maybe format is different? e.g. 2025/12 or something
            const allRefundTimes = await collection.distinct('退票時間');
            const decTimes = allRefundTimes.filter(t => t && (t.startsWith('2025-12') || t.startsWith('2025/12')));
            console.log("Distinct Refund Times starting with 2025-12:", decTimes);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkRefundTimeDec();
