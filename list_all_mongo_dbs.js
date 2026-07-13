require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI_PERSONAL;

async function listDatabases() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        console.log("Databases:", dbs.databases.map(d => d.name));
        
        for (const dbInfo of dbs.databases) {
            const db = client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();
            console.log(`- ${dbInfo.name}:`, collections.map(c => c.name));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

listDatabases();
