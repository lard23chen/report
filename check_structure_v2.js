require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
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
