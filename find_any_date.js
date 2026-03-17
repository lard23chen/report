
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function findAnyDate() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const aId = "39455";
        
        console.log(`Finding all dates for ActivityID: ${aId}`);
        const dates = await db.collection("QwareTrafficSession").distinct("CreateTime", { ActivityID: aId });
        console.log("Distinct dates (first 20):", dates.slice(0, 20));
        
        // Also check if the date 2026/03/09 exists with slashes
        const countSlashes = await db.collection("QwareTrafficSession").countDocuments({ CreateTime: { $regex: "2026/03/09" } });
        console.log(`Count with slashes: ${countSlashes}`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
findAnyDate();
