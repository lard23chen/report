const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectOrder() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Searching for Order: A2512010000011_1");
        const order = await collection.findOne({ '訂單編號': 'A2512010000011_1' });

        if (order) {
            console.log("\nFound Order:");
            console.log(JSON.stringify(order, null, 2));
        } else {
            console.log("\nOrder not found in QwareAi.Qware_Ticket_Data.");
            // Try searching partial
            const partial = await collection.find({ '訂單編號': { $regex: /A2512010000011/ } }).toArray();
            if (partial.length > 0) {
                console.log(`Found ${partial.length} similar orders:`);
                partial.forEach(o => console.log(`${o['訂單編號']} - ${o['狀態']}`));
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectOrder();
