const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        let db = client.db('QwareAi');
        console.log("Collections in QwareAi:");
        let collections = await db.listCollections().toArray();
        collections.forEach(c => console.log(` - ${c.name}`));

        db = client.db('test');
        console.log("Collections in test:");
        collections = await db.listCollections().toArray();
        collections.forEach(c => console.log(` - ${c.name}`));

        db = client.db('admin');
        let dbs = await db.admin().listDatabases();
        console.log("Databases:", dbs.databases.map(d => d.name));

    } catch (err) {
        console.log('Error:', err.message);
    } finally {
        await client.close();
    }
}
run();
