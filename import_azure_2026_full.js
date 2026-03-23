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

        console.log("Reading CSV local file: azure_output04_full.csv (輸出04 tab)...");
        const results = [];
        let rowCount = 0;

        // B-K => ASys, DSys(AWS), ESys, Shared, Member, Total, Level, Activity, Note
        // Since B is Date, B-K is 10 columns: Date, A, D, E, Shared, Member, Total, Level, Activity, Note
        const headers = ["Date", "ASys", "DSysAWS", "ESys", "Shared", "Member", "TotalRevenue", "Level", "Activity", "Note"];

        const stream = fs.createReadStream('azure_output04_full.csv')
            .pipe(csv({ headers: false }));

        for await (const row of stream) {
            rowCount++;
            const dateStr = row[1] ? row[1].trim() : '';
            
            // Match Jan (1) or Feb (2) 2026. Format: 2026/01/01 or 2026/02/01
            const isMatch = dateStr.includes('2026/01/') || dateStr.includes('2026/1/') || 
                            dateStr.includes('2026/02/') || dateStr.includes('2026/2/');
            
            if (isMatch) {
                const item = {};
                for (let i = 1; i <= 10; i++) {
                    const key = headers[i - 1];
                    item[key] = row[i] ? row[i].trim() : '';
                }
                
                // Clean numeric values for cost columns (index 1-7 in my headers list is ASys to Total)
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
            console.log(`Found ${results.length} valid records for January/February 2026.`);
            
            // De-duplicate if needed, or clear. I'll clear to be safe with this combined script.
            console.log("Clearing existing records in AzureMonthlyCost_Daily before fresh combined import...");
            await collection.deleteMany({});

            const result = await collection.insertMany(results);
            console.log(`Inserted ${result.insertedCount} records successfully.`);
            
            const finalCount = await collection.countDocuments();
            console.log(`Current total documents in AzureMonthlyCost_Daily: ${finalCount}`);
        } else {
            console.log("No valid 2026/01 or 2026/02 data found in the CSV.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

run();
