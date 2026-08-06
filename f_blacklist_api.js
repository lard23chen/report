require('dotenv').config({ path: __dirname + '/.env', quiet: true });
// API backend for F_MEM_BlackList_Query_Report.html (see REPORT_SPEC_F_MEM_BLACKLIST.md).
// Replaces the earlier static-embed approach (generator baked MongoDB query results
// directly into the HTML, which had ballooned to ~88.5MB) with live queries against
// QwareAi. Deployed as a Vercel serverless function alongside stock_api.js etc.
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());

const MONGO_URI = process.env.MONGODB_URI_QWARE;
const DB_NAME = 'QwareAi';
const BL_COLL = 'Qware_MEM_BlackList_202608';
const IP_COLL = 'QWARE_MEM_IP_202608';
const BOOK_COLL = 'Qware_A_OrderTemp_log_202608';

const MAJOR_THRESHOLD = 5;
const IP_WINDOW_DAYS = 30;
const IP_LINK_CAP = 30;
const BOOKING_WINDOW_DAYS = 7;
const SEARCH_LIMIT = 200;

// Same list as the <head> inline IP-allowlist check in F_MEM_BlackList_Query_Report.html.
// Keep both copies in sync - this report carries member PII (EMAIL/USER_ID/mobile).
const ALLOWED_IPS = ['211.75.181.109', '211.75.181.110', '220.130.6.196', '220.130.6.197', '220.130.6.198', '220.130.134.238', '220.130.134.239', '220.130.134.240', '133.149.194.24'];

function clientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return fwd.split(',')[0].trim();
    return req.socket && req.socket.remoteAddress;
}

app.use((req, res, next) => {
    const ip = clientIp(req);
    if (!ALLOWED_IPS.includes(ip)) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    next();
});

let cachedClient = null;
let cachedDb = null;

async function getDb() {
    if (cachedDb) return cachedDb;
    console.log('=> connecting to database: ' + DB_NAME);
    const client = await MongoClient.connect(MONGO_URI);
    cachedClient = client;
    cachedDb = client.db(DB_NAME);
    return cachedDb;
}

function fmtTaipei(d) {
    if (!d) return null;
    const shifted = new Date(new Date(d).getTime() + 8 * 3600 * 1000);
    return shifted.toISOString().slice(0, 19).replace('T', ' ');
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/f-blacklist/search?mode=mobile|userid&kw=xxx
app.get('/api/f-blacklist/search', async (req, res) => {
    try {
        const mode = req.query.mode;
        const kw = (req.query.kw || '').trim();
        if (!['mobile', 'userid'].includes(mode) || !kw) {
            return res.status(400).json({ ok: false, error: 'invalid mode/kw' });
        }
        const db = await getDb();
        const coll = db.collection(BL_COLL);
        const field = mode === 'mobile' ? 'MOBILE' : 'USER_ID';
        const re = new RegExp(escapeRegex(kw));

        // Fetch one extra row to detect truncation without a second full-collection scan
        // (this regex can't use an index either way - see REPORT_SPEC §4 - so avoid doubling the cost).
        const fetched = await coll.find(
            { [field]: re },
            { projection: { USER_ID: 1, MOBILE_head: 1, MOBILE: 1, MEMO0: 1, CREATE_TIME: 1, UPDATE_TIME: 1, CREATE_USER: 1, UPDATE_USER: 1 } }
        ).limit(SEARCH_LIMIT + 1).toArray();
        const truncated = fetched.length > SEARCH_LIMIT;
        const rows = truncated ? fetched.slice(0, SEARCH_LIMIT) : fetched;

        // MAJOR check: for each distinct (MOBILE_head, MOBILE) pair in this batch,
        // count how many accounts share it (indexed exact match, see REPORT_SPEC §4).
        const pairs = [...new Map(rows.filter(r => r.MOBILE).map(r => [`${r.MOBILE_head || ''}|${r.MOBILE}`, { h: r.MOBILE_head || '', m: r.MOBILE }])).values()];
        const majorPairs = new Set();
        await Promise.all(pairs.map(async ({ h, m }) => {
            const n = await coll.countDocuments({ MOBILE_head: h, MOBILE: m });
            if (n >= MAJOR_THRESHOLD) majorPairs.add(`${h}|${m}`);
        }));

        const data = rows.map(r => ({
            uid: r.USER_ID || '',
            mobileHead: r.MOBILE_head || '',
            mobile: r.MOBILE || '',
            memo0: r.MEMO0 || null,
            createTime: fmtTaipei(r.CREATE_TIME),
            updateTime: fmtTaipei(r.UPDATE_TIME),
            createUser: r.CREATE_USER || '',
            updateUser: r.UPDATE_USER || '',
            isMajor: r.MOBILE ? majorPairs.has(`${r.MOBILE_head || ''}|${r.MOBILE}`) : false,
        }));

        res.json({ ok: true, truncated, data });
    } catch (e) {
        console.error('search error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// GET /api/f-blacklist/ip-links?uid=xxx
app.get('/api/f-blacklist/ip-links', async (req, res) => {
    try {
        const uid = (req.query.uid || '').trim();
        if (!uid) return res.status(400).json({ ok: false, error: 'missing uid' });
        const db = await getDb();
        const coll = db.collection(IP_COLL);
        const since = new Date(Date.now() - IP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

        const myRows = await coll.find(
            { user_id: uid, CREATE_TIME: { $gte: since } },
            { projection: { user_ip: 1, CREATE_TIME: 1 } }
        ).toArray();

        const byIp = new Map();
        for (const r of myRows) {
            if (!r.user_ip || !r.CREATE_TIME) continue;
            if (!byIp.has(r.user_ip) || byIp.get(r.user_ip) < r.CREATE_TIME) byIp.set(r.user_ip, r.CREATE_TIME);
        }
        const ipList = [...byIp.entries()].sort((a, b) => b[1] - a[1]);

        const links = await Promise.all(ipList.map(async ([ip, t]) => {
            const otherRows = await coll.find(
                { user_ip: ip, user_id: { $ne: uid }, CREATE_TIME: { $gte: since } },
                { projection: { user_id: 1, CREATE_TIME: 1 } }
            ).toArray();
            const byUser = new Map();
            for (const r of otherRows) {
                if (!r.user_id) continue;
                if (!byUser.has(r.user_id) || byUser.get(r.user_id) < r.CREATE_TIME) byUser.set(r.user_id, r.CREATE_TIME);
            }
            const others = [...byUser.entries()].sort((a, b) => b[1] - a[1]);
            return {
                ip,
                lastLogin: fmtTaipei(t),
                totalOthers: others.length,
                related: others.slice(0, IP_LINK_CAP).map(([u, ut]) => ({ uid: u, lastLogin: fmtTaipei(ut) })),
            };
        }));

        res.json({ ok: true, links });
    } catch (e) {
        console.error('ip-links error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// GET /api/f-blacklist/bookings?uid=xxx
app.get('/api/f-blacklist/bookings', async (req, res) => {
    try {
        const uid = (req.query.uid || '').trim();
        if (!uid) return res.status(400).json({ ok: false, error: 'missing uid' });
        const db = await getDb();
        const coll = db.collection(BOOK_COLL);
        const since = new Date(Date.now() - BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

        const rows = await coll.find(
            { order_user_id: uid, book_date_time: { $gte: since } },
            { projection: { performance_id: 1, order_seat: 1, book_date_time: 1, order_user_ip: 1 } }
        ).sort({ book_date_time: -1 }).toArray();

        const bookings = rows.map(r => ({
            performanceId: r.performance_id || '',
            seat: r.order_seat || '',
            time: fmtTaipei(r.book_date_time),
            ip: r.order_user_ip || '',
        }));

        res.json({ ok: true, bookings });
    } catch (e) {
        console.error('bookings error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// GET /api/f-blacklist/meta
app.get('/api/f-blacklist/meta', async (req, res) => {
    try {
        const db = await getDb();
        const coll = db.collection(BL_COLL);
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [totalMembers, blacklistCount30d] = await Promise.all([
            coll.countDocuments({}),
            coll.countDocuments({ MEMO0: 'Y', UPDATE_TIME: { $gte: since } }),
        ]);

        res.json({
            ok: true,
            totalMembers,
            blacklistCount30d,
            ipWindowDays: IP_WINDOW_DAYS,
            ipLinkCap: IP_LINK_CAP,
            bookingWindowDays: BOOKING_WINDOW_DAYS,
        });
    } catch (e) {
        console.error('meta error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Support local development
if (process.env.NODE_ENV !== 'production') {
    const port = 3002;
    app.listen(port, () => console.log(`F blacklist API running at http://localhost:${port}`));
}

module.exports = app;
