require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs   = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

const COLL     = 'GA_D_PageViewData_Webb_202606';
// OUT_FILE's <head> has an IP-allowlist gate (2026/07/20). This script only patches
// data markers via regex and never touches <head> — do not replace with a full
// template rewrite without carrying the gate over.
const OUT_FILE = path.join(__dirname, 'D_GA_PageViewData_Webb_202606_Report.html');

// Category map for ActivityId → cat key
const CAT_MAP = {
    '39590':'concert','39664':'concert','39226':'sports', '39428':'sports',
    '39455':'sports', '39611':'concert','39667':'sports', '39678':'kpop',
    '39496':'anime',  '39559':'concert','39649':'kpop',   '39451':'sports',
    '39584':'anime',  '39603':'kpop',   '39511':'sports', '39458':'sports',
    '39682':'kpop',   '39680':'kpop',   '39494':'concert','38900':'concert',
    '39673':'kpop',   '39490':'anime',  '39453':'concert','39005':'sports',
    '39605':'kpop',   '39650':'concert','39555':'anime',  '39666':'sports',
    '39607':'kpop',   '39549':'kpop',   '39556':'anime',  '39527':'concert'
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

async function main() {
    try {
        console.log('Connecting to MongoDB...');
        await client.connect();
        const col = client.db('QwareAi').collection(COLL);

        // ── Latest UpdateTime ────────────────────────────────────────────────
        const lastDoc = await col.findOne({}, { sort: { UpdateTime: -1 }, projection: { UpdateTime: 1 } });
        const updateTimeStr = lastDoc?.UpdateTime
            ? toTWTStr(new Date(lastDoc.UpdateTime))
            : toTWTStr(new Date());
        console.log('UpdateTime (TWN):', updateTimeStr);

        // ── DAILY: total PV per day ──────────────────────────────────────────
        console.log('Aggregating DAILY...');
        const dailyRaw = await col.aggregate([
            { $group: {
                _id:      { $dateToString: { format: '%m/%d', date: '$EventDate', timezone: 'Asia/Taipei' } },
                totalPV:  { $sum: '$EventCount' },
                actCount: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ]).toArray();
        const DAILY = dailyRaw.map(d => ({ date: d._id, totalPV: d.totalPV, actCount: d.actCount }));

        // ── DATA: per-activity per-date PV + total ───────────────────────────
        console.log('Aggregating DATA...');
        const actDateRaw = await col.aggregate([
            { $group: {
                _id:  { actId: '$ActivityId', date: { $dateToString: { format: '%m/%d', date: '$EventDate', timezone: 'Asia/Taipei' } } },
                name: { $last: '$ActivityName' },
                pv:   { $sum: '$EventCount' }
            }},
            { $sort: { '_id.date': 1 } }
        ]).toArray();

        const actMap = {};
        actDateRaw.forEach(r => {
            const id   = r._id.actId;
            const date = r._id.date;
            if (!actMap[id]) actMap[id] = { id, name: r.name, pvByDate: {}, pv: 0 };
            actMap[id].pvByDate[date] = r.pv;
            actMap[id].pv += r.pv;
        });
        const DATA = Object.values(actMap)
            .sort((a, b) => b.pv - a.pv)
            .map((a, i) => ({
                rank:     i + 1,
                id:       a.id,
                name:     a.name,
                cat:      CAT_MAP[a.id] || 'concert',
                pv:       a.pv,
                pvByDate: a.pvByDate
            }));

        // ── Build new data section ───────────────────────────────────────────
        const newDataSection =
`// ── Data ──────────────────────────────────────────────────────────────────
const DAILY = ${JSON.stringify(DAILY, null, 2)};
const DATA = ${JSON.stringify(DATA, null, 2)};
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

        // Update updateTimeLabel
        html = html.replace(
            /(<span id="updateTimeLabel">)[^<]*(<\/span>)/,
            `$1${updateTimeStr}$2`
        );

        // Update footer snapshot date span (快照日期)
        if (DAILY.length) {
            const firstDate = `2026/${DAILY[0].date}`;
            const lastDate  = `2026/${DAILY[DAILY.length - 1].date}`;
            const rangeStr  = DAILY.length === 1 ? `快照日期：${firstDate}` : `資料期間：${firstDate} — ${lastDate}`;
            html = html.replace(/快照日期：[^｜<]+/, rangeStr);
        }

        fs.writeFileSync(OUT_FILE, html, 'utf8');
        console.log(`Done. Days: ${DAILY.length}, Activities: ${DATA.length}, UpdateTime: ${updateTimeStr}`);

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

main();
