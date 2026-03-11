const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
async function run() {
    const client = new MongoClient(uri);
    await client.connect();
    const doc = await client.db('QwareAi').collection('Qware_A_Ticket_data_Daily').findOne({'場次名稱': {$exists: true}});
    console.log(Object.keys(doc));
    console.log(doc['場次名稱'], doc['演出時間'], doc['演出日期'], doc['場次時間'], doc['場次日期']);
    await client.close();
}
run();
