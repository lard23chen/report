const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';
const DB_NAME   = 'AlexLIFE';

async function listCollections() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collections = await db.listCollections().toArray();
        console.log("Collections in " + DB_NAME + ":", collections.map(c => c.name));
        
        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`- ${col.name}: ${count} docs`);
            if (count > 0) {
                const sample = await db.collection(col.name).findOne();
                console.log(`  Sample _id: ${sample._id}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

listCollections();
