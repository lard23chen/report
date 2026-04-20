const { MongoClient } = require('mongodb');
const fs = require('fs');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

function parseNum(str) {
    if (!str) return '';
    return str.replace(/[$,\s]/g, '').trim();
}

function parseCSV(text) {
    const results = [];
    const lines = text.split('\n');

    for (const rawLine of lines) {
        // CSV parsing: handle quoted fields with newlines inside
        const cols = [];
        let inQuote = false;
        let cur = '';
        for (let i = 0; i < rawLine.length; i++) {
            const ch = rawLine[i];
            if (ch === '"') {
                inQuote = !inQuote;
            } else if (ch === ',' && !inQuote) {
                cols.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }
        cols.push(cur);

        const dateStr = (cols[1] || '').trim();
        // Match 2026/03/xx
        if (!dateStr.match(/^2026\/03\//)) continue;

        // Date: take first 10 chars "2026/03/01"
        const date = dateStr.slice(0, 10);

        results.push({
            Date: date,
            ASys: parseNum(cols[2]),
            DSysAWS: parseNum(cols[3]),
            ESys: parseNum(cols[4]),
            Shared: parseNum(cols[5]),
            Member: parseNum(cols[6]),
            TotalRevenue: parseNum(cols[7]),
            Level: (cols[8] || '').trim(),
            Activity: (cols[9] || '').trim(),
            Note: (cols[10] || '').trim(),
        });
    }
    return results;
}

async function run() {
    try {
        const csvText = fs.readFileSync('temp_sheet.csv', 'utf8');
        const records = parseCSV(csvText);

        console.log(`Parsed ${records.length} records for 2026/03`);
        if (records.length === 0) {
            console.log('No data found. Exiting.');
            return;
        }
        records.forEach(r => console.log(r.Date, r.ASys, r.TotalRevenue));

        await client.connect();
        const col = client.db('QwareAi').collection('AzureMonthlyCost_Daily');

        // Remove existing 2026/03 to avoid duplicates
        const del = await col.deleteMany({ Date: { $regex: /^2026\/03\// } });
        console.log(`Deleted ${del.deletedCount} existing 2026/03 records`);

        const res = await col.insertMany(records);
        console.log(`Inserted ${res.insertedCount} records`);

        const total = await col.countDocuments();
        console.log(`Total documents in AzureMonthlyCost_Daily: ${total}`);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.close();
    }
}

run();
