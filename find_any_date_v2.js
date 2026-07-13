require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function findAnyDate() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const aId = "39455";
        
        console.log(`Finding all dates for ActivityID: ${aId}`);
        const sample = await db.collection("QwareTrafficSession").find({ ActivityID: aId }).sort({CreateTime: -1}).limit(20).toArray();
        sample.forEach(s => console.log(s.CreateTime));

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
findAnyDate();
