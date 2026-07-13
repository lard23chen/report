require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('QwareAi');
        const collection = db.collection('Qware_Ticket_Data');
        
        const sessions = await collection.aggregate([
            { $match: { '場次名稱': { $regex: 'deca joins', $options: 'i' } } },
            { $group: { _id: '$場次代碼', name: { $first: '$場次名稱' } } }
        ]).toArray();
        
        console.log('Found sessions in Qware_Ticket_Data:', JSON.stringify(sessions, null, 2));
    } finally {
        await client.close();
    }
}
run();
