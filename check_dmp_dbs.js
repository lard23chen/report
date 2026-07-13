require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI_DMP;

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
