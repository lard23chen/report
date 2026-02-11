
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });

async function checkStructure() {
    try {
        await client.connect();
        const db = client.db('allticket');
        // Get 5 records to see order id patterns
        const data = await db.collection('Qware_DashBoard').find({}).limit(10).toArray();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await client.close();
    }
}
checkStructure();
