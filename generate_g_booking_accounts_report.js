require('dotenv').config({ path: __dirname + '/.env', quiet: true });
// Generates the data block for G_MEM_Booking_Accounts_Report.html from
// Qware_A_OrderTemp_log_202608 (MongoDB QwareAi) - a booking/hold temp log,
// ~1.24M rows covering ~2 months (the collection itself doesn't retain more).
// Aggregates per order_user_id (booking count, distinct performance count,
// first/last booking time) rather than embedding raw rows - full detail for
// 1.24M rows would be far too large; the ~140k-account summary is ~14MB.
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

const OUT_FILE = path.join(__dirname, 'G_MEM_Booking_Accounts_Report.html');
const DATA_START = '// ── Data Start ──────────────────────────────────────────────────────────────';
const DATA_END   = '// ── Data End ────────────────────────────────────────────────────────────────';

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
        const coll = db.collection('Qware_A_OrderTemp_log_202608');

        console.log('Aggregating per order_user_id (count, distinct performances, first/last booking time)...');
        const agg = await coll.aggregate([
            { $group: {
                _id: '$order_user_id',
                cnt: { $sum: 1 },
                minT: { $min: '$book_date_time' },
                maxT: { $max: '$book_date_time' },
                perfSet: { $addToSet: '$performance_id' },
            } },
        ], { allowDiskUse: true }).toArray();
        console.log(`Aggregated ${agg.length} distinct accounts.`);

        const BOOKING_DATA = agg
            .filter(r => r._id)
            .map(r => ({
                u: r._id,
                c: r.cnt,
                p: r.perfSet.length,
                a: fmtTaipei(r.minT),
                z: fmtTaipei(r.maxT),
            }));

        const totalRecords = BOOKING_DATA.reduce((s, r) => s + r.c, 0);
        const days = BOOKING_DATA.flatMap(r => [r.a, r.z]).filter(Boolean).map(t => t.slice(0, 10)).sort();
        const DATA_META = {
            total: BOOKING_DATA.length,
            totalRecords,
            minDate: days[0] || null,
            maxDate: days[days.length - 1] || null,
        };

        const block = `${DATA_START}
const BOOKING_DATA = ${JSON.stringify(BOOKING_DATA)};
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
        console.log(`Done. ${DATA_META.total} accounts, ${DATA_META.totalRecords} total bookings, range ${DATA_META.minDate} ~ ${DATA_META.maxDate}.`);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

main();
