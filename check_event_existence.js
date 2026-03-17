
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function checkEventExistence() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const eventName = "中華職棒37年例行賽統一獅主場（上）";
        
        console.log(`Checking event: ${eventName}`);
        const sample = await db.collection("QwareTrafficSession").findOne({ ActivityInfoName: { $regex: eventName } });
        console.log("Found sample:", sample);
        
        if (sample) {
            const aId = sample.ActivityID;
            console.log("ActivityID type:", typeof aId);
            const count = await db.collection("QwareTrafficSession").countDocuments({ ActivityID: aId });
            console.log(`Total records for this ActivityID: ${count}`);
            
            const timeSample = await db.collection("QwareTrafficSession").find({ ActivityID: aId }).limit(1).toArray();
            console.log("Time format in DB:", timeSample[0].CreateTime);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
checkEventExistence();
