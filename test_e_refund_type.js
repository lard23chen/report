const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
async function run() {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('QwareAi');
    const c = db.collection('Qware_Ticket_Data_Esys');

    const r = await c.aggregate([
        { $match: { "狀態": { $in: ["退票", "已退票"] } } },
        { $project: { feeType: { $type: "$手續費" }, feeValue: "$手續費" } },
        { $limit: 3 }
    ]).toArray();
    console.log(r);

    await client.close();
}
run().catch(console.dir);
