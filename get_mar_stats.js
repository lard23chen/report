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

async function getStats() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Fetching data for 2026-03...");
        const data = await collection.find({ "交易時間": { $regex: "^2026-03" } }).toArray();
        console.log(`Fetched ${data.length} records.`);

        const validOrders = data.filter(d => d['狀態'] === '正常');
        const refundDocs = data.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票' || (d['手續費'] && d['手續費'] > 0));

        // Purchase Stats
        const totalRevenue = validOrders.reduce((acc, cur) => acc + (Number(cur['售價']) || 0), 0);
        const totalTickets = validOrders.length;
        const uniqueOrdersSet = new Set();
        validOrders.forEach(o => {
            if(o['訂單編號']) {
                const baseOrder = o['訂單編號'].split('_')[0];
                uniqueOrdersSet.add(baseOrder);
            }
        });
        const orderCount = uniqueOrdersSet.size;

        // Refund Stats
        const totalRefundTickets = refundDocs.length;
        const totalRefundFees = data.reduce((acc, cur) => acc + (Number(cur['手續費']) || 0), 0);
        const uniqueRefundOrdersSet = new Set();
        refundDocs.forEach(o => {
            if(o['訂單編號']) {
                const baseOrder = o['訂單編號'].split('_')[0];
                uniqueRefundOrdersSet.add(baseOrder);
            }
        });
        const refundOrderCount = uniqueRefundOrdersSet.size;

        const stats = {
            month: "2026-03",
            orderCount,
            totalTickets,
            totalRevenue,
            refundOrderCount,
            totalRefundTickets,
            totalRefundFees
        };
        console.log(JSON.stringify(stats, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

getStats();
