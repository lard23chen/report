
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectLatest() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');
        const refund = await collection.findOne({
            '節目/商品名稱': '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards',
            '狀態': { $in: ['已退票', '退票'] }
        });

        if (refund) {
            console.log("Refund Found:", JSON.stringify(refund, null, 2));
        } else {
            console.log("No refund found for Golden Disc.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectLatest();
