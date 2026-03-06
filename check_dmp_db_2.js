const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const dbs = ['GoogleAnalytics', 'QwareAi', 'GA', 'DMP', 'dmp'];

        for (let dbName of dbs) {
            try {
                console.log(`Checking DB: ${dbName}`);
                const db = client.db(dbName);
                const colS = await db.collection("events").findOne({});
                if (colS) console.log(`Found events in ${dbName}`);
                else console.log(`No events doc in ${dbName}`);

                const col2 = await db.collection("events_202602").findOne({});
                if (col2) console.log(`Found events_202602 in ${dbName}`);

                // Check other common GA names
                const collections = ['GA_Events', 'event', 'pageviews', 'events_intraday_202602', 'analytics'];
                for (let c of collections) {
                    const doc = await db.collection(c).findOne({});
                    if (doc) console.log(`Found ${c} in ${dbName}`);
                }
            } catch (err) {
                console.log(`Error on DB ${dbName}: ${err.message}`);
            }
        }

    } finally {
        await client.close();
    }
}
run();
