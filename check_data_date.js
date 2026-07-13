require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
async function run() {
    const client = new MongoClient(uri);
    await client.connect();
    const doc = await client.db('QwareAi').collection('Qware_A_Ticket_data_Daily').findOne({'場次名稱': {$exists: true}});
    console.log(Object.keys(doc));
    console.log(doc['場次名稱'], doc['演出時間'], doc['演出日期'], doc['場次時間'], doc['場次日期']);
    await client.close();
}
run();
