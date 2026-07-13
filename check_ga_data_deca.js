require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('QwareAi');
        const collections = ['Qware_A_Traffic_session_data', 'QwareTrafficSession'];
        
        for (const colName of collections) {
            console.log(`Checking collection: ${colName}`);
            const collection = db.collection(colName);
            const projects = await collection.distinct('ProjectName');
            console.log('Distinct ProjectNames:', projects);
            
            const docs = await collection.find({ 
                ProjectName: { $regex: 'deca joins', $options: 'i' } 
            }).limit(2).toArray();
            console.log('Sample docs:', JSON.stringify(docs, null, 2));
        }
    } finally {
        await client.close();
    }
}
run();
