const { MongoClient } = require('mongodb');

// Maybe the user means allticket DB, which we got unauthorized for.
// But earlier 'inspectAllTicketDB' failed with unauthorized.
// The user provided 'QwareDashBoard:7hJpyIt33eNwoLro' which seems to only have access to 'QwareAi'.

// Let's try to list DATABASES to confirm what we can see.
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function listDatabases() {
    try {
        await client.connect();
        const adminDb = client.db().admin();
        const dbs = await adminDb.listDatabases();

        console.log("Databases available to this user:");
        dbs.databases.forEach(db => console.log(` - ${db.name}`));

    } catch (e) {
        console.error("Error listing databases:", e.message);
        // If not authorized to list DBs, we just have 'QwareAi' as known.
    } finally {
        await client.close();
    }
}

listDatabases();
