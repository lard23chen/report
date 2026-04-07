const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';
const DB_NAME   = 'AlexLIFE';
const COL_STORE = 'TravelStore';
const DOC_ID    = 'store';

async function checkStore() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const doc = await db.collection(COL_STORE).findOne({ _id: DOC_ID });
        
        if (!doc) {
            console.log("No store document found.");
            return;
        }

        console.log("Store Data Keys:", Object.keys(doc.data));
        
        let foundTest = false;
        if (doc.data.added) {
            for (const tbId in doc.data.added) {
                const rows = doc.data.added[tbId];
                const originalCount = rows.length;
                doc.data.added[tbId] = rows.filter(row => {
                    const html = (typeof row === 'string') ? row : row.html;
                    if (html.toLowerCase().includes('test')) {
                        console.log(`Found test row in ${tbId}:`, html);
                        foundTest = true;
                        return false;
                    }
                    return true;
                });
                if (doc.data.added[tbId].length !== originalCount) {
                    console.log(`Removed ${originalCount - doc.data.added[tbId].length} test rows from ${tbId}`);
                }
            }
        }

        if (foundTest) {
            await db.collection(COL_STORE).replaceOne({ _id: DOC_ID }, doc);
            console.log("✅ Updated store to remove test entries.");
        } else {
            console.log("No 'test' entries found in 'added' rows.");
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

checkStore();
