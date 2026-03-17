
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function findAnythingOnMarch9() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        
        console.log("Searching for any activity in Qware_Ticket_Data on 2026-03-09 18:00-23:59...");
        const samples = await db.collection("Qware_Ticket_Data")
            .find({ "交易時間": { $regex: "^2026-03-09 (18|19|20|21|22|23)" } })
            .limit(10)
            .toArray();
            
        if (samples.length > 0) {
            console.log(`Found ${samples.length} samples:`);
            samples.forEach(s => console.log(`[${s['交易時間']}] ${s['節目/商品名稱']}`));
        } else {
            console.log("Nothing found in Qware_Ticket_Data. Trying different date format...");
            const samples2 = await db.collection("Qware_Ticket_Data")
                .find({ "交易時間": { $regex: "^2026/03/09 (18|19|20|21|22|23)" } })
                .limit(10)
                .toArray();
            if (samples2.length > 0) {
                console.log(`Found ${samples2.length} samples with slashes:`);
                samples2.forEach(s => console.log(`[${s['交易時間']}] ${s['節目/商品名稱']}`));
            } else {
                console.log("Still nothing. Searching by ActivityID 39455 for all dates...");
                const allLions = await db.collection("Qware_Ticket_Data").find({ "ActivityID": 39455 }).limit(5).toArray();
                if (allLions.length > 0) {
                    allLions.forEach(s => console.log(`[${s['交易時間']}] ${s['節目/商品名稱']}`));
                } else {
                    // Try to find ANY record in March
                    const march = await db.collection("Qware_Ticket_Data").find({"交易時間": {$regex: "^2026-03"}}).limit(5).toArray();
                    console.log("Any March records?", march.length);
                    march.forEach(s => console.log(`[${s['交易時間']}] ${s['節目/商品名稱']}`));
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
findAnythingOnMarch9();
