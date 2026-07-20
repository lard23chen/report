require('dotenv').config({ path: __dirname + '/.env', quiet: true });
// Generates CART_DATA / PURCHASE_DATA / CART_BY_DATE / PURCHASE_BY_DATE for
// D_GA_Funnel_202606_Report.html from the DMP `event` collection, joined to
// ActivityId via GA_D_ClickData_Webb_202606's ProductId. See
// REPORT_SPEC_D_GA_FUNNEL_202606.md §3.3/§6 for the data model and join key.
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uriGA  = process.env.MONGODB_URI_QWARE;
const uriDMP = process.env.MONGODB_URI_DMP;

// OUT_FILE's <head> has an IP-allowlist gate (2026/07/20). This script only patches
// the CART/PURCHASE markers below and never touches <head> — do not replace with a
// full template rewrite without carrying the gate over.
const OUT_FILE = path.join(__dirname, 'D_GA_Funnel_202606_Report.html');
const CART_START = '// ── CartPurchase Data Start ──────────────────────────────────────────────';
const CART_END   = '// ── CartPurchase Data End ────────────────────────────────────────────────';

async function queryByDay(eventColl, eventName, knownProductIds) {
    return eventColl.aggregate([
        { $match: { bu: 'A', name: eventName, attribution_id: { $in: knownProductIds } } },
        { $group: {
            _id: { pid: '$attribution_id', day: { $dateToString: { date: '$time', format: '%m/%d', timezone: '+08:00' } } },
            qty: { $sum: '$quantity' }
        }}
    ]).toArray();
}

function buildByDate(rows, prodToActivity) {
    const byDate = {};
    const totals = {};
    rows.forEach(r => {
        const act = prodToActivity[r._id.pid];
        if (!act) return;
        const day = r._id.day;
        const qty = r.qty || 0;
        if (!byDate[act]) byDate[act] = {};
        byDate[act][day] = (byDate[act][day] || 0) + qty;
        totals[act] = (totals[act] || 0) + qty;
    });
    // Sort each activity's day keys chronologically for readability
    Object.keys(byDate).forEach(act => {
        const sorted = {};
        Object.keys(byDate[act]).sort().forEach(day => { sorted[day] = byDate[act][day]; });
        byDate[act] = sorted;
    });
    return { byDate, totals };
}

async function main() {
    const clientGA = new MongoClient(uriGA);
    const clientDMP = new MongoClient(uriDMP);
    try {
        await clientGA.connect();
        await clientDMP.connect();

        console.log('Building ProductId -> ActivityId map from ClickData...');
        const clickColl = clientGA.db('QwareAi').collection('GA_D_ClickData_Webb_202606');
        const pairs = await clickColl.aggregate([
            { $group: { _id: '$ProductId', ActivityId: { $last: '$ActivityId' } } }
        ]).toArray();
        const prodToActivity = {};
        pairs.forEach(p => { if (p._id && p.ActivityId) prodToActivity[p._id] = p.ActivityId; });
        const knownProductIds = Object.keys(prodToActivity);
        console.log(`Mapped ${knownProductIds.length} ProductIds to ActivityIds.`);

        const eventColl = clientDMP.db('trek-first-party-dmp').collection('event');

        console.log('Querying add_to_cart events (bucketed by day)...');
        const cartRows = await queryByDay(eventColl, 'add_to_cart', knownProductIds);
        console.log('Querying purchase events (bucketed by day)...');
        const purchaseRows = await queryByDay(eventColl, 'purchase', knownProductIds);

        const { byDate: CART_BY_DATE, totals: CART_DATA } = buildByDate(cartRows, prodToActivity);
        const { byDate: PURCHASE_BY_DATE, totals: PURCHASE_DATA } = buildByDate(purchaseRows, prodToActivity);

        const block = `${CART_START}
// A購物車：加入購物車次數（bu:"A", name:"add_to_cart"），keyed by ActivityId
const CART_DATA = ${JSON.stringify(CART_DATA)};

// A結帳：完成購買次數（bu:"A", name:"purchase"），keyed by ActivityId
const PURCHASE_DATA = ${JSON.stringify(PURCHASE_DATA)};

// Per-activity daily cart/purchase totals (for PV date range filtering)
const CART_BY_DATE = ${JSON.stringify(CART_BY_DATE, null, 2)};
const PURCHASE_BY_DATE = ${JSON.stringify(PURCHASE_BY_DATE, null, 2)};
${CART_END}`;

        let html = fs.readFileSync(OUT_FILE, 'utf8');
        const si = html.indexOf(CART_START);
        const ei = html.indexOf(CART_END);
        if (si === -1 || ei === -1) throw new Error('CartPurchase Data markers not found');
        html = html.slice(0, si) + block + html.slice(ei + CART_END.length);
        fs.writeFileSync(OUT_FILE, html, 'utf8');

        console.log(`Done. Activities with cart data: ${Object.keys(CART_DATA).length}, purchase data: ${Object.keys(PURCHASE_DATA).length}`);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        await clientGA.close();
        await clientDMP.close();
    }
}

main();
