require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs   = require('fs');
const path = require('path');
const { CAT_MAP } = require('./d_system_activity_category_map');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

const COLL_PV    = 'GA_D_PageViewData_Webb_202606';
const COLL_CLICK = 'GA_D_ClickData_Webb_202606';
// OUT_FILE's <head> has an IP-allowlist gate (copied from D_GA_Funnel_202606_Report.html).
// This script only patches the Data markers via regex and never touches <head> — do not
// replace with a full template rewrite without carrying the gate over.
const OUT_FILE = path.join(__dirname, 'D_GA_Traffic_Daily_Report.html');

function toTWTStr(d) {
    const tw = new Date(d.getTime() + 8 * 3600000);
    const mm  = String(tw.getUTCMonth()+1).padStart(2,'0');
    const dd  = String(tw.getUTCDate()).padStart(2,'0');
    const hh  = String(tw.getUTCHours()).padStart(2,'0');
    const min = String(tw.getUTCMinutes()).padStart(2,'0');
    return `${tw.getUTCFullYear()}/${mm}/${dd} ${hh}:${min}`;
}

const twMMDD = d => {
    const t = new Date(d.getTime() + 8 * 3600000);
    return `${String(t.getUTCMonth()+1).padStart(2,'0')}/${String(t.getUTCDate()).padStart(2,'0')}`;
};

async function main() {
    try {
        await client.connect();
        const db = client.db('QwareAi');

        console.log('Querying PageView totals...');
        const pvRaw = await db.collection(COLL_PV).aggregate([
            { $group: { _id: '$ActivityId', name: { $last: '$ActivityName' }, pv: { $sum: '$EventCount' } } },
            { $sort: { pv: -1 } }
        ]).toArray();

        console.log('Querying ClickData totals...');
        const clRaw = await db.collection(COLL_CLICK).aggregate([
            { $group: { _id: '$ActivityId', name: { $last: '$GameInfoName' }, clicks: { $sum: '$EventCount' } } },
            { $sort: { clicks: -1 } }
        ]).toArray();

        console.log('Querying daily PV/Click...');
        const pvDailyRaw = await db.collection(COLL_PV).aggregate([
            { $group: { _id: { id: '$ActivityId', date: '$EventDate' }, n: { $sum: '$EventCount' } } }
        ]).toArray();
        const clDailyRaw = await db.collection(COLL_CLICK).aggregate([
            { $group: { _id: { id: '$ActivityId', date: '$EventDate' }, n: { $sum: '$EventCount' } } }
        ]).toArray();

        // Per-activity per-day maps (same shape as generate_d_ga_funnel_report.js's
        // PV_BY_DATE / CLICK_ACT_DAILY, recomputed independently here — this generator
        // never reads the funnel report's output, only the same two Mongo collections).
        const PV_BY_DATE = {};
        pvDailyRaw.forEach(r => {
            const id = r._id.id, date = twMMDD(r._id.date);
            (PV_BY_DATE[id] = PV_BY_DATE[id] || {})[date] = (PV_BY_DATE[id][date] || 0) + r.n;
        });
        for (const id of Object.keys(PV_BY_DATE)) {
            PV_BY_DATE[id] = Object.fromEntries(Object.entries(PV_BY_DATE[id]).sort((a,b) => a[0].localeCompare(b[0])));
        }

        const clDailyMap = {};
        clDailyRaw.forEach(r => {
            const id = r._id.id, date = twMMDD(r._id.date);
            (clDailyMap[id] = clDailyMap[id] || {})[date] = (clDailyMap[id][date] || 0) + r.n;
        });
        const CLICK_ACT_DAILY = {};
        for (const id of Object.keys(clDailyMap)) {
            CLICK_ACT_DAILY[id] = Object.entries(clDailyMap[id])
                .sort((a,b) => a[0].localeCompare(b[0]))
                .map(([date, total]) => ({ date, total }));
        }

        // D-system-wide daily totals: sum PV/Click across every activity for each date.
        const dailyTotalMap = {};
        pvDailyRaw.forEach(r => {
            const date = twMMDD(r._id.date);
            dailyTotalMap[date] = dailyTotalMap[date] || { date, pv: 0, clicks: 0 };
            dailyTotalMap[date].pv += r.n;
        });
        clDailyRaw.forEach(r => {
            const date = twMMDD(r._id.date);
            dailyTotalMap[date] = dailyTotalMap[date] || { date, pv: 0, clicks: 0 };
            dailyTotalMap[date].clicks += r.n;
        });
        const DAILY_TOTAL = Object.values(dailyTotalMap).sort((a,b) => a.date.localeCompare(b.date));

        // Per-activity ranking (PV/Click totals + rank + category).
        const pvMap = {};
        pvRaw.forEach((r,i) => { pvMap[r._id] = { name: r.name, pv: r.pv, pvRank: i+1 }; });
        const clMap = {};
        clRaw.forEach((r,i) => { clMap[r._id] = { name: r.name, clicks: r.clicks, clickRank: i+1 }; });
        const allIds = [...new Set([...Object.keys(pvMap), ...Object.keys(clMap)])];
        const pvTotal = pvRaw.reduce((s,r) => s + r.pv, 0);
        const clickTotal = clRaw.reduce((s,r) => s + r.clicks, 0);

        const ACTIVITY_RANKING = allIds.map(id => {
            const pv = pvMap[id], cl = clMap[id];
            return {
                id,
                name: pv?.name || cl?.name || id,
                cat: CAT_MAP[id] || 'concert',
                pv: pv?.pv ?? null,
                pvRank: pv?.pvRank ?? null,
                pvShare: pv ? +(pv.pv / pvTotal * 100).toFixed(1) : null,
                clicks: cl?.clicks ?? null,
                clickRank: cl?.clickRank ?? null,
                clickShare: cl ? +(cl.clicks / clickTotal * 100).toFixed(1) : null,
            };
        }).sort((a,b) => (b.pv||0) - (a.pv||0));

        const PV_DATES = [...new Set(pvDailyRaw.map(r => twMMDD(r._id.date)))].sort((a,b) => a.localeCompare(b));
        const CL_DATES = [...new Set(clDailyRaw.map(r => twMMDD(r._id.date)))].sort((a,b) => a.localeCompare(b));

        const DATA_META = {
            pvDateFrom: PV_DATES[0], pvDateTo: PV_DATES[PV_DATES.length-1],
            clickDateFrom: CL_DATES[0], clickDateTo: CL_DATES[CL_DATES.length-1],
            totalActivities: allIds.length,
            generatedAt: toTWTStr(new Date()),
        };

        let html = fs.readFileSync(OUT_FILE, 'utf8');

        const newData =
`// ── Data Start ──────────────────────────────────────────────────────────────
const DAILY_TOTAL = ${JSON.stringify(DAILY_TOTAL, null, 2)};
const ACTIVITY_RANKING = ${JSON.stringify(ACTIVITY_RANKING, null, 2)};
const PV_BY_DATE = ${JSON.stringify(PV_BY_DATE, null, 2)};
const CLICK_ACT_DAILY = ${JSON.stringify(CLICK_ACT_DAILY, null, 2)};
const DATA_META = ${JSON.stringify(DATA_META, null, 2)};
// ── Data End ────────────────────────────────────────────────────────────────`;

        html = html.replace(
            /\/\/ ── Data Start ──+[\s\S]*?\/\/ ── Data End ──+/,
            newData
        );

        fs.writeFileSync(OUT_FILE, html, 'utf8');
        console.log('Written to', OUT_FILE);
        console.log('DAILY_TOTAL days:', DAILY_TOTAL.length, '| Activities:', allIds.length,
                     '| PV range:', DATA_META.pvDateFrom, '-', DATA_META.pvDateTo,
                     '| Click range:', DATA_META.clickDateFrom, '-', DATA_META.clickDateTo);
    } finally {
        await client.close();
    }
}

main().catch(err => { console.error(err); process.exit(1); });
