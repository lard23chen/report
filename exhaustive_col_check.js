require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function listAllCollections() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collections = await db.listCollections().toArray();
        console.log("Collections in QwareAi:");
        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(` - ${col.name}: ${count} docs`);
            if (col.name.includes("Ticket") || col.name.includes("Sales") || col.name.includes("Order")) {
                 const sample = await db.collection(col.name).findOne({});
                 if (sample) {
                     console.log(`    Sample key for time: ${Object.keys(sample).find(k => k.includes("時間") || k.includes("Time"))}`);
                     // Check for March 9
                     const march = await db.collection(col.name).findOne({
                         $or: [
                             { "交易時間": { $regex: "2026-03-09" } },
                             { "CreateTime": { $regex: "2026-03-09" } },
                             { "CreateTime": { $gte: new Date("2026-03-09"), $lte: new Date("2026-03-10") } }
                         ]
                     });
                     console.log(`    March 9 record? ${march ? 'Yes' : 'No'}`);
                 }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
listAllCollections();
