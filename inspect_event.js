
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectEventData() {
    try {
        await client.connect();
        const db = client.db("allticket");
        const collection = db.collection('Qware_DashBoard');

        const eventName = '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards';

        // Get distinct prices to see ticket zones
        const prices = await collection.distinct('售價', { '節目商品名稱': eventName });
        console.log("Distinct Prices:", prices);

        // Peek at one record
        const oneRecord = await collection.findOne({ '節目商品名稱': eventName });
        console.log("Sample Record:", oneRecord);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectEventData();
