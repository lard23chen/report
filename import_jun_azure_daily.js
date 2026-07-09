const { MongoClient } = require('mongodb');
const fs = require('fs');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

function parseNum(str) {
    if (!str) return '';
    return str.replace(/[$,\s]/g, '').trim();
}

// RFC 4180 全文解析：正確處理引號欄位內的換行與 "" 跳脫
// （import_mar 版先 split('\n') 再解析，遇到欄位內換行會斷行錯誤，勿沿用）
function parseCSVRows(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuote) {
            if (ch === '"') {
                if (text[i + 1] === '"') { cur += '"'; i++; }
                else inQuote = false;
            } else cur += ch;
        } else if (ch === '"') {
            inQuote = true;
        } else if (ch === ',') {
            row.push(cur); cur = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cur); cur = '';
            rows.push(row); row = [];
        } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
}

function extractMonth(text, monthRegex) {
    return parseCSVRows(text)
        .filter(cols => ((cols[1] || '').trim()).match(monthRegex))
        .map(cols => ({
            Date: (cols[1] || '').trim().slice(0, 10),
            ASys: parseNum(cols[2]),
            DSysAWS: parseNum(cols[3]),
            ESys: parseNum(cols[4]),
            Shared: parseNum(cols[5]),
            Member: parseNum(cols[6]),
            TotalRevenue: parseNum(cols[7]),
            Level: (cols[8] || '').trim(),
            Activity: (cols[9] || '').trim(),
            Note: (cols[10] || '').trim(),
        }));
}

async function run() {
    try {
        const csvText = fs.readFileSync('temp_sheet.csv', 'utf8');
        const records = extractMonth(csvText, /^2026\/06\//);

        console.log(`Parsed ${records.length} records for 2026/06`);
        if (records.length === 0) {
            console.log('No data found. Exiting.');
            return;
        }
        records.forEach(r => console.log(r.Date, r.ASys, r.TotalRevenue, r.Activity ? `[${r.Activity.split('\n')[0].substring(0, 30)}]` : ''));

        await client.connect();
        const col = client.db('QwareAi').collection('AzureMonthlyCost_Daily');

        const del = await col.deleteMany({ Date: { $regex: /^2026\/06\// } });
        console.log(`Deleted ${del.deletedCount} existing 2026/06 records`);

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
