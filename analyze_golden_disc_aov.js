
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

async function analyze() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Fetching Golden Disc data...");
        // Fetch data for Golden Disc
        const data = await collection.find({ "節目/商品名稱": "第40屆金唱片頒獎典禮 The 40th Golden Disc Awards" }).toArray();

        const validOrders = data.filter(d => d['狀態'] === '正常');

        console.log(`Total Valid Tickets: ${validOrders.length}`);

        // 1. Calculate AOV
        const revenue = validOrders.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
        const orderMap = {}; // orderId -> { tickets: 0, revenue: 0 }

        validOrders.forEach(o => {
            if (o['訂單編號']) {
                const orderId = o['訂單編號'].split('_')[0];
                if (!orderMap[orderId]) orderMap[orderId] = { tickets: 0, revenue: 0 };
                orderMap[orderId].tickets += 1;
                orderMap[orderId].revenue += (o['售價'] || 0);
            }
        });

        const distinctOrders = Object.keys(orderMap).length;
        const aov = distinctOrders > 0 ? revenue / distinctOrders : 0;

        console.log(`Total Revenue: ${revenue}`);
        console.log(`Distinct Orders: ${distinctOrders}`);
        console.log(`AOV: ${Math.round(aov)}`);

        // 2. Analyze Ticket Prices
        const priceCounts = {};
        validOrders.forEach(o => {
            const p = o['售價'] || 0;
            priceCounts[p] = (priceCounts[p] || 0) + 1;
        });
        console.log("\n--- Price Distribution ---");
        Object.keys(priceCounts).sort((a, b) => b - a).forEach(p => {
            console.log(`Price $${p}: ${priceCounts[p]} tickets`);
        });

        // 3. Analyze Tickets per Order
        const ticketsPerOrderCounts = {};
        Object.values(orderMap).forEach(info => {
            const count = info.tickets;
            ticketsPerOrderCounts[count] = (ticketsPerOrderCounts[count] || 0) + 1;
        });
        console.log("\n--- Tickets per Order Distribution ---");
        Object.keys(ticketsPerOrderCounts).sort((a, b) => a - b).forEach(c => {
            console.log(`${c} tickets/order: ${ticketsPerOrderCounts[c]} orders`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

analyze();
