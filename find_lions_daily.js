
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function findLionsDailyOrders() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const aId = 39455;
        const eventName = "中華職棒37年例行賽統一獅主場（上）";
        
        console.log(`Searching in Qware_A_Ticket_data_Daily for ${eventName}...`);
        
        const qStart = "2026-03-09 18";
        const qEndStr = "2026-03-09 23:59";
        
        const data = await db.collection("Qware_A_Ticket_data_Daily")
            .find({ 
                $or: [
                    { "節目/商品名稱": { $regex: eventName } },
                    { "ActivityID": aId }
                ],
                "交易時間": { $regex: "^2026-03-09" }
            })
            .toArray();
            
        console.log(`Total records for this event on 2026-03-09: ${data.length}`);
        
        if (data.length > 0) {
            const rangeData = data.filter(d => {
                const time = d['交易時間'];
                return time >= "2026-03-09 18:00" && time <= "2026-03-09 23:59";
            });
            console.log(`Records in range 18:00-23:59: ${rangeData.length}`);
            if (rangeData.length > 0) {
                console.log("Sample record:", JSON.stringify(rangeData[0], null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
findLionsDailyOrders();
