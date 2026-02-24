const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
async function run() {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('QwareAi');
    const c = db.collection('Qware_Ticket_Data_Esys');
    const r = await c.aggregate([{ $group: { _id: { $substr: ['$交易時間', 0, 7] }, count: { $sum: 1 } } }]).toArray();
    console.log(r);
    await client.close();
}
run().catch(console.dir);
