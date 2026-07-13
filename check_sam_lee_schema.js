require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient, ServerApiVersion } = require('mongodb');

// MongoDB Connection Setup
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function checkSamLeeData() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Fetching Sam Lee data...");
        // Fetch one record for Sam Lee
        const data = await collection.findOne({ "節目/商品名稱": "2025李聖傑 One Day直到那一天 世界巡迴演唱會 台北站" });

        if (data) {
            console.log("Data found. Keys:");
            console.log(Object.keys(data));
            console.log("Sales Point value:", data['銷售點']);
        } else {
            console.log("No data found for Sam Lee.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkSamLeeData();
