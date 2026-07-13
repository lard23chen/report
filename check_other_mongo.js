require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');

// The OTHER URI found in many files
const MONGO_URI = process.env.MONGODB_URI_QWARE;

async function listDatabases() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        console.log("Databases on FOR-AWS-LOADTEST:", dbs.databases.map(d => d.name));
        
        for (const dbInfo of dbs.databases) {
            const db = client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();
            const names = collections.map(c => c.name);
            console.log(`- ${dbInfo.name}:`, names);
            
            if (names.includes('TravelStore') || names.includes('Travel')) {
                console.log(`  >>> FOUND TRAVEL DATA IN ${dbInfo.name} <<<`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

listDatabases();
