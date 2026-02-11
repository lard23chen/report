const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectAllTicketDB() {
    try {
        await client.connect();

        // Check 1: allticket.Qware_DashBoard
        const db1 = client.db("allticket");
        const col1 = db1.collection('Qware_DashBoard');

        const count1 = await col1.countDocuments({
            '交易時間': { $regex: /^2025-12/ },
            '狀態': { $in: ['退票', '已退票'] }
        });
        console.log(`allticket.Qware_DashBoard Dec Refunds: ${count1}`);

        // Check 2: QwareAi.Qware_Ticket_Data
        const db2 = client.db("QwareAi");
        const col2 = db2.collection('Qware_Ticket_Data');

        const count2 = await col2.countDocuments({
            '交易時間': { $regex: /^2025-12/ },
            '狀態': { $in: ['退票', '已退票'] }
        });
        console.log(`QwareAi.Qware_Ticket_Data Dec Refunds: ${count2}`);

        if (count1 > 0 && count2 === 0) {
            console.log("\nFound refunds in 'allticket' but not 'QwareAi'. This suggests we might be using the wrong database/collection for the report.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectAllTicketDB();
