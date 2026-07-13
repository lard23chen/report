require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function checkStatus() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        const statuses = await collection.distinct('狀態');
        console.log("Statuses:", statuses);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkStatus();
