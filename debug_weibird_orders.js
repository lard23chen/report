require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function debug() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const eventName = "國泰世華銀行 2026 韋禮安 韋，您好 HI WE1巡迴演唱會";
        
        console.log(`Checking for event: ${eventName}`);

        // Check Qware_A_Ticket_data_Daily
        const dailyCount = await db.collection("Qware_A_Ticket_data_Daily").countDocuments({
            "節目/商品名稱": eventName
        });
        console.log(`Count in Qware_A_Ticket_data_Daily: ${dailyCount}`);
        if (dailyCount > 0) {
            const sample = await db.collection("Qware_A_Ticket_data_Daily").findOne({ "節目/商品名稱": eventName });
            console.log("Sample Daily Record:", JSON.stringify(sample, null, 2));
        }

        // Check Qware_Ticket_Data
        const histCount = await db.collection("Qware_Ticket_Data").countDocuments({
            "節目/商品名稱": eventName
        });
        console.log(`Count in Qware_Ticket_Data: ${histCount}`);
        if (histCount > 0) {
            const sample = await db.collection("Qware_Ticket_Data").findOne({ "節目/商品名稱": eventName });
            console.log("Sample Historical Record:", JSON.stringify(sample, null, 2));
        }

        // Maybe the name is slightly different? Check for partial match.
        const partialName = "韋禮安";
        const matches = await db.collection("Qware_A_Ticket_data_Daily").distinct("節目/商品名稱", {
            "節目/商品名稱": { $regex: partialName }
        });
        console.log(`Partial matches for '${partialName}' in Daily:`, matches);

        const histMatches = await db.collection("Qware_Ticket_Data").distinct("節目/商品名稱", {
            "節目/商品名稱": { $regex: partialName }
        });
        console.log(`Partial matches for '${partialName}' in Historical:`, histMatches);

    } finally {
        await client.close();
    }
}
debug();
