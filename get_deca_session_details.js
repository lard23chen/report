const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('QwareAi');
        const ids = [ 'B0ARARJH', 'B0AQY9PL', 'B0ARAQUY', 'B0ARASAV', 'B0ARATMZ' ];
        
        const details = await db.collection('Qware_Ticket_Data').aggregate([
            { $match: { '場次代碼': { $in: ids } } },
            { $group: { 
                _id: '$場次代碼', 
                name: { $first: '$場次名稱' }, 
                time: { $first: '$演出時間/規格' } 
            } }
        ]).toArray();
        
        console.log(JSON.stringify(details, null, 2));
    } finally {
        await client.close();
    }
}
run();
