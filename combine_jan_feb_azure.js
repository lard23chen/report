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

        const headers = ["Date", "ASys", "DSysAWS", "ESys", "Shared", "Member", "TotalRevenue", "Level", "Activity", "Note"];
        const results = [];

        async function processFile(filename, monthPattern) {
            console.log(`Processing file: ${filename} for pattern ${monthPattern}...`);
            const stream = fs.createReadStream(filename).pipe(csv({ headers: false }));
            for await (const row of stream) {
                const dateStr = row[1] ? row[1].trim() : '';
                if (dateStr.includes(monthPattern)) {
                    const item = {};
                    for (let i = 1; i <= 10; i++) {
                        const key = headers[i - 1];
                        item[key] = row[i] ? row[i].trim() : '';
                    }
                    // Clean numeric values
                    const numericFields = ["ASys", "DSysAWS", "ESys", "Shared", "Member", "TotalRevenue"];
                    numericFields.forEach(field => {
                        if (item[field]) item[field] = item[field].replace(/[$,]/g, '');
                    });
                    results.push(item);
                }
            }
        }

        // Process Jan from azure_output04_full.csv
        await processFile('azure_output04_full.csv', '2026/01/');
        // Process Feb from azure_monthly.csv
        await processFile('azure_monthly.csv', '2026/02/');

        if (results.length > 0) {
            console.log(`Found total ${results.length} valid records for Jan/Feb 2026.`);
            
            // Deduplicate by Date just in case
            const uniqueResults = [];
            const datesSeen = new Set();
            for (const r of results) {
                if (!datesSeen.has(r.Date)) {
                    uniqueResults.push(r);
                    datesSeen.add(r.Date);
                }
            }
            console.log(`Unique records: ${uniqueResults.length}`);

            console.log("Clearing collection...");
            await collection.deleteMany({});

            console.log(`Inserting ${uniqueResults.length} records...`);
            await collection.insertMany(uniqueResults);
            
            const finalCount = await collection.countDocuments();
            console.log(`Current total documents: ${finalCount}`);
        } else {
            console.log("No data found.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

run();
