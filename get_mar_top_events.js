require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function getTopEvents() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Aggregating Top Events for 2026-03...");
        const topEvents = await collection.aggregate([
            { $match: { "交易時間": { $regex: "^2026-03" }, "狀態": "正常" } },
            { $group: {
                _id: "$節目/商品名稱",
                revenue: { $sum: { $convert: { input: "$售價", to: "double", onError: 0, onNull: 0 } } },
                tickets: { $sum: 1 }
            }},
            { $sort: { revenue: -1 } },
            { $limit: 10 }
        ]).toArray();

        const fs = require('fs');
        fs.writeFileSync('mar_top_events.json', JSON.stringify(topEvents, null, 2));
        console.log("Results written to mar_top_events.json");

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

getTopEvents();
