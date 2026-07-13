require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
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
