
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectMoreFields() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Distinct 銷售點:", await collection.distinct('銷售點', {}));
        console.log("Distinct 票別:", await collection.distinct('票別', {}));

        console.log("\nSample '未列印':");
        console.log(await collection.findOne({ '取票方式': '未列印' }));

        console.log("\nSample '已取':");
        console.log(await collection.findOne({ '取票方式': '已取' }));

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectMoreFields();
