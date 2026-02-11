const { MongoClient } = require('mongodb');

// Trying to connect to the other DB 'allticket' to see if maybe the user provided credentials work there now?
// Or just check if the user is mistaken about where the data is.

// Let's check ALL collections in QwareAi again, maybe it's in another collection?
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function searchAllCollections() {
    try {
        await client.connect();
        const db = client.db("QwareAi");

        const cols = await db.listCollections().toArray();
        console.log("Searching in collections:", cols.map(c => c.name));

        for (const colInfo of cols) {
            const col = db.collection(colInfo.name);
            const order = await col.findOne({ '訂單編號': { $regex: /A2512010000011/ } });
            if (order) {
                console.log(`\nFound order in collection '${colInfo.name}':`);
                console.log(JSON.stringify(order, null, 2));
                return;
            }
        }
        console.log("\nOrder not found in ANY collection in QwareAi.");

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

searchAllCollections();
