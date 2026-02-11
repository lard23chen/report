
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });

async function checkSpecificCollection() {
    try {
        await client.connect();
        const db = client.db('allticket');
        const data = await db.collection('Qware_DashBoard').findOne({});
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await client.close();
    }
}
checkSpecificCollection();
