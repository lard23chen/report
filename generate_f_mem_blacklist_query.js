require('dotenv').config({ path: __dirname + '/.env', quiet: true });
// Generates the data block for F_MEM_BlackList_Query_Report.html from
// Qware_MEM_BlackList_202608 (MongoDB QwareAi). BLACKLIST_DATA only embeds
// MEMO0='Y' rows within the last WINDOW_DAYS days of UPDATE_TIME (full
// collection is 400k+ rows; embedding everything with full detail would
// blow up the static file, see REPORT_SPEC_F_MEM_BLACKLIST.md).
//
// ALL_INDEX is a separate, much leaner {uid, mobile_head, mobile, memo0}
// index covering the ENTIRE collection (all ~400k accounts, regardless of
// blacklist status), so the phone search can find any member, not just
// recently-blacklisted ones. It's ~25MB by itself - a deliberate size
// tradeoff the user accepted (see spec doc changelog) so the search can
// stay fully client-side with no backend.
//
// Also precomputes IP_LINKS: for each embedded blacklisted account, its recent
// (IP_WINDOW_DAYS) login IPs from QWARE_MEM_IP_202608, and for each of those IPs,
// the other accounts that also logged in from it (capped at IP_LINK_CAP). This is
// precomputed here (not queried live from the page) because the report is a public
// static file - shipping the MongoDB URI to client-side JS would leak full DB access.
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
const WINDOW_DAYS = 30;
const IP_WINDOW_DAYS = 7;
const IP_LINK_CAP = 30;

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
        const blColl = db.collection('Qware_MEM_BlackList_202608');
        const ipColl = db.collection('QWARE_MEM_IP_202608');

        const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
        console.log(`Querying MEMO0='Y' rows with UPDATE_TIME >= ${since.toISOString()} ...`);
        const rows = await blColl.find(
            { MEMO0: 'Y', UPDATE_TIME: { $gte: since } },
            { projection: { USER_ID: 1, MOBILE_head: 1, MOBILE: 1, CREATE_TIME: 1, UPDATE_TIME: 1, CREATE_USER: 1, UPDATE_USER: 1 } }
        ).sort({ UPDATE_TIME: -1 }).toArray();
        console.log(`Fetched ${rows.length} blacklist rows.`);

        const BLACKLIST_DATA = rows.map(r => ({
            uid: r.USER_ID || '',
            mh: r.MOBILE_head || '',
            mobile: r.MOBILE || '',
            ct: fmtTaipei(r.CREATE_TIME),
            ut: fmtTaipei(r.UPDATE_TIME),
            cu: r.CREATE_USER || '',
            uu: r.UPDATE_USER || '',
        })).filter(r => r.ut);

        const days = BLACKLIST_DATA.map(r => r.ut.slice(0, 10)).sort();

        // ── ALL_INDEX: lean phone-search index over the whole collection ──────
        console.log('Querying full collection for ALL_INDEX (uid/mobile/memo0 only)...');
        const allRows = await blColl.find(
            {},
            { projection: { USER_ID: 1, MOBILE_head: 1, MOBILE: 1, MEMO0: 1 } }
        ).toArray();
        const ALL_INDEX = allRows
            .filter(r => r.MOBILE)
            .map(r => ({ u: r.USER_ID || '', h: r.MOBILE_head || '', m: r.MOBILE, f: r.MEMO0 || null }));
        console.log(`ALL_INDEX: ${ALL_INDEX.length} / ${allRows.length} rows have a MOBILE value.`);

        const DATA_META = {
            total: BLACKLIST_DATA.length,
            minDate: days[0] || null,
            maxDate: days[days.length - 1] || null,
            ipWindowDays: IP_WINDOW_DAYS,
            ipLinkCap: IP_LINK_CAP,
            allIndexTotal: ALL_INDEX.length,
        };

        // ── IP_LINKS precomputation ──────────────────────────────────────────
        const sinceIP = new Date(Date.now() - IP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        console.log(`Querying QWARE_MEM_IP_202608 with CREATE_TIME >= ${sinceIP.toISOString()} ...`);
        const ipRows = await ipColl.find(
            { CREATE_TIME: { $gte: sinceIP } },
            { projection: { user_id: 1, user_ip: 1, CREATE_TIME: 1 } }
        ).toArray();
        console.log(`Fetched ${ipRows.length} IP login rows.`);

        const userToIPs = new Map(); // uid -> [{ip, t}]
        const ipToUsers = new Map(); // ip -> Map(uid -> latest t)
        for (const r of ipRows) {
            const uid = r.user_id, ip = r.user_ip, t = r.CREATE_TIME;
            if (!uid || !ip || !t) continue;
            if (!userToIPs.has(uid)) userToIPs.set(uid, []);
            userToIPs.get(uid).push({ ip, t });
            if (!ipToUsers.has(ip)) ipToUsers.set(ip, new Map());
            const m = ipToUsers.get(ip);
            if (!m.has(uid) || m.get(uid) < t) m.set(uid, t);
        }

        const blacklistUids = BLACKLIST_DATA.map(r => r.uid);
        const IP_LINKS = {};
        let withLinks = 0;
        for (const uid of blacklistUids) {
            const ips = userToIPs.get(uid);
            if (!ips || ips.length === 0) continue;
            const byIp = new Map();
            for (const { ip, t } of ips) {
                if (!byIp.has(ip) || byIp.get(ip) < t) byIp.set(ip, t);
            }
            const ipList = [...byIp.entries()].sort((a, b) => b[1] - a[1]);
            IP_LINKS[uid] = ipList.map(([ip, t]) => {
                const usersMap = ipToUsers.get(ip);
                const others = [...usersMap.entries()].filter(([u]) => u !== uid).sort((a, b) => b[1] - a[1]);
                return {
                    ip,
                    t: fmtTaipei(t),
                    totalOthers: others.length,
                    related: others.slice(0, IP_LINK_CAP).map(([u, ut]) => ({ uid: u, t: fmtTaipei(ut) })),
                };
            });
            withLinks++;
        }
        console.log(`IP link data built for ${withLinks} / ${blacklistUids.length} blacklisted accounts.`);

        const block = `${DATA_START}
const BLACKLIST_DATA = ${JSON.stringify(BLACKLIST_DATA)};
const DATA_META = ${JSON.stringify(DATA_META)};
const IP_LINKS = ${JSON.stringify(IP_LINKS)};
const ALL_INDEX = ${JSON.stringify(ALL_INDEX)};
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
        console.log(`Done. ${DATA_META.total} rows embedded, range ${DATA_META.minDate} ~ ${DATA_META.maxDate}. IP links for ${withLinks} accounts. ALL_INDEX: ${ALL_INDEX.length} accounts.`);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

main();
