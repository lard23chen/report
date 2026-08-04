require('dotenv').config({ path: __dirname + '/.env', quiet: true });
// Generates the data block for F_MEM_BlackList_Query_Report.html from
// Qware_MEM_BlackList_202608 (MongoDB QwareAi). Only embeds MEMO0='Y' rows
// within the last 90 days of UPDATE_TIME (full collection is 3.75M+ rows;
// embedding everything would blow up the static file, see REPORT_SPEC_F_MEM_BLACKLIST.md).
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

const OUT_FILE = path.join(__dirname, 'F_MEM_BlackList_Query_Report.html');
const DATA_START = '// ── Data Start ──────────────────────────────────────────────────────────────';
const DATA_END   = '// ── Data End ────────────────────────────────────────────────────────────────';
const WINDOW_DAYS = 90;

// Convert a UTC Date to a Taipei (+08:00) "YYYY-MM-DD HH:mm:ss" string.
function fmtTaipei(d) {
    if (!d) return null;
    const shifted = new Date(new Date(d).getTime() + 8 * 3600 * 1000);
    return shifted.toISOString().slice(0, 19).replace('T', ' ');
}

async function main() {
    try {
        console.log('Connecting to MongoDB...');
        await client.connect();
        const db = client.db('QwareAi');
        const coll = db.collection('Qware_MEM_BlackList_202608');

        const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
        console.log(`Querying MEMO0='Y' rows with UPDATE_TIME >= ${since.toISOString()} ...`);
        const rows = await coll.find(
            { MEMO0: 'Y', UPDATE_TIME: { $gte: since } },
            { projection: { USER_ID: 1, EMAIL: 1, MOBILE_head: 1, CREATE_TIME: 1, UPDATE_TIME: 1, CREATE_USER: 1, UPDATE_USER: 1 } }
        ).sort({ UPDATE_TIME: -1 }).toArray();
        console.log(`Fetched ${rows.length} rows.`);

        const BLACKLIST_DATA = rows.map(r => ({
            uid: r.USER_ID || '',
            email: (r.EMAIL || '').trim(),
            mobile: r.MOBILE_head || '',
            ct: fmtTaipei(r.CREATE_TIME),
            ut: fmtTaipei(r.UPDATE_TIME),
            cu: r.CREATE_USER || '',
            uu: r.UPDATE_USER || '',
        })).filter(r => r.ut);

        const days = BLACKLIST_DATA.map(r => r.ut.slice(0, 10)).sort();
        const DATA_META = {
            total: BLACKLIST_DATA.length,
            minDate: days[0] || null,
            maxDate: days[days.length - 1] || null,
        };

        const block = `${DATA_START}
const BLACKLIST_DATA = ${JSON.stringify(BLACKLIST_DATA)};
const DATA_META = ${JSON.stringify(DATA_META)};
${DATA_END}`;

        let html = fs.readFileSync(OUT_FILE, 'utf8');
        const si = html.indexOf(DATA_START);
        const ei = html.indexOf(DATA_END);
        if (si === -1 || ei === -1) throw new Error('Data markers not found');
        html = html.slice(0, si) + block + html.slice(ei + DATA_END.length);

        const now = new Date();
        const ts = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        html = html.replace(/(<span id="updateTimeLabel">)[^<]*(<\/span>)/, `$1${ts}$2`);

        fs.writeFileSync(OUT_FILE, html, 'utf8');
        console.log(`Done. ${DATA_META.total} rows embedded, range ${DATA_META.minDate} ~ ${DATA_META.maxDate}.`);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

main();
