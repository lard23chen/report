require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient, ServerApiVersion } = require('mongodb');

// Connection URL
const uri = process.env.MONGODB_URI_QWARE;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function listCols() {
    try {
        await client.connect();
        const db = client.db('QwareAi');
        const collections = await db.listCollections().toArray();
        console.log("Collections:", JSON.stringify(collections.map(c => c.name), null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await client.close();
    }
}

listCols();
