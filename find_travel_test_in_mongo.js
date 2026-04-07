const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';
const DB_NAME   = 'AlexLIFE';
const COL_NAME  = 'Travel';

async function findTestData() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const docs = await db.collection(COL_NAME).find({}).toArray();
        
        console.log(`Found ${docs.length} documents in ${COL_NAME}.`);
        
        for (const doc of docs) {
            const docStr = JSON.stringify(doc);
            if (docStr.toLowerCase().includes('test')) {
                console.log(`- Match found in doc _id: ${doc._id}`);
                // Print specific fields that contain 'test'
                if (doc.hotels) {
                   doc.hotels.forEach((h, i) => {
                       if (JSON.stringify(h).toLowerCase().includes('test')) {
                           console.log(`  Hotel[${i}]:`, h);
                       }
                   });
                }
                // Also check passengers/flights if needed
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

findTestData();
