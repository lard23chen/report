
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const ticketColl = db.collection('Qware_A_Ticket_data_Daily');
        const trafficColl = db.collection('QwareTrafficSession');
        const TARGET_NAME = '國泰世華銀行2026韋禮安「 HI WE1 韋，您好 巡迴演唱會」台北場';
        
        const dates = ['2026-03-14', '2026-03-21'];
        for (const d of dates) {
            console.log(`\n--- Checking ${d} ---`);
            const ticketCount = await ticketColl.countDocuments({ 
                '節目/商品名稱': TARGET_NAME, 
                '交易時間': { $regex: '^' + d } 
            });
            console.log(`Tickets on ${d}:`, ticketCount);
            
            // Look for peak minutes in tickets
            const peakMins = await ticketColl.aggregate([
                { $match: { '節目/商品名稱': TARGET_NAME, '交易時間': { $regex: '^' + d } } },
                { $group: { _id: { minute: { $substr: ["$交易時間", 11, 5] } }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 3 }
            ]).toArray();
            console.log("Peak minutes in tickets:", JSON.stringify(peakMins, null, 2));

            // Look for top ActivityIDs on this day (might be different from my assumed one)
            const topActivities = await trafficColl.aggregate([
                { $match: { CreateTime: { $regex: '^' + d } } },
                { $group: { _id: "$ActivityID", name: { $first: "$ActivityInfoName" }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]).toArray();
            console.log("Top ActivityIDs (Traffic) on this day:", JSON.stringify(topActivities, null, 2));
        }
    } catch(err) {
        console.error(err);
    } finally {
        await client.close();
    }
}
run();
