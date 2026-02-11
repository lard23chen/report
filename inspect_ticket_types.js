
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectTicketTypes() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Fetching unique '取票方式' values...");
        const distinctTypes = await collection.distinct('取票方式', {});
        console.log("Distinct Ticket Types:", distinctTypes);

        // Also check counts for each type in Dec 2025
        console.log("\nCounts for Dec 2025:");
        const pipeline = [
            { $match: { "交易時間": { $regex: "^2025-12" } } },
            { $group: { _id: "$取票方式", count: { $sum: 1 } } }
        ];
        const counts = await collection.aggregate(pipeline).toArray();
        console.log(counts);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectTicketTypes();
