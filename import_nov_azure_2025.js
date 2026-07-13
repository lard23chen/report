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

        console.log("Reading CSV local file: azure_output04_nov2025.csv (2025/11 data)...");
        const results = [];
        let rowCount = 0;

        const headers = ["Date", "ASys", "DSysAWS", "ESys", "Shared", "Member", "TotalRevenue", "Level", "Activity", "Note"];

        const stream = fs.createReadStream('azure_output04_nov2025.csv')
            .pipe(csv({ headers: false }));

        for await (const row of stream) {
            rowCount++;
            const dateStr = row[1] ? row[1].trim() : '';
            
            // Match Nov 2025. Format: 2025/11/01
            if (dateStr.includes('2025/11/')) {
                const item = {};
                for (let i = 1; i <= 10; i++) {
                    const key = headers[i - 1];
                    item[key] = row[i] ? row[i].trim() : '';
                }
                
                // Clean numeric values
                const numericFields = ["ASys", "DSysAWS", "ESys", "Shared", "Member", "TotalRevenue"];
                numericFields.forEach(field => {
                    if (item[field]) {
                        item[field] = item[field].replace(/[$,]/g, '');
                    }
                });

                results.push(item);
            }
        }

        if (results.length > 0) {
            console.log(`Found ${results.length} valid records for November 2025.`);
            
            // Clear existing Nov data
            const deleteResult = await collection.deleteMany({ Date: { $regex: /2025\/11\// } });
            console.log(`Removed ${deleteResult.deletedCount} existing records for November 2025.`);

            const result = await collection.insertMany(results);
            console.log(`Inserted ${result.insertedCount} records successfully.`);
            
            const totalCount = await collection.countDocuments();
            console.log(`Current total documents in collection: ${totalCount}`);
        } else {
            console.log("No valid 2025/11 data found in the CSV.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

run();
