require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        
        console.log("--- Qware_A_Ticket_data_Daily ---");
        const daily = await db.collection("Qware_A_Ticket_data_Daily").findOne();
        console.log(JSON.stringify(daily, null, 2));

        console.log("\n--- Qware_Ticket_Data ---");
        const hist = await db.collection("Qware_Ticket_Data").findOne();
        console.log(JSON.stringify(hist, null, 2));
        
    } finally {
        await client.close();
    }
}
check();
