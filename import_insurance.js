const { MongoClient } = require('mongodb');
const fs = require('fs');

const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';
const DB_NAME = 'AlexLIFE';
const COLLECTION_NAME = 'Insurance';

function parseExtracted(raw) {
    const records = [];
    let mode = null; // 'summary' | 'detail_v1' | 'detail_v2'

    raw.forEach(row => {
        const r0 = row[0] || '';
        const r1 = row[1] || '';

        // Detect header rows
        if (r0 === '商品名稱') { mode = 'summary'; return; }
        if (r0 === '日期' && r1 === '保單號碼') {
            // Check if 3rd field has "預繳次數" or "己繳次數"
            mode = row[3] === '預繳次數' ? 'detail_v1' : 'detail_v2';
            return;
        }
        // Skip empty rows
        if (row.every(c => c === '')) return;

        if (mode === 'summary' && r0 !== '') {
            // Header: 商品名稱, 己繳次數, 年繳金額, 累計繳費金額, 待繳金額, 期滿年, 期滿共繳金額, 期滿5年後可領回, 期滿10年後可領回, 2025解約可領回, 備註, 銀行帳戶, _
            records.push({
                name: row[0] || '',
                date: '',
                policyNumber: row[11] || '',
                years: row[1] || '',
                annualPremium: row[2] || '',
                accumulatedPremium: row[3] || '',
                maturityYear: row[5] || '',
                maturityAmount: row[6] || '',
                return5yr: row[7] || '',
                return10yr: row[8] || '',
                returnNov2025: row[9] || '',
                memo: row[10] || ''
            });
        } else if (mode === 'detail_v1' && r1 !== '' && r1 !== '保單號碼') {
            // Header: 日期, 保單號碼, 商品名稱, 預繳次數, 己繳次數, 年繳金額, 累計繳費金額, 待繳金額, 5年後可領回, 10年後可領回, 解約金, 備註
            records.push({
                name: row[2] || '',
                date: row[0] || '',
                policyNumber: row[1] || '',
                years: row[3] || '',
                annualPremium: row[5] || '',
                accumulatedPremium: row[6] || '',
                maturityYear: '',
                maturityAmount: '',
                return5yr: row[8] || '',
                return10yr: row[9] || '',
                returnNov2025: row[10] || '',
                memo: row[11] || ''
            });
        } else if (mode === 'detail_v2' && r0 !== '' || (mode === 'detail_v2' && r1 !== '')) {
            // Header: 日期, 保單號碼, 商品名稱, 己繳次數, 年繳金額, 累計繳費金額, 待繳金額, 期滿年, 期滿共繳金額, 期滿5年後可領回, 期滿10年後可領回, 備註
            if (row[2] === '' && row[1] === '') return;
            records.push({
                name: row[2] || '',
                date: row[0] || '',
                policyNumber: row[1] || '',
                years: row[3] || '',
                annualPremium: row[4] || '',
                accumulatedPremium: row[5] || '',
                maturityYear: row[7] || '',
                maturityAmount: row[8] || '',
                return5yr: row[9] || '',
                return10yr: row[10] || '',
                returnNov2025: '',
                memo: row[11] || ''
            });
        }
    });

    return records;
}

async function run() {
    const client = new MongoClient(MONGO_URI);
    try {
        const raw = JSON.parse(fs.readFileSync('extracted_insurance.json', 'utf8'));
        const records = parseExtracted(raw);
        console.log(`Parsed ${records.length} records from extracted_insurance.json`);
        records.forEach((r, i) => console.log(`  ${i + 1}. ${r.name} | ${r.policyNumber} | ${r.annualPremium}`));

        await client.connect();
        const col = client.db(DB_NAME).collection(COLLECTION_NAME);

        await col.deleteMany({});
        if (records.length > 0) {
            await col.insertMany(records);
        }
        console.log(`\nInserted ${records.length} records into ${DB_NAME}.${COLLECTION_NAME}`);

        // Sync to insurance_data.json
        const saved = await col.find({}).toArray();
        const serialized = saved.map(d => ({ ...d, _id: d._id.toString() }));
        fs.writeFileSync('insurance_data.json', JSON.stringify(serialized, null, 2), 'utf8');
        console.log('Updated insurance_data.json');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.close();
    }
}

run();
