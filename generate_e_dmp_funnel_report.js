require('dotenv').config({ path: __dirname + '/.env', quiet: true });
// Generates all data blocks for E_DMP_Funnel_Report.html from the DMP `event`
// collection (bu:"E"). Two-stage funnel: page_view -> purchase (qty + revenue).
// See REPORT_SPEC_E_DMP_FUNNEL.md for the data model.
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uriDMP = process.env.MONGODB_URI_DMP;

// OUT_FILE's <head> has an IP-allowlist gate (2026/07/20). This script only patches
// the Data Start/End block below and never touches <head> — do not replace with a
// full template rewrite without carrying the gate over.
const OUT_FILE = path.join(__dirname, 'E_DMP_Funnel_Report.html');
const DATA_START = '// ── Data Start ──────────────────────────────────────────────────────────────';
const DATA_END   = '// ── Data End ────────────────────────────────────────────────────────────────';

function sortDays(obj) {
    const sorted = {};
    Object.keys(obj).sort().forEach(k => { sorted[k] = obj[k]; });
    return sorted;
}

async function main() {
    const client = new MongoClient(uriDMP);
    try {
        await client.connect();
        const eventColl = client.db('trek-first-party-dmp').collection('event');

        console.log('Querying page_view events (bucketed by day)...');
        const pvRows = await eventColl.aggregate([
            { $match: { bu: 'E', name: 'page_view' } },
            { $group: {
                _id: { act: '$attribution_id', day: { $dateToString: { date: '$time', format: '%m/%d', timezone: '+08:00' } } },
                pv: { $sum: 1 },
                name: { $last: '$content_name' }
            }}
        ], { allowDiskUse: true }).toArray();
        console.log(`  ${pvRows.length} (activity, day) PV buckets`);

        console.log('Querying purchase events (bucketed by day, qty + revenue)...');
        const purRows = await eventColl.aggregate([
            { $match: { bu: 'E', name: 'purchase' } },
            { $group: {
                _id: { act: '$attribution_id', day: { $dateToString: { date: '$time', format: '%m/%d', timezone: '+08:00' } } },
                qty: { $sum: { $ifNull: ['$quantity', 1] } },
                rev: { $sum: { $multiply: [{ $toDouble: { $ifNull: ['$price', 0] } }, { $ifNull: ['$quantity', 1] }] } },
                name: { $last: '$content_name' }
            }}
        ], { allowDiskUse: true }).toArray();
        console.log(`  ${purRows.length} (activity, day) purchase buckets`);

        // Build per-activity structures
        const PV_BY_DATE = {}, PUR_BY_DATE = {}, REV_BY_DATE = {};
        const names = {};      // page_view content_name is clean (purchase's has a " - 票種" suffix)
        const purNames = {};   // fallback names from purchase events

        pvRows.forEach(r => {
            const { act, day } = r._id;
            if (!act) return;
            if (!PV_BY_DATE[act]) PV_BY_DATE[act] = {};
            PV_BY_DATE[act][day] = (PV_BY_DATE[act][day] || 0) + r.pv;
            if (r.name) names[act] = r.name;
        });
        purRows.forEach(r => {
            const { act, day } = r._id;
            if (!act) return;
            if (!PUR_BY_DATE[act]) PUR_BY_DATE[act] = {};
            if (!REV_BY_DATE[act]) REV_BY_DATE[act] = {};
            PUR_BY_DATE[act][day] = (PUR_BY_DATE[act][day] || 0) + r.qty;
            REV_BY_DATE[act][day] = Math.round(((REV_BY_DATE[act][day] || 0) + r.rev) * 100) / 100;
            if (r.name) purNames[act] = r.name.replace(/\s+-\s+[^-]*$/, '');
        });

        // Sort day keys + collect date universe
        const daySet = new Set();
        [PV_BY_DATE, PUR_BY_DATE, REV_BY_DATE].forEach(m => {
            Object.keys(m).forEach(act => {
                m[act] = sortDays(m[act]);
                Object.keys(m[act]).forEach(d => daySet.add(d));
            });
        });
        const E_DATES = [...daySet].sort();

        // FUNNEL_DATA: one row per activity
        const allActs = new Set([...Object.keys(PV_BY_DATE), ...Object.keys(PUR_BY_DATE)]);
        const FUNNEL_DATA = [...allActs].map(act => {
            const pv  = PV_BY_DATE[act]  ? Object.values(PV_BY_DATE[act]).reduce((s, v) => s + v, 0)  : null;
            const qty = PUR_BY_DATE[act] ? Object.values(PUR_BY_DATE[act]).reduce((s, v) => s + v, 0) : null;
            const rev = REV_BY_DATE[act] ? Math.round(Object.values(REV_BY_DATE[act]).reduce((s, v) => s + v, 0)) : null;
            return {
                id: act,
                name: names[act] || purNames[act] || act,
                pv, qty, rev,
                conv: (pv && qty) ? +(qty / pv * 100).toFixed(1) : null,
            };
        });
        // Ranks
        FUNNEL_DATA.filter(d => d.pv != null).sort((a, b) => b.pv - a.pv).forEach((d, i) => { d.pvRank = i + 1; });
        FUNNEL_DATA.filter(d => d.pv == null).forEach(d => { d.pvRank = null; });
        FUNNEL_DATA.filter(d => d.qty != null).sort((a, b) => b.qty - a.qty).forEach((d, i) => { d.qtyRank = i + 1; });
        FUNNEL_DATA.filter(d => d.qty == null).forEach(d => { d.qtyRank = null; });
        FUNNEL_DATA.sort((a, b) => (a.pvRank ?? Infinity) - (b.pvRank ?? Infinity));

        const pvDays  = new Set(); Object.values(PV_BY_DATE).forEach(m => Object.keys(m).forEach(d => pvDays.add(d)));
        const purDays = new Set(); Object.values(PUR_BY_DATE).forEach(m => Object.keys(m).forEach(d => purDays.add(d)));
        const pvD = [...pvDays].sort(), purD = [...purDays].sort();

        const SUMMARY = {
            pvTotal:      FUNNEL_DATA.reduce((s, d) => s + (d.pv || 0), 0),
            qtyTotal:     FUNNEL_DATA.reduce((s, d) => s + (d.qty || 0), 0),
            revTotal:     FUNNEL_DATA.reduce((s, d) => s + (d.rev || 0), 0),
            pvActCount:   Object.keys(PV_BY_DATE).length,
            purActCount:  Object.keys(PUR_BY_DATE).length,
            matchedCount: FUNNEL_DATA.filter(d => d.pv != null && d.qty != null).length,
            pvDates:  pvD.length  ? `${pvD[0]} – ${pvD[pvD.length - 1]}`   : '—',
            purDates: purD.length ? `${purD[0]} – ${purD[purD.length - 1]}` : '—',
        };

        const block = `${DATA_START}
const FUNNEL_DATA = ${JSON.stringify(FUNNEL_DATA)};
const SUMMARY = ${JSON.stringify(SUMMARY)};
const PV_BY_DATE = ${JSON.stringify(PV_BY_DATE)};
const PUR_BY_DATE = ${JSON.stringify(PUR_BY_DATE)};
const REV_BY_DATE = ${JSON.stringify(REV_BY_DATE)};
const E_DATES = ${JSON.stringify(E_DATES)};
${DATA_END}`;

        let html = fs.readFileSync(OUT_FILE, 'utf8');
        const si = html.indexOf(DATA_START);
        const ei = html.indexOf(DATA_END);
        if (si === -1 || ei === -1) throw new Error('Data markers not found');
        html = html.slice(0, si) + block + html.slice(ei + DATA_END.length);

        // Update timestamp in header
        const now = new Date();
        const ts = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        html = html.replace(/(<span id="updateTimeLabel">)[^<]*(<\/span>)/, `$1${ts}$2`);

        fs.writeFileSync(OUT_FILE, html, 'utf8');
        console.log(`Done. Activities: ${FUNNEL_DATA.length} (PV: ${SUMMARY.pvActCount}, purchase: ${SUMMARY.purActCount}, matched: ${SUMMARY.matchedCount})`);
        console.log(`Totals: PV ${SUMMARY.pvTotal.toLocaleString()}, qty ${SUMMARY.qtyTotal.toLocaleString()}, revenue $${SUMMARY.revTotal.toLocaleString()}`);
        console.log(`Dates: ${E_DATES[0]} – ${E_DATES[E_DATES.length - 1]}`);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

main();
