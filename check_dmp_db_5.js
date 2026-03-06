const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/";

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
