require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('QwareAi');
        const collection = db.collection('Qware_Ticket_Data');
        const ids = [ 'B0AQY9PL', 'B0ARAQUY', 'B0ARARJH', 'B0ARASAV', 'B0ARATMZ' ];
        
        console.log(`Searching for session IDs in Qware_Ticket_Data: ${ids.join(', ')}`);
        
        // Find one record for each ID to see the session name
        for (const id of ids) {
            const doc = await collection.findOne({ '場次代碼': id });
            if (doc) {
                console.log(`Found ID ${id}: ${doc['場次名稱']} (Project: ${doc['節目名稱']})`);
            } else {
                console.log(`ID ${id} not found in Qware_Ticket_Data`);
            }
        }
    } finally {
        await client.close();
    }
}
run();
