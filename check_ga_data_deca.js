const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
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
