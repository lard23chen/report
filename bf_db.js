require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_DMP;
async function run() {
    const client = new MongoClient(uri);
    await client.connect();

    const dbs = [
        'GoogleAnalytics', 'GA', 'GA4', 'analytics_351586022', 'QwareAi', 'QwareDashboard',
        'DMP', 'DMP_GA', 'qware_dmp', 'qware-dmp', 'Qware_DMP', 'page_view', 'events',
        'prod', 'QwareTickets', 'Qware_Ticket', 'Qware_Ticket_Data', 'admin', 'local'
    ];

    console.log("Starting DB auth checks:");
    for (let d of dbs) {
        try {
            const arr = await client.db(d).listCollections().toArray();
            console.log(`[SUCCESS] => ${d} has ${arr.length} collections`);
            arr.forEach(c => console.log(`   - ${c.name}`));
        } catch (e) {
            if (!e.message.includes("not authorized")) {
                console.log(`[ERROR] ${d}: ${e.message}`);
            }
        }
    }
    client.close();
}
run();
