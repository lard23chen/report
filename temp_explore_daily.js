require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const coll = db.collection("Qware_A_Ticket_data_Daily");
        
        const count = await coll.countDocuments();
        console.log("Total records in Qware_A_Ticket_data_Daily:", count);
        
        const sample = await coll.findOne({});
        console.log("Sample document:");
        console.log(JSON.stringify(sample, null, 2));

        // Let's get the earliest and latest _timestamp
        const earliest = await coll.find({}).sort({_timestamp: 1}).limit(1).toArray();
        const latest = await coll.find({}).sort({_timestamp: -1}).limit(1).toArray();
        if (earliest.length > 0) console.log("Earliest:", earliest[0].OrderDate, earliest[0]._timestamp);
        if (latest.length > 0) console.log("Latest:", latest[0].OrderDate, latest[0]._timestamp);

    } finally {
        await client.close();
    }
}
run().catch(console.dir);
