const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function inspectDecDetails() {
    try {
        await client.connect();
        const db = client.db("QwareAi");

        // 1. Check Collections
        const collections = await db.listCollections().toArray();
        console.log("Collections in QwareAi:", collections.map(c => c.name));

        const collection = db.collection('Qware_Ticket_Data');

        // 2. Check for ANY non-normal status in Dec 2025
        const nonNormalDec = await collection.find({
            '交易時間': { $regex: /^2025-12/ },
            '狀態': { $ne: '正常' }
        }).limit(5).toArray();
        console.log(`\nNon-Normal Status Records in Dec 2025 (Sample): ${nonNormalDec.length}`);
        nonNormalDec.forEach(r => console.log(JSON.stringify(r, null, 2)));

        // 3. Check for Fee > 0 in Dec 2025
        const feeDec = await collection.find({
            '交易時間': { $regex: /^2025-12/ },
            '手續費': { $gt: 0 }
        }).limit(5).toArray();
        console.log(`\nFee > 0 Records in Dec 2025 (Sample): ${feeDec.length}`);
        feeDec.forEach(r => console.log(JSON.stringify(r, null, 2)));

        // 4. Check if there are other date fields that might indicate December
        // Sample a refund record from ANY time and see its fields
        const sampleRefund = await collection.findOne({ '狀態': '退票' });
        if (sampleRefund) {
            console.log("\nSample Refund Record Structure (from any time):");
            console.log(Object.keys(sampleRefund));
            // Check for date-like fields
            const dateFields = Object.keys(sampleRefund).filter(k => k.includes('時間') || k.includes('Date') || k.includes('Time'));
            console.log("Potential Date Fields:", dateFields);

            dateFields.forEach(f => {
                console.log(`${f}: ${sampleRefund[f]}`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

inspectDecDetails();
