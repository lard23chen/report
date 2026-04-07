const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';
const DB_NAME   = 'AlexLIFE';
const COL_NAME  = 'Travel';

async function listAllTrips() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const docs = await db.collection(COL_NAME).find({}).toArray();
        
        console.log(JSON.stringify(docs, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

listAllTrips();
