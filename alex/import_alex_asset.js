// 匯入 Alex 個人資產快照：Google Sheets → MongoDB (alex / AssetSnapshots)
// 執行：node alex/import_alex_asset.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const https = require('https');
const XLSX = require('xlsx');
const { MongoClient, ServerApiVersion } = require('mongodb');

const SHEET_ID = '1ExXSoThNuzhLnn5K7ldXkpNaHXSIaBuUPl75sPp1Z7E';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

const uri = process.env.MONGODB_URI_PERSONAL;
if (!uri) { console.error('MONGODB_URI_PERSONAL not set'); process.exit(1); }

function fetchCsv(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('Too many redirects'));
        https.get(url, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchCsv(res.headers.location, redirects + 1));
            }
            if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
            let data = '';
            res.setEncoding('utf8');
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// "NT$2,280,586" / "$644,436" / "-NT$670,151" → Number；空值 → null
function parseAmount(v) {
    if (v == null) return null;
    const s = String(v).trim();
    if (s === '') return null;
    const n = Number(s.replace(/NT\$|\$|,|\s/g, ''));
    return Number.isFinite(n) ? n : null;
}

function normalizeName(s) {
    return String(s).replace(/\s+/g, ' ').trim();
}

// "2026/7/1" 或 XLSX 重新格式化後的 "7/1/26" → "2026/07/01"
function normalizeDate(s) {
    const str = String(s).trim();
    let m = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (m) return `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
    m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/); // M/D/YY
    if (m) return `20${m[3]}/${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}`;
    throw new Error('Unrecognized snapshot date: ' + str);
}

async function main() {
    console.log('Downloading sheet CSV...');
    const csv = await fetchCsv(CSV_URL);
    const wb = XLSX.read(csv, { type: 'string' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });

    const snapshotDate = normalizeDate(rows[0][2]);
    const items = [];
    let sheetTotal = null;
    let currentCategory = null;

    for (let i = 1; i < rows.length; i++) {
        const [cat, item, val] = rows[i].map(c => (c == null ? '' : String(c).trim()));
        if (cat) currentCategory = normalizeName(cat);
        if (item) {
            // 幣別前綴：「NT$」為台幣現值；「$」（保險欄）不列入試算表總計口徑
            const mark = /^-?NT\$/.test(val) ? 'NT$' : (/^-?\$/.test(val) ? '$' : null);
            items.push({ Category: currentCategory, Item: normalizeName(item), Amount: parseAmount(val), CurrencyMark: mark });
        } else if (!cat && val) {
            sheetTotal = parseAmount(val); // 最末列總計（無分類、無項目、僅金額）
        }
    }

    const valued = items.filter(it => it.Amount != null);
    const totalAssets = valued.filter(it => it.Amount > 0).reduce((s, it) => s + it.Amount, 0);
    const totalLiabilities = valued.filter(it => it.Amount < 0).reduce((s, it) => s + Math.abs(it.Amount), 0);
    const netAssets = totalAssets - totalLiabilities;
    // 試算表總計口徑 = 「NT$」正值項目加總（排除「$」保險與負值房貸）
    const ntdPositiveTotal = valued.filter(it => it.Amount > 0 && it.CurrencyMark === 'NT$').reduce((s, it) => s + it.Amount, 0);

    console.log(`SnapshotDate: ${snapshotDate}`);
    console.log(`Items: ${items.length} (valued: ${valued.length})`);
    console.log(`TotalAssets: ${totalAssets.toLocaleString()}`);
    console.log(`TotalLiabilities: ${totalLiabilities.toLocaleString()}`);
    console.log(`NetAssets: ${netAssets.toLocaleString()}`);
    console.log(`NT$-positive total: ${ntdPositiveTotal.toLocaleString()} / SheetTotal: ${sheetTotal == null ? 'N/A' : sheetTotal.toLocaleString()}`);
    if (sheetTotal != null && ntdPositiveTotal !== sheetTotal) {
        console.error('❌ NT$ 正值項目加總與試算表總計不符，中止匯入');
        process.exit(1);
    }

    const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1 } });
    try {
        await client.connect();
        const col = client.db('alex').collection('AssetSnapshots');
        const doc = {
            SnapshotDate: snapshotDate,
            SheetId: SHEET_ID,
            Items: items,
            TotalAssets: totalAssets,
            TotalLiabilities: totalLiabilities,
            NetAssets: netAssets,
            NtdPositiveTotal: ntdPositiveTotal,
            SheetTotal: sheetTotal,
            ImportedAt: new Date()
        };
        const r = await col.updateOne({ SnapshotDate: snapshotDate }, { $set: doc }, { upsert: true });
        console.log(`✅ Upserted snapshot ${snapshotDate} (matched: ${r.matchedCount}, upserted: ${r.upsertedCount})`);
    } finally {
        await client.close();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
