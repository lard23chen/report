require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI_PERSONAL;
const DB_NAME   = 'AlexLIFE';
const COL_NAME  = 'Travel';

async function searchEverywhere() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const docs = await db.collection(COL_NAME).find({}).toArray();
        
        console.log(`Searching in ${docs.length} docs...`);
        
        for (const doc of docs) {
            const found = findInObj(doc, 'test');
            if (found.length > 0) {
                console.log(`\nMatch in doc _id: ${doc._id}`);
                found.forEach(f => console.log(`  - ${f.path}: ${f.value}`));
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

function findInObj(obj, target, path = '') {
    let results = [];
    for (let key in obj) {
        const val = obj[key];
        const curPath = path ? `${path}.${key}` : key;
        if (typeof val === 'string') {
            if (val.toLowerCase().includes(target.toLowerCase())) {
                results.push({ path: curPath, value: val });
            }
        } else if (typeof val === 'object' && val !== null) {
            results = results.concat(findInObj(val, target, curPath));
        }
    }
    return results;
}

searchEverywhere();
