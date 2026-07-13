require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const fs = require('fs');

const MONGO_URI = process.env.MONGODB_URI_PERSONAL;
const DB_NAME = 'AlexLIFE';
const COLLECTION_NAME = 'Insurance'; // matches insurance_server.js

async function sync() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const data = await db.collection(COLLECTION_NAME).find({}).toArray();

        // Convert ObjectId to string for JSON serialization
        const serialized = data.map(doc => ({
            ...doc,
            _id: doc._id.toString()
        }));

        fs.writeFileSync('insurance_data.json', JSON.stringify(serialized, null, 2), 'utf8');
        console.log(`Synced ${serialized.length} records to insurance_data.json`);
        if (serialized.length > 0) {
            console.log('Sample fields:', Object.keys(serialized[0]).join(', '));
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.close();
    }
}

sync();
