const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';

async function findStoreEverywhere() {
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
                const doc = await db.collection(col.name).findOne({ _id: 'store' });
                if (doc) {
                    console.log(`\n>>> FOUND STORE in ${dbName}.${col.name}`);
                    console.log(JSON.stringify(doc, null, 2));
                    
                    // If it contains "test", we can fix it!
                    if (JSON.stringify(doc).toLowerCase().includes('test')) {
                        console.log("This store contains 'test' data.");
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

findStoreEverywhere();
