const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function checkJan7Sales() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        // Find sales on January 7, 2026
        const jan7Data = await collection.find({
            '交易時間': { $regex: '^2026-01-07' },
            '狀態': '正常'
        }).toArray();

        console.log(`Total records on 2026-01-07: ${jan7Data.length}`);

        // Group by event name
        const eventStats = {};
        jan7Data.forEach(d => {
            const eventName = d['節目/商品名稱'] || 'Unknown';
            if (!eventStats[eventName]) {
                eventStats[eventName] = { count: 0, revenue: 0 };
            }
            eventStats[eventName].count++;
            eventStats[eventName].revenue += (d['售價'] || 0);
        });

        // Sort by revenue
        const sorted = Object.entries(eventStats)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.revenue - a.revenue);

        console.log('\n=== Top Events on 2026-01-07 ===');
        sorted.slice(0, 10).forEach((e, i) => {
            console.log(`${i + 1}. ${e.name}`);
            console.log(`   Revenue: $${e.revenue.toLocaleString()}, Tickets: ${e.count}`);
        });

        // Also check what date Sam Lee concert started selling
        const samLeeData = await collection.find({
            '節目/商品名稱': '2025李聖傑 One Day直到那一天 世界巡迴演唱會 台北站',
            '狀態': '正常'
        }).sort({ '交易時間': 1 }).limit(5).toArray();

        console.log('\n=== Sam Lee First Sales ===');
        samLeeData.forEach(d => {
            console.log(`Date: ${d['交易時間']}, Price: $${d['售價']}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkJan7Sales();
