require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const csv = require('csv-parser');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('AzureMonthlyCost_Daily');

        console.log("Reading CSV local file...");
        const results = [];
        let headerRow = null;
        let rowCount = 0;

        fs.createReadStream('azure_monthly.csv')
            .pipe(csv({ headers: false }))
            .on('data', (row) => {
                rowCount++;
                if (rowCount === 1) {
                    headerRow = row;
                } else if (rowCount > 1) {
                    // Filter: try different index or just check if row has anything
                    if (row[1] && row[1].trim() !== '') {
                        const item = {};
                        for (let i = 1; i <= 10; i++) {
                            const key = headerRow[i] || `Col_${i}`;
                            item[key] = row[i];
                        }
                        results.push(item);
                    }
                }
            })
            .on('end', async () => {
                if (results.length > 0) {
                    console.log(`Inserting ${results.length} records into AzureMonthlyCost_Daily...`);
                    try {
                        const result = await collection.insertMany(results);
                        console.log(`Inserted ${result.insertedCount} records successfully.`);
                        // Explicitly check count
                        const count = await collection.countDocuments();
                        console.log(`Current Count in AzureMonthlyCost_Daily: ${count}`);
                        await client.close();
                        process.exit(0);
                    } catch (e) {
                         console.error("Insertion failed:", e.message);
                         await client.close();
                         process.exit(1);
                    }
                } else {
                    console.log("No data found after header.");
                    await client.close();
                    process.exit(0);
                }
            });

    } catch (e) {
        console.error("Connection Error:", e.message);
        await client.close();
    }
}

run();
