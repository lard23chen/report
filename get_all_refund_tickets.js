
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function getStats() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        const months = ['2026-02', '2026-01', '2025-12', '2025-11', '2025-10'];
        const stats = {};

        for (const month of months) {
            const data = await collection.find({ "交易時間": { $regex: `^${month}` } }).toArray();

            // Logic for Refund Tickets: Status is '已退票' or '退票' OR has Fee > 0 (implying refund processed)
            const refundTickets = data.filter(d =>
                d['狀態'] === '已退票' ||
                d['狀態'] === '退票' ||
                (d['手續費'] && d['手續費'] > 0)
            ).length;

            stats[month] = refundTickets;
        }

        console.log("JSON_START");
        console.log(JSON.stringify(stats, null, 2));
        console.log("JSON_END");

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
getStats();
