require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function inspectNullStatus() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        const nullRecords = await collection.find({ '狀態': null }).limit(5).toArray();
        console.log("Sample Null Status Records:");
        nullRecords.forEach(r => {
            console.log(`Time: ${r['交易時間']}, Status: ${r['狀態']}, Price: ${r['售價']}, Fee: ${r['手續費']}, Event: ${r['節目/商品名稱']}`);
        });

        const nullCount = await collection.countDocuments({ '狀態': null });
        console.log(`Total Null Status Count: ${nullCount}`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectNullStatus();
