require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function verifyMore() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        const statuses = await collection.distinct('正常');
        console.log("Distinct Statuses (Key='正常'):", statuses);

        const zeros = await collection.distinct('0');
        console.log("Distinct values for '0' (Maybe Refund Fee?):", zeros.slice(0, 10));

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

verifyMore();
