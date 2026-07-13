require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");

        const event = await db.collection("QwareTrafficSession").findOne({ ActivityID: 39455 });
        
        if (event) {
            console.log("ID: 39455");
            console.log("Raw Name from DB:", event.ActivityInfoName);
            
            // Try to detect other events on March 9th just in case
            const startTime = new Date("2026-03-09T00:00:00+08:00");
            const endTime = new Date("2026-03-09T23:59:59+08:00");
            const otherEvents = await db.collection("QwareTrafficSession").distinct("ActivityInfoName", {
                CreateTime: { $gte: startTime, $lte: endTime }
            });
            console.log("\nOther events on 3/9:");
            otherEvents.forEach(name => console.log("-", name));
        } else {
            console.log("No data found for ID 39455");
        }

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
