const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");

        console.log("Searching for deca joins in Qware_Ticket_Data...");
        const events = await db.collection("Qware_Ticket_Data").distinct("節目/商品名稱", { "節目/商品名稱": /deca/i });
        console.log("Found Events:", events);

        console.log("Searching for deca joins in QwareTrafficSession...");
        const activities = await db.collection("QwareTrafficSession").find({ ActivityName: /deca/i }).project({ ActivityID: 1, ActivityName: 1 }).limit(5).toArray();
        console.log("Found Activities:", activities);

        // Also find different sessions of deca joins
        for (const evt of events) {
            console.log(`Sessions for ${evt}:`);
            const sessions = await db.collection("Qware_Ticket_Data").distinct("場次名稱", { "節目/商品名稱": evt });
            console.log(sessions);
        }

    } finally {
        await client.close();
    }
}
run();
