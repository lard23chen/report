const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function checkStatuses() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        const statuses = await collection.distinct('狀態');
        console.log("All Statuses:", statuses);

        // Count by status
        const counts = await collection.aggregate([
            { $group: { _id: "$狀態", count: { $sum: 1 } } }
        ]).toArray();
        console.log("Counts by Status:", counts);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkStatuses();
