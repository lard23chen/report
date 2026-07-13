require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI_PERSONAL;

async function findTravelCollections() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        
        for (const dbInfo of dbs.databases) {
            const dbName = dbInfo.name;
            const db = client.db(dbName);
            const collections = await db.listCollections().toArray();
            
            for (const col of collections) {
                if (col.name.toLowerCase().includes('travel')) {
                    console.log(`Found collection: ${dbName}.${col.name}`);
                    const count = await db.collection(col.name).countDocuments();
                    console.log(`  - Documents: ${count}`);
                    if (count > 0) {
                        const docs = await db.collection(col.name).find({}).toArray();
                        for (const doc of docs) {
                            if (JSON.stringify(doc).toLowerCase().includes('test')) {
                                console.log(`  - Match in doc _id: ${doc._id}`);
                                console.log(JSON.stringify(doc, null, 2));
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

findTravelCollections();
