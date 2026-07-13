require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function analyze() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('GA_MonthlyStats');

        const docs = await collection.find({}).sort({ ID: 1 }).toArray();

        let total_A = 0, total_A_M = 0;
        let total_D = 0, total_D_M = 0;
        let total_E = 0, total_E_M = 0;
        let total_B = 0, total_B_M = 0;

        docs.forEach(d => {
            total_A += d.A_Total || 0;
            total_A_M += d.A_Mobile || 0;

            total_D += d.D_Total || 0;
            total_D_M += d.D_Mobile || 0;

            total_E += d.E_Total || 0;
            total_E_M += d.E_Mobile || 0;

            total_B += d.Booking_Total || 0;
            total_B_M += d.Booking_Mobile || 0;
        });

        console.log("=== 總體流量數據 ===");
        console.log(`A系統: 總計 ${total_A} (Mobile: ${((total_A_M / total_A) * 100).toFixed(2)}%)`);
        console.log(`D系統: 總計 ${total_D} (Mobile: ${((total_D_M / total_D) * 100).toFixed(2)}%)`);
        console.log(`E系統: 總計 ${total_E} (Mobile: ${((total_E_M / total_E) * 100).toFixed(2)}%)`);
        console.log(`Booking系統: 總計 ${total_B} (Mobile: ${((total_B_M / total_B) * 100).toFixed(2)}%)`);

        console.log("\n=== 每月趨勢 ===");
        docs.forEach(d => {
            const sumAll = (d.A_Total || 0) + (d.D_Total || 0) + (d.E_Total || 0) + (d.Booking_Total || 0);
            console.log(`[${d.YearMonth}] 總流量: ${sumAll} | A: ${d.A_Total} | D: ${d.D_Total} | E: ${d.E_Total} | B: ${d.Booking_Total}`);
        });

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

analyze();
