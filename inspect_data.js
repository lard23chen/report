
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

async function explore() {
    try {
        await client.connect();
        console.log("Connected successfully to server");

        const dbName = 'allticket'; // Guessing this is the main DB based on name
        const db = client.db(dbName);

        console.log(`\nExploring database: ${dbName}`);

        // List collections
        const collections = await db.listCollections().toArray();
        console.log("Collections found:", collections.map(c => c.name).join(', '));

        // Sample data from each collection (limit to first 3 collections if too many, just to see what we have)
        for (const colInfo of collections.slice(0, 5)) {
            const colName = colInfo.name;
            console.log(`\n--- Sampling Collection: ${colName} ---`);
            const sample = await db.collection(colName).findOne({});
            console.log(JSON.stringify(sample, null, 2));
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.close();
    }
}

explore();
