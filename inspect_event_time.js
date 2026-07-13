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

async function inspectEventData() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const aId = "39455";
        
        console.log(`Inspecting data for ActivityID: ${aId}`);
        const session = await db.collection("QwareTrafficSession").findOne({ ActivityID: aId });
        if (session) {
            console.log("Session CreateTime sample:", session.CreateTime);
        }
        
        // Let's find any record for 2026-03-09 for this ID
        const samples = await db.collection("QwareTrafficSession")
            .find({ ActivityID: aId, CreateTime: { $regex: "^2026-03-09" } })
            .limit(5)
            .toArray();
        console.log(`Samples for 2026-03-09: ${samples.length}`);
        samples.forEach(s => console.log(s.CreateTime, s.SessionCount));

        const samplesReads = await db.collection("QwareTrafficGAReadTime")
            .find({ ActivityID: aId, CreateTime: { $regex: "^2026-03-09" } })
            .limit(5)
            .toArray();
        console.log(`Read samples for 2026-03-09: ${samplesReads.length}`);
        samplesReads.forEach(s => console.log(s.CreateTime));

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
inspectEventData();
