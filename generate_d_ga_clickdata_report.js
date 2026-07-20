require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

const COLL    = 'GA_D_ClickData_Webb_202606';
// OUT_FILE's <head> has an IP-allowlist gate (2026/07/20). This script only patches
// data markers via regex and never touches <head> — do not replace with a full
// template rewrite without carrying the gate over.
const OUT_FILE = path.join(__dirname, 'D_GA_ClickData_Webb_202606_Report.html');
const YEAR    = 2026; // derived from collection name suffix

// ── Category map (manually classified, stable for this collection) ──────────
const CAT_MAP = {
    '39428':'sports','39190':'sports','39576':'sports','39667':'sports',
    '39649':'fan',   '39590':'music', '39226':'sports','39603':'concert',
    '39455':'sports','39584':'concert','39611':'concert','39470':'concert',
    '39673':'fan',   '39664':'music', '39559':'concert','39451':'sports',
    '39607':'fan',   '39458':'sports','39494':'fan',   '39549':'concert',
    '39529':'concert','39605':'concert','39648':'sports','39511':'sports',
    '39619':'concert','39666':'sports','39496':'concert','39490':'concert',
    '39524':'sports','39526':'fan',  '39575':'fan',   '39550':'fan',
    '39610':'concert'
};

function toTWTStr(d) {
    const tw = new Date(d.getTime() + 8 * 3600000);
    const yyyy = tw.getUTCFullYear();
    const mm   = String(tw.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(tw.getUTCDate()).padStart(2, '0');
    const hh   = String(tw.getUTCHours()).padStart(2, '0');
    const min  = String(tw.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

function toYYYYMMDD(d) {
    const tw = new Date(d.getTime() + 8 * 3600000);
    return `${tw.getUTCFullYear()}-${String(tw.getUTCMonth()+1).padStart(2,'0')}-${String(tw.getUTCDate()).padStart(2,'0')}`;
}

async function main() {
    try {
        console.log('Connecting to MongoDB...');
        await client.connect();
        const col = client.db('QwareAi').collection(COLL);

        // ── Get latest UpdateTime ────────────────────────────────────────────
        const lastDoc = await col.findOne({}, { sort: { UpdateTime: -1 }, projection: { UpdateTime: 1 } });
        const updateTimeStr = (lastDoc && lastDoc.UpdateTime)
            ? toTWTStr(new Date(lastDoc.UpdateTime))
            : toTWTStr(new Date());
        console.log('UpdateTime (TWN):', updateTimeStr);

        // ── Aggregations ─────────────────────────────────────────────────────
        console.log('Aggregating DAILY...');
        const dailyRaw = await col.aggregate([
            { $group: {
                _id:      { $dateToString: { format: '%m/%d', date: '$EventDate', timezone: 'Asia/Taipei' } },
                total:    { $sum: '$EventCount' },
                loggedIn: { $sum: '$LoggedInCount' },
                notIn:    { $sum: '$NotLoggedInCount' }
            }},
            { $sort: { _id: 1 } }
        ]).toArray();

        console.log('Aggregating ACTIVITIES...');
        const actRaw = await col.aggregate([
            { $sort: { EventDate: 1 } },
            { $group: {
                _id:       '$ActivityId',
                name:      { $last: '$GameInfoName' },
                total:     { $sum: '$EventCount' },
                loggedIn:  { $sum: '$LoggedInCount' },
                notIn:     { $sum: '$NotLoggedInCount' },
                perf:      { $sum: 1 },
                eventDate: { $first: '$EventDate' }
            }},
            { $sort: { total: -1 } }
        ]).toArray();

        console.log('Aggregating BY_DATE...');
        const byDateRaw = await col.aggregate([
            { $sort: { EventDate: 1 } },
            { $group: {
                _id:      { date: { $dateToString: { format: '%m/%d', date: '$EventDate', timezone: 'Asia/Taipei' } }, actId: '$ActivityId' },
                name:     { $last: '$GameInfoName' },
                total:    { $sum: '$EventCount' },
                loggedIn: { $sum: '$LoggedInCount' }
            }},
            { $sort: { '_id.date': 1, total: -1 } }
        ]).toArray();

        console.log('Aggregating ACT_DAILY...');
        const actDailyRaw = await col.aggregate([
            { $sort: { EventDate: 1 } },
            { $group: {
                _id:      { actId: '$ActivityId', date: { $dateToString: { format: '%m/%d', date: '$EventDate', timezone: 'Asia/Taipei' } } },
                total:    { $sum: '$EventCount' },
                loggedIn: { $sum: '$LoggedInCount' }
            }},
            { $sort: { '_id.actId': 1, '_id.date': 1 } }
        ]).toArray();

        // ── Build JS constants ───────────────────────────────────────────────
        const DAILY = dailyRaw.map(d => ({ date: d._id, total: d.total, loggedIn: d.loggedIn, notIn: d.notIn }));

        const ACTIVITIES = actRaw.map(a => ({
            id:        a._id,
            name:      a.name,
            total:     a.total,
            loggedIn:  a.loggedIn,
            notIn:     a.notIn,
            perf:      a.perf,
            cat:       CAT_MAP[a._id] || 'concert',
            eventDate: a.eventDate ? toYYYYMMDD(new Date(a.eventDate)) : ''
        }));

        // BY_DATE: one array per date (matching DAILY index order)
        const byDateMap = {};
        byDateRaw.forEach(r => {
            const dt = r._id.date;
            if (!byDateMap[dt]) byDateMap[dt] = [];
            byDateMap[dt].push({ id: r._id.actId, name: r.name, total: r.total, loggedIn: r.loggedIn });
        });
        const BY_DATE = DAILY.map(d => (byDateMap[d.date] || []).sort((a, b) => b.total - a.total));

        // ACT_DAILY: { actId: [{date, total, loggedIn}] }
        const actDailyMap = {};
        actDailyRaw.forEach(r => {
            const id = r._id.actId;
            if (!actDailyMap[id]) actDailyMap[id] = [];
            actDailyMap[id].push({ date: r._id.date, total: r.total, loggedIn: r.loggedIn });
        });

        const maxTotal = ACTIVITIES.length > 0 ? ACTIVITIES[0].total : 0;

        // ── Serialize to JS ──────────────────────────────────────────────────
        const byDateLines = BY_DATE.map(arr => '  ' + JSON.stringify(arr)).join(',\n');
        const actDailyLines = Object.entries(actDailyMap)
            .map(([id, days]) => `  '${id}': ${JSON.stringify(days)}`)
            .join(',\n');

        const newDataSection =
`// ── Data ──────────────────────────────────────────────────────────────────
const DAILY = ${JSON.stringify(DAILY, null, 2)};

const ACTIVITIES = ${JSON.stringify(ACTIVITIES, null, 2)};

const CAT_LABELS = { sports:'運動', concert:'演唱會', fan:'見面會', music:'音樂節' };
const CAT_COLORS = { sports:'var(--blue)', concert:'var(--purple)', fan:'var(--rose)', music:'var(--green)' };

const maxTotal = ${maxTotal};

// ── BY_DATE per-day activity data ──────────────────────────────────────────
const catById = {};
ACTIVITIES.forEach(a => { catById[a.id] = a.cat; });

const BY_DATE = [
${byDateLines}
];

// ── Per-activity daily breakdown ──────────────────────────────────────────
const ACT_DAILY = {
${actDailyLines}
};

`;

        // ── Patch HTML ───────────────────────────────────────────────────────
        console.log('Patching HTML...');
        let html = fs.readFileSync(OUT_FILE, 'utf8');

        const DATA_START = '// ── Data ──────────────────────────────────────────────────────────────────';
        const DATA_END   = '// ── Charts ─────────────────────────────────────────────────────────────────';
        const si = html.indexOf(DATA_START);
        const ei = html.indexOf(DATA_END);
        if (si === -1 || ei === -1) throw new Error('Data section markers not found in HTML');
        html = html.slice(0, si) + newDataSection + html.slice(ei);

        // Update subtitle: UpdateTime
        html = html.replace(
            /最新資料更新：<span>[^<]+<\/span>/,
            `最新資料更新：<span>${updateTimeStr}</span>`
        );

        // Update subtitle: data period
        if (DAILY.length >= 2) {
            const periodStr = `${YEAR}/${DAILY[0].date} — ${YEAR}/${DAILY[DAILY.length - 1].date}`;
            html = html.replace(
                /資料期間：<span>[^<]+<\/span>/,
                `資料期間：<span>${periodStr}</span>`
            );
        }

        fs.writeFileSync(OUT_FILE, html, 'utf8');
        console.log(`Done. Activities: ${ACTIVITIES.length}, Days: ${DAILY.length}, UpdateTime: ${updateTimeStr}`);

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

main();
