require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs   = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

const COLL_PV    = 'GA_D_PageViewData_Webb_202606';
const COLL_CLICK = 'GA_D_ClickData_Webb_202606';
// OUT_FILE's <head> has an IP-allowlist gate (2026/07/20). This script (and the
// cart-data patcher generate_d_ga_funnel_cart_data.js, which shares OUT_FILE) only
// patch data markers via regex and never touch <head> — do not replace with a full
// template rewrite without carrying the gate over.
const OUT_FILE   = path.join(__dirname, 'D_GA_Funnel_202606_Report.html');

const CAT_MAP = {
    '39590':'concert','39664':'concert','39226':'sports','39428':'sports',
    '39455':'sports', '39611':'concert','39667':'sports','39678':'kpop',
    '39496':'anime',  '39559':'concert','39649':'kpop',  '39451':'sports',
    '39584':'anime',  '39603':'kpop',   '39511':'sports','39458':'sports',
    '39682':'kpop',   '39680':'kpop',   '39494':'concert','38900':'concert',
    '39673':'kpop',   '39490':'anime',  '39453':'concert','39005':'sports',
    '39605':'kpop',   '39650':'concert','39555':'anime',  '39666':'sports',
    '39607':'kpop',   '39549':'kpop',   '39556':'anime',  '39527':'concert',
    '39696':'concert','39690':'concert','39689':'sports', '39692':'concert',
    '39665':'concert','39576':'sports', '39190':'sports', '39470':'concert',
    '39648':'sports', '39619':'concert','39524':'sports', '39526':'kpop',
    '39575':'kpop',   '39550':'kpop',   '39610':'concert',
};

function toTWTStr(d) {
    const tw = new Date(d.getTime() + 8 * 3600000);
    const mm  = String(tw.getUTCMonth()+1).padStart(2,'0');
    const dd  = String(tw.getUTCDate()).padStart(2,'0');
    const hh  = String(tw.getUTCHours()).padStart(2,'0');
    const min = String(tw.getUTCMinutes()).padStart(2,'0');
    return `${tw.getUTCFullYear()}/${mm}/${dd} ${hh}:${min}`;
}

async function main() {
    try {
        await client.connect();
        const db = client.db('QwareAi');

        // ── Query PageView (per-activity PV totals) ──────────────────────────
        console.log('Querying PageView...');
        const pvRaw = await db.collection(COLL_PV).aggregate([
            { $group: {
                _id:  '$ActivityId',
                name: { $last: '$ActivityName' },
                pv:   { $sum: '$EventCount' },
                minDate: { $min: '$EventDate' },
                maxDate: { $max: '$EventDate' },
            }},
            { $sort: { pv: -1 } }
        ]).toArray();

        // ── Query ClickData (per-activity click totals) ──────────────────────
        console.log('Querying ClickData...');
        const clRaw = await db.collection(COLL_CLICK).aggregate([
            { $group: {
                _id:       '$ActivityId',
                name:      { $last: '$GameInfoName' },
                clicks:    { $sum: '$EventCount' },
                loggedIn:  { $sum: '$LoggedInCount' },
                notIn:     { $sum: '$NotLoggedInCount' },
                perf:      { $sum: 1 },
            }},
            { $sort: { clicks: -1 } }
        ]).toArray();

        // ── Query per-day PV / Click (for PV_BY_DATE / CLICK_ACT_DAILY / date pickers) ──
        console.log('Querying daily PV/Click...');
        const twMMDD = d => {
            const t = new Date(d.getTime() + 8 * 3600000); // EventDate UTC → 台北
            return `${String(t.getUTCMonth()+1).padStart(2,'0')}/${String(t.getUTCDate()).padStart(2,'0')}`;
        };
        const pvDailyRaw = await db.collection(COLL_PV).aggregate([
            { $group: { _id: { id:'$ActivityId', date:'$EventDate' }, n: { $sum:'$EventCount' } } }
        ]).toArray();
        const clDailyRaw = await db.collection(COLL_CLICK).aggregate([
            { $group: { _id: { id:'$ActivityId', date:'$EventDate' }, n: { $sum:'$EventCount' } } }
        ]).toArray();

        const PV_BY_DATE_OBJ = {};
        pvDailyRaw.forEach(r => {
            const id = r._id.id, date = twMMDD(r._id.date);
            (PV_BY_DATE_OBJ[id] = PV_BY_DATE_OBJ[id] || {})[date] = (PV_BY_DATE_OBJ[id][date] || 0) + r.n;
        });
        // 日期鍵依序排列（MM/DD 零補齊，字串排序即時間序）
        for (const id of Object.keys(PV_BY_DATE_OBJ)) {
            PV_BY_DATE_OBJ[id] = Object.fromEntries(Object.entries(PV_BY_DATE_OBJ[id]).sort((a,b) => a[0].localeCompare(b[0])));
        }

        const clDailyMap = {};
        clDailyRaw.forEach(r => {
            const id = r._id.id, date = twMMDD(r._id.date);
            (clDailyMap[id] = clDailyMap[id] || {})[date] = (clDailyMap[id][date] || 0) + r.n;
        });
        const CLICK_ACT_DAILY_OBJ = {};
        for (const id of Object.keys(clDailyMap)) {
            CLICK_ACT_DAILY_OBJ[id] = Object.entries(clDailyMap[id])
                .sort((a,b) => a[0].localeCompare(b[0]))
                .map(([date, total]) => ({ date, total }));
        }

        const PV_DATES_ARR = [...new Set(pvDailyRaw.map(r => twMMDD(r._id.date)))].sort((a,b) => a.localeCompare(b));
        const CL_DATES_ARR = [...new Set(clDailyRaw.map(r => twMMDD(r._id.date)))].sort((a,b) => a.localeCompare(b));

        // ── Merge by ActivityId ──────────────────────────────────────────────
        const pvMap  = {};
        pvRaw.forEach((r,i) => { pvMap[r._id]  = { name:r.name,  pv:r.pv,  pvRank:i+1  }; });

        const clMap  = {};
        clRaw.forEach((r,i) => { clMap[r._id]  = { name:r.name, clicks:r.clicks, loggedIn:r.loggedIn, notIn:r.notIn, perf:r.perf, clickRank:i+1 }; });

        const allIds = [...new Set([...Object.keys(pvMap), ...Object.keys(clMap)])];

        const merged = allIds.map(id => {
            const pv   = pvMap[id];
            const cl   = clMap[id];
            const cat  = CAT_MAP[id] || 'concert';
            const name = pv?.name || cl?.name || id;
            const pvVal    = pv?.pv    ?? null;
            const clVal    = cl?.clicks ?? null;
            const ctr      = (pvVal && clVal) ? +(clVal/pvVal*100).toFixed(1) : null;
            return { id, name, cat, pv:pvVal, pvRank:pv?.pvRank??null, clicks:clVal, clickRank:cl?.clickRank??null, ctr,
                     loggedIn:cl?.loggedIn??null, notIn:cl?.notIn??null, perf:cl?.perf??null };
        }).sort((a,b) => {
            // sort: matched first (both non-null) by pv desc, then pv-only, then click-only
            const da = (a.pv!=null&&a.clicks!=null)?0:(a.pv!=null?1:2);
            const db_ = (b.pv!=null&&b.clicks!=null)?0:(b.pv!=null?1:2);
            if(da!==db_) return da-db_;
            return (b.pv||b.clicks||0) - (a.pv||a.clicks||0);
        });

        // ── Compute pvShare and clickShare ───────────────────────────────────
        const pvTotal    = pvRaw.reduce((s,r)=>s+r.pv,0);
        const clickTotal = clRaw.reduce((s,r)=>s+r.clicks,0);
        const matchedCount    = merged.filter(d=>d.pv!=null&&d.clicks!=null).length;
        const pvOnlyCount     = merged.filter(d=>d.pv!=null&&d.clicks==null).length;
        const clickOnlyCount  = merged.filter(d=>d.pv==null&&d.clicks!=null).length;
        const matchedPV       = merged.filter(d=>d.pv!=null&&d.clicks!=null).reduce((s,d)=>s+d.pv,0);
        const matchedClicks   = merged.filter(d=>d.pv!=null&&d.clicks!=null).reduce((s,d)=>s+d.clicks,0);

        merged.forEach(d => {
            d.pvShare    = d.pv    != null ? +(d.pv/pvTotal*100).toFixed(1)       : null;
            d.clickShare = d.clicks!= null ? +(d.clicks/clickTotal*100).toFixed(1): null;
        });

        // pvDate / clickDate range（取自每日聚合的日期陣列，與 header tags 一致）
        const pvDates = PV_DATES_ARR.length
            ? `2026/${PV_DATES_ARR[0]} – 2026/${PV_DATES_ARR.at(-1)}`
            : '—';
        const clickDates = CL_DATES_ARR.length
            ? `2026/${CL_DATES_ARR[0]} – 2026/${CL_DATES_ARR.at(-1)}`
            : '—';

        const now = toTWTStr(new Date());

        const SUMMARY_OBJ = {
            pvTotal, clickTotal, matchedCount, pvOnlyCount, clickOnlyCount,
            matchedPV, matchedClicks,
            pvDates, clickDates,
        };

        // ── Build data section ───────────────────────────────────────────────
        const newData =
`// ── Data ──────────────────────────────────────────────────────────────────
const FUNNEL_DATA = ${JSON.stringify(merged, null, 2)};

const SUMMARY = ${JSON.stringify(SUMMARY_OBJ, null, 2)};
`;

        // ── Patch HTML ───────────────────────────────────────────────────────
        let html = fs.readFileSync(OUT_FILE, 'utf8');
        const DATA_START = '// ── Data ──────────────────────────────────────────────────────────────────';
        const DATA_END   = '// ── Charts ─────────────────────────────────────────────────────────────────';
        const si = html.indexOf(DATA_START);
        const ei = html.indexOf(DATA_END);
        if(si===-1||ei===-1) throw new Error('Data section markers not found');
        html = html.slice(0,si) + newData + html.slice(ei);

        // ── Patch DailyData block（PV_BY_DATE / CLICK_ACT_DAILY）─────────────
        const DAILY_START = '// ── DailyData Start ──────────────────────────────────────────────────────';
        const DAILY_END   = '// ── DailyData End ────────────────────────────────────────────────────────';
        const dsi = html.indexOf(DAILY_START);
        const dei = html.indexOf(DAILY_END);
        if(dsi===-1||dei===-1) throw new Error('DailyData section markers not found');
        const newDaily =
`${DAILY_START}
// Per-activity daily PV (for date range filtering)
const PV_BY_DATE = ${JSON.stringify(PV_BY_DATE_OBJ, null, 2)};


// Per-activity daily click totals (for date range filtering)
const CLICK_ACT_DAILY = ${JSON.stringify(CLICK_ACT_DAILY_OBJ, null, 2)};
`;
        html = html.slice(0,dsi) + newDaily + html.slice(dei);

        // ── Patch PV_DATES / CL_DATES（date picker 白名單與 header tags 來源）──
        if(!/const PV_DATES = \[[^\]]*\];/.test(html) || !/const CL_DATES = \[[^\]]*\];/.test(html))
            throw new Error('PV_DATES / CL_DATES declarations not found');
        html = html.replace(/const PV_DATES = \[[^\]]*\];/, `const PV_DATES = ${JSON.stringify(PV_DATES_ARR)};`);
        html = html.replace(/const CL_DATES = \[[^\]]*\];/, `const CL_DATES = ${JSON.stringify(CL_DATES_ARR)};`);

        // Update timestamp
        html = html.replace(/(<span id="updateTimeLabel">)[^<]*(<\/span>)/, `$1${now}$2`);

        // Update KPI spans (top-level summary KPIs)
        const overallCtr = matchedPV ? +(matchedClicks/matchedPV*100).toFixed(1) : 0;
        const topCtr   = merged.filter(d=>d.ctr!=null).sort((a,b)=>b.ctr-a.ctr)[0];
        const lowCtr   = merged.filter(d=>d.ctr!=null).sort((a,b)=>a.ctr-b.ctr)[0];

        html = html.replace(/(<div class="kpi-val c-blue" id="kpi-pv-total">)[^<]*(<\/div>)/, `$1${pvTotal.toLocaleString()}$2`);
        html = html.replace(/(<div class="kpi-val c-purple" id="kpi-click-total">)[^<]*(<\/div>)/, `$1${clickTotal.toLocaleString()}$2`);
        html = html.replace(/(<div class="kpi-val c-cyan" id="kpi-matched">)[^<]*(<\/div>)/, `$1${matchedCount}$2`);
        html = html.replace(/(<div class="kpi-val c-rose" id="kpi-top-ctr">)[^<]*(<\/div>)/, `$1${topCtr?.ctr?.toFixed(1)}%$2`);
        html = html.replace(/(<div class="kpi-sub" id="kpi-top-ctr-name">)[^<]*(<\/div>)/, `$1${topCtr?.name?.substring(0,20)}$2`);
        html = html.replace(/(<div class="kpi-val c-amber" id="kpi-low-ctr">)[^<]*(<\/div>)/, `$1${lowCtr?.ctr?.toFixed(1)}%$2`);
        html = html.replace(/(<div class="kpi-sub" id="kpi-low-ctr-name">)[^<]*(<\/div>)/, `$1${lowCtr?.name?.substring(0,16)}（${lowCtr?.pv?.toLocaleString()} PV）$2`);
        html = html.replace(/(<div class="kpi-val c-green" id="kpi-overall-ctr">)[^<]*(<\/div>)/, `$1${overallCtr}%$2`);

        fs.writeFileSync(OUT_FILE, html, 'utf8');
        console.log(`Done. Activities: ${merged.length} (matched:${matchedCount} pvOnly:${pvOnlyCount} clickOnly:${clickOnlyCount}), pvTotal:${pvTotal}, clickTotal:${clickTotal}`);

    } catch(err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

main();
