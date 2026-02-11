
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function checkQwareAi() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collections = await db.listCollections().toArray();
        console.log("Collections in QwareAi:", collections.map(c => c.name));

        if (collections.find(c => c.name === 'Qware_DashBoard')) {
            console.log("Found Qware_DashBoard in QwareAi!");
            const count = await db.collection('Qware_DashBoard').countDocuments();
            console.log("Qware_DashBoard count:", count);
        } else {
            console.log("Qware_DashBoard NOT found in QwareAi.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkQwareAi();
