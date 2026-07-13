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

        // Search for any ticket sale related to ActivityID 39455
        console.log("Searching for ticket sales matching ID 39455 in ALL collections...");
        
        const collections = ["Qware_A_Ticket_data_Daily", "Qware_Ticket_Data"];
        for(let col of collections) {
            const ticket = await db.collection(col).findOne({ ActivityID: 39455 });
            if(ticket) {
                console.log(`\nFound in ${col}:`);
                console.log("Event Name:", ticket["節目/商品名稱"]);
                return;
            }
        }
        
        // Fallback: search for sales on 3/9 at 18:00 specifically
        const startTime = "2026-03-09 18:00:00";
        const ticketByTime = await db.collection("Qware_A_Ticket_data_Daily").findOne({ "交易時間": { $gte: startTime } });
        if(ticketByTime) {
             console.log("\nFound ticket sale by time (>= 18:00):");
             console.log("Name:", ticketByTime["節目/商品名稱"]);
             console.log("Time:", ticketByTime["交易時間"]);
        } else {
             console.log("Still no ticket found.");
        }

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
