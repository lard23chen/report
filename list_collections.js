
const { MongoClient, ServerApiVersion } = require('mongodb');

// Connection URL
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

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
        const db = client.db('allticket');
        const collections = await db.listCollections().toArray();
        console.log("Collections:", JSON.stringify(collections.map(c => c.name)));
    } catch (error) {
        console.error(error);
    } finally {
        await client.close();
    }
}

listCols();
