require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI_DMP;

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const dbsToTry = ['QwareAi', 'QwareDMP', 'QwareDashboard', 'QwareTicket', 'DMP_GA', 'GA', 'Qware', 'DMP', 'admin'];

        for (let dbName of dbsToTry) {
            try {
                const colls = await client.db(dbName).listCollections().toArray();
                if (colls.length > 0) {
                    console.log(`BINGO! db: ${dbName} has ${colls.length} collections.`);
                    colls.forEach(c => console.log(` - ${c.name}`));
                } else {
                    console.log(`db: ${dbName} works but is empty.`);
                }
            } catch (err) {
                // not authorized...
            }
        }
    } finally {
        await client.close();
    }
}
run().catch(console.dir);
