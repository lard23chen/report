const { MongoClient } = require('mongodb');
const fs = require('fs');
const csv = require('csv-parser');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('AzureMonthlyCost_Daily');

        console.log("Reading CSV local file: azure_monthly.csv...");
        const results = [];
        let rowCount = 0;

        // Custom headers mapping for B to K (Indices 1 to 10)
        const headers = ["Date", "ASys", "DSys", "ESys", "Shared", "Member", "Total", "Level", "Event", "Note"];

        const stream = fs.createReadStream('azure_monthly.csv')
            .pipe(csv({ headers: false }));

        for await (const row of stream) {
            rowCount++;
            // Column B is index 1
            const dateStr = row[1] ? row[1].trim() : '';
            
            // Check if it's a 2026/02 date (format could be 2026/02/xx or something similar)
            if (dateStr.includes('2026/02') || dateStr.includes('2026/2/')) {
                const item = {};
                for (let i = 1; i <= 10; i++) {
                    const key = headers[i - 1];
                    item[key] = row[i] ? row[i].trim() : '';
                }
                
                // Clean up numeric values (remove $, commas)
                const numericFields = ["ASys", "DSys", "ESys", "Shared", "Member", "Total"];
                numericFields.forEach(field => {
                    if (item[field]) {
                        item[field] = item[field].replace(/[$,]/g, '');
                    }
                });

                results.push(item);
            }
        }

        if (results.length > 0) {
            console.log(`Found ${results.length} valid records for February 2026.`);
            
            // Optional: Clear existing 2026/02 data to avoid duplicates if re-running
            // const deleteResult = await collection.deleteMany({ Date: { $regex: /2026\/0?2/ } });
            // console.log(`Deleted ${deleteResult.deletedCount} existing records for Feb 2026.`);

            const result = await collection.insertMany(results);
            console.log(`Inserted ${result.insertedCount} records successfully.`);
            
            // Verify final count
            const finalCount = await collection.countDocuments();
            console.log(`Current total documents in AzureMonthlyCost_Daily: ${finalCount}`);
        } else {
            console.log("No valid February 2026 data found in the CSV.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

run();
