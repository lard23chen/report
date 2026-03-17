
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function findEventData() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const eventName = "中華職棒37年例行賽統一獅主場（上）";
        
        console.log(`Searching for event: ${eventName}`);
        const event = await db.collection("QwareTrafficSession").findOne({ ActivityInfoName: { $regex: eventName } });
        
        if (event) {
            console.log("Event found:", event.ActivityID, event.ActivityInfoName);
            const startTime = "2026-03-09 18:00";
            const endTime = "2026-03-09 23:59";
            
            const sessions = await db.collection("QwareTrafficSession")
                .find({ 
                    ActivityID: event.ActivityID,
                    CreateTime: { $gte: startTime, $lte: endTime }
                })
                .count();
            console.log(`Sessions found: ${sessions}`);
            
            const reads = await db.collection("QwareTrafficGAReadTime")
                .find({ 
                    ActivityID: event.ActivityID,
                    CreateTime: { $gte: startTime, $lte: endTime }
                })
                .count();
            console.log(`GAReadTime found: ${reads}`);
        } else {
            console.log("Event not found.");
            // List some recent events to see naming
            const recent = await db.collection("QwareTrafficSession").find().sort({CreateTime: -1}).limit(10).toArray();
            console.log("Recent events:");
            recent.forEach(r => console.log(`[${r.CreateTime}] ${r.ActivityInfoName}`));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
findEventData();
