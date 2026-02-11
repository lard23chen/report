
const { MongoClient, ServerApiVersion } = require('mongodb');

// MongoDB Connection Setup
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

        const data = await collection.find({ "交易時間": { $regex: "^2026-02" } }).toArray();

        const validOrders = data.filter(d => d['狀態'] === '正常');
        // Refund logic matches the script logic:
        const refundDocs = data.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');

        const totalRevenue = validOrders.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
        const totalTickets = validOrders.length;

        // Orders (Unique IDs)
        const uniqueOrdersSet = new Set();
        validOrders.forEach(o => {
            if (o['訂單編號']) {
                const baseOrder = o['訂單編號'].split('_')[0];
                uniqueOrdersSet.add(baseOrder);
            }
        });
        const orderCount = uniqueOrdersSet.size;

        // Refund Fees
        const totalRefundFees = data.reduce((acc, cur) => acc + (cur['手續費'] || 0), 0);

        // Refund Orders count
        const refundOrdersSet = new Set();
        refundDocs.forEach(d => {
            if (d['訂單編號']) {
                const baseOrder = d['訂單編號'].split('_')[0];
                refundOrdersSet.add(baseOrder);
            }
        });

        // Also check if any other docs have fees > 0, they might be partial refunds not fully marked as refunded status? script says:
        // const refundRecords = dbData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票' || (d['手續費'] && d['手續費'] > 0));

        const refundRecords = data.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票' || (d['手續費'] && d['手續費'] > 0));
        const totalRefundOrdersSet = new Set();
        refundRecords.forEach(d => {
            if (d['訂單編號']) {
                const baseOrder = d['訂單編號'].split('_')[0];
                totalRefundOrdersSet.add(baseOrder);
            }
        });

        console.log("JSON_OUTPUT_START");
        console.log(JSON.stringify({
            orders: orderCount,
            tickets: totalTickets,
            revenue: totalRevenue,
            refundOrders: totalRefundOrdersSet.size,
            refundFees: totalRefundFees
        }));
        console.log("JSON_OUTPUT_END");

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
getStats();
