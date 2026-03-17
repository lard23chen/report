
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function findEventData() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const aId = 39455;
        const start = new Date("2026-03-09T10:00:00Z"); // Adjusted for UTC? Let's check 18:00 local
        // 2026/03/09 18:00 (Local) -> 10:00 UTC
        // 2026/03/09 23:59 (Local) -> 15:59 UTC
        
        const qStart = new Date("2026-03-09T18:00:00+08:00");
        const qEnd = new Date("2026-03-09T23:59:59+08:00");

        console.log(`Searching for ActivityID: ${aId} between ${qStart.toISOString()} and ${qEnd.toISOString()}`);
        
        const sessions = await db.collection("QwareTrafficSession")
            .find({ 
                ActivityID: aId,
                CreateTime: { $gte: qStart, $lte: qEnd }
            })
            .sort({ CreateTime: 1 })
            .toArray();
        console.log(`Sessions found: ${sessions.length}`);
        
        const reads = await db.collection("QwareTrafficGAReadTime")
            .find({ 
                ActivityID: aId,
                CreateTime: { $gte: qStart, $lte: qEnd }
            })
            .sort({ CreateTime: 1 })
            .toArray();
        console.log(`GAReadTime found: ${reads.length}`);

        if (sessions.length > 0) {
            console.log("First session time:", sessions[0].CreateTime);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
findEventData();
