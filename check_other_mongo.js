const { MongoClient } = require('mongodb');

// The OTHER URI found in many files
const MONGO_URI = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

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
