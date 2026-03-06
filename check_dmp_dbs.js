const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const dbs = await client.db().admin().listDatabases();
        console.log("Databases:");
        dbs.databases.forEach(db => console.log(` - ${db.name}`));

        // check GoogleAnalytics collections
        const db = client.db("GoogleAnalytics");
        const collections = await db.listCollections().toArray();
        console.log("\nCollections in GoogleAnalytics:");
        collections.forEach(c => console.log(` - ${c.name}`));

        // let's peek into GA_Events_List or whichever sounds relevant
    } finally {
        await client.close();
    }
}
run();
