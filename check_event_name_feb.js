const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
    const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });
    await client.connect();
    const doc = await client.db('QwareAi').collection('Qware_Ticket_Data')
        .findOne({ '交易時間': { $regex: '^2026-02' }, '節目/商品名稱': { $regex: '澄清湖' } });
    if (doc) {
        console.log('Event name:', JSON.stringify(doc['節目/商品名稱']));
        console.log('Has single quote:', doc['節目/商品名稱'].includes("'"));
    } else {
        console.log('Not found');
    }
    await client.close();
}
run();
