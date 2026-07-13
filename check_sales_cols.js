require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function checkCollections() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const eventName = "中華職棒37年例行賽統一獅主場（上）";
        
        const colNames = ["Qware_Ticket_Data", "Qware_A_Ticket_data", "Qware_Sales_Data", "Qware_Sales_data"];
        
        for (const colName of colNames) {
            console.log(`Checking ${colName}...`);
            const sample = await db.collection(colName).findOne({ "節目/商品名稱": { $regex: eventName } });
            if (sample) {
                console.log(`  Found event in ${colName}. Sample time: ${sample['交易時間']}`);
                const count = await db.collection(colName).countDocuments({ "節目/商品名稱": sample['節目/商品名稱'] });
                console.log(`  Total records for this event: ${count}`);
                
                // Fine one from March 9th
                const march9 = await db.collection(colName).findOne({ 
                    "節目/商品名稱": sample['節目/商品名稱'],
                    "交易時間": { $regex: "2026-03-09|2026/03/09" }
                });
                console.log(`  Record on 2026-03-09? ${march9 ? 'Yes: ' + march9['交易時間'] : 'No'}`);
            } else {
                console.log(`  Not found in ${colName}`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
checkCollections();
