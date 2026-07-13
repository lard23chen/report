require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI_DMP;

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const dbsToTry = ['QwareDashBoard', 'QwareDashboard', 'Qware_DMP', 'GoogleAnalytics', 'DMP_Qware', 'analytics_351586022', 'events', 'GA4', 'analytics_202602'];

        for (let dbName of dbsToTry) {
            try {
                const colls = await client.db(dbName).listCollections().toArray();
                console.log(`BINGO! db: ${dbName} has ${colls.length} collections.`);
                colls.forEach(c => console.log(` - ${c.name}`));
            } catch (err) {
                // Not logging everything, just unauthorized
            }
        }
    } finally {
        await client.close();
    }
}
run();
