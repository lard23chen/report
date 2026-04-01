
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/";
const client = new MongoClient(uri);

async function verify(monthPrefix) {
    await client.connect();
    const cursor = client.db("QwareAi").collection("Qware_Ticket_Data").find();
    
    let count = 0;
    let totalRevenue = 0;
    let matchedDocs = 0;

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        let isTargetMonth = false;
        let revenue = 0;

        for (let key in doc) {
            const val = doc[key];
            const valStr = String(val);

            // 1. 探測是否為目標月份
            if (/\d{4}-\d{2}-\d{2}/.test(valStr) && valStr.startsWith(monthPrefix)) {
                isTargetMonth = true;
            }

            // 2. 探測營收 (尋找 Decimal128 或可能是售價的欄位)
            // 根據之前觀察，金額常被放在特定的欄位，或直接是 Decimal 型態
            if (val && val.$numberDecimal) {
                const decVal = parseFloat(val.$numberDecimal);
                // 排除看起來像手續費或小額的數值，假設售價通常較大 (這步需謹慎)
                // 或者我們找到最像「售價」的那個 Decimal 欄位
                if (decVal > revenue) revenue = decVal;
            }
        }

        if (isTargetMonth) {
            matchedDocs++;
            totalRevenue += revenue;
        }
        
        count++;
        if (count % 100000 === 0) console.log(`Processed ${count} docs...`);
    }

    console.log(`\n--- Verification Result for ${monthPrefix} ---`);
    console.log(`Total Docs Scanned: ${count}`);
    console.log(`Matched Docs (Tickets): ${matchedDocs}`);
    console.log(`Total Calculated Revenue: ${totalRevenue}`);
}

async function main() {
    await verify("2026-03");
    process.exit();
}
main();
