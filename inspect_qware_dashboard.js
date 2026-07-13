require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
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
