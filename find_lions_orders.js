
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function findOrderData() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const eventName = "中華職棒37年例行賽統一獅主場（上）";
        
        console.log(`Searching for event in Qware_Ticket_Data: ${eventName}`);
        const sample = await db.collection("Qware_Ticket_Data").findOne({ "節目/商品名稱": { $regex: eventName } });
        
        if (sample) {
            console.log("Event found in Qware_Ticket_Data:", sample['節目/商品名稱']);
            const qStart = "^2026-03-09 18"; // Simple prefix search for the hour range
            const count = await db.collection("Qware_Ticket_Data").countDocuments({ 
                "節目/商品名稱": sample['節目/商品名稱'],
                "交易時間": { $regex: "^2026-03-09" }
            });
            console.log(`Total records for this event on 2026-03-09: ${count}`);
        } else {
            console.log("Event not found in Qware_Ticket_Data.");
            // Try searching by ActivityID if it's there
            const sampleById = await db.collection("Qware_Ticket_Data").findOne({ "ActivityID": 39455 });
            if (sampleById) {
                console.log("Found by ActivityID:", sampleById['節目/商品名稱']);
            } else {
                console.log("Search for some recent entries in Qware_Ticket_Data...");
                const recent = await db.collection("Qware_Ticket_Data").find().sort({_id: -1}).limit(5).toArray();
                recent.forEach(r => console.log(`[${r['交易時間']}] ${r['節目/商品名稱']}`));
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
findOrderData();
