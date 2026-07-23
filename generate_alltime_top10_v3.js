require('dotenv').config({ path: __dirname + '/.env', quiet: true });
﻿const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_DMP;
const MAIN_HTML_PATH = path.join(__dirname, 'A_DMP_PageView_Report_AllTime_Top10.html');
const DETAILS_DIR = path.join(__dirname, 'dmp_details_alltime');

// Incremental architecture (2026/07/23):
// State (last-processed checkpoint + all-program totals + per-Top10-program breakdowns) is
// embedded in the generated main HTML via `generatedAt` / `/*SD_START*/.../*SD_END*/` markers,
// the same idiom generate_ga_events_report.js already uses. On each run:
//   - no state found  -> full historical bootstrap (like the old script), ~40min, one-time cost
//   - state found     -> only fetch docs newer than the checkpoint (fast, index-backed on
//                        {name,time}), merge deltas into the persisted per-program breakdowns,
//                        and only run a full one-off history scan for a program that newly
//                        enters the Top10 from outside the tracked set (rare).
// Unique-visitor counts use a small HyperLogLog sketch per program (mergeable, ~16KB fixed size
// regardless of visitor count) instead of a raw fp_id list, so the state doesn't grow unbounded
// as visitor sets only ever get bigger over time.

const baseMatch = {
    name: "page_view",
    bu: "D",
    content_name: { $ne: null, $nin: [null, ""] },
    canonical_url: { $regex: /^https:\/\/ticket\.ibon\.com\.tw\// }
};

function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) : '-';
}

// ============ HyperLogLog (self-contained, no dependency) ============
// p=14 -> 16384 registers, ~0.8% typical error, fixed ~16KB per sketch regardless of cardinality.
const HLL_P = 14;
const HLL_M = 1 << HLL_P;
const HLL_REST_WIDTH = 32 - HLL_P;
const HLL_REST_MASK = (1 << HLL_REST_WIDTH) - 1;

function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

function leadingZeros(x, width) {
    if (x === 0) return width;
    let n = 0;
    let mask = 1 << (width - 1);
    while (mask !== 0 && (x & mask) === 0) { n++; mask >>>= 1; }
    return n;
}

function hllCreate() { return new Uint8Array(HLL_M); }

function hllAdd(registers, value) {
    const hash = fnv1a(String(value));
    const idx = hash >>> HLL_REST_WIDTH;
    const rest = hash & HLL_REST_MASK;
    const rank = leadingZeros(rest, HLL_REST_WIDTH) + 1;
    if (registers[idx] < rank) registers[idx] = rank;
}

function hllEstimate(registers) {
    let sum = 0, zeros = 0;
    for (let i = 0; i < HLL_M; i++) {
        sum += Math.pow(2, -registers[i]);
        if (registers[i] === 0) zeros++;
    }
    const alpha = 0.7213 / (1 + 1.079 / HLL_M);
    let estimate = alpha * HLL_M * HLL_M / sum;
    if (estimate <= 2.5 * HLL_M && zeros > 0) {
        estimate = HLL_M * Math.log(HLL_M / zeros);
    }
    return Math.round(estimate);
}

function hllToBase64(registers) { return Buffer.from(registers).toString('base64'); }
function hllFromBase64(str) { return str ? new Uint8Array(Buffer.from(str, 'base64')) : hllCreate(); }

// ============ State load/save ============
function loadExistingState() {
    if (!fs.existsSync(MAIN_HTML_PATH)) return null;
    const html = fs.readFileSync(MAIN_HTML_PATH, 'utf8');
    const genMatch = html.match(/const generatedAt = "([^"]+)"/);
    const dataMatch = html.match(/\/\*SD_START\*\/([\s\S]*?)\/\*SD_END\*\//);
    if (!genMatch || !dataMatch) return null;
    try {
        const state = JSON.parse(dataMatch[1]);
        state.lastProcessedTime = genMatch[1];
        return state;
    } catch (e) {
        console.warn("Failed to parse existing state, will do a full rebuild.");
        return null;
    }
}

// ============ Breakdown queries (parameterized by extra $match conditions) ============
// Same 6 shapes as before: monthly / daily / device / hourly / unique-visitor pairs / attribution-id pairs.
// matchExtra is merged into baseMatch - either { content_name: {$in:[...]} } / { content_name: name }
// for a name-scoped historical query, or { time: {$gt: checkpoint} } for a time-scoped incremental query.
async function queryBreakdowns(coll, matchExtra) {
    const detailMatch = { ...baseMatch, ...matchExtra };
    // Merge (not overwrite) the time-existence guard with any incremental $gt bound already
    // present in matchExtra.time - a naive {...detailMatch, time:{...}} would silently drop
    // the $gt bound and re-scan full history every "incremental" run.
    const timeMatch = { ...detailMatch, time: { $exists: true, $ne: null, ...(detailMatch.time || {}) } };

    const monthlyAll = await coll.aggregate([
        { $match: timeMatch },
        { $group: { _id: { prog: "$content_name", month: { $dateToString: { format: "%Y-%m", date: "$time" } } }, views: { $sum: 1 } } }
    ], { allowDiskUse: true }).toArray();

    const dailyAll = await coll.aggregate([
        { $match: timeMatch },
        { $group: { _id: { prog: "$content_name", day: { $dateToString: { format: "%Y-%m-%d", date: "$time" } } }, views: { $sum: 1 } } }
    ], { allowDiskUse: true }).toArray();

    const deviceAll = await coll.aggregate([
        { $match: detailMatch },
        { $project: { content_name: 1, device: { $cond: [{ $regexMatch: { input: { $ifNull: ["$user_agent", ""] }, regex: /Mobile|Android|iPhone|iPad/ } }, "Mobile", "Desktop"] } } },
        { $group: { _id: { prog: "$content_name", device: "$device" }, count: { $sum: 1 } } }
    ], { allowDiskUse: true }).toArray();

    const hourlyAll = await coll.aggregate([
        { $match: timeMatch },
        { $group: { _id: { prog: "$content_name", hour: { $hour: "$time" } }, views: { $sum: 1 } } }
    ], { allowDiskUse: true }).toArray();

    const uvPairs = await coll.aggregate([
        { $match: { ...detailMatch, fp_id: { $ne: null, $ne: "" } } },
        { $group: { _id: { prog: "$content_name", fp: "$fp_id" } } }
    ], { allowDiskUse: true }).toArray();

    const attrPairs = await coll.aggregate([
        { $match: { ...detailMatch, attribution_id: { $ne: null, $ne: "" } } },
        { $group: { _id: { prog: "$content_name", aid: "$attribution_id" } } }
    ], { allowDiskUse: true }).toArray();

    return { monthlyAll, dailyAll, deviceAll, hourlyAll, uvPairs, attrPairs };
}

// ============ Merge raw query results into an in-memory per-program store ============
// store: { [prog]: { monthly:Map<month,views>, daily:Map<day,views>, device:Map<device,count>,
//                     hourly:Map<hour,views>, hll:Uint8Array, attrIds:Set } }
function ensureProg(store, prog) {
    if (!store[prog]) {
        store[prog] = { monthly: new Map(), daily: new Map(), device: new Map(), hourly: new Map(), hll: hllCreate(), attrIds: new Set() };
    }
    return store[prog];
}

function mergeBreakdownsInto(store, raw) {
    raw.monthlyAll.forEach(m => { const s = ensureProg(store, m._id.prog); s.monthly.set(m._id.month, (s.monthly.get(m._id.month) || 0) + m.views); });
    raw.dailyAll.forEach(d => { const s = ensureProg(store, d._id.prog); s.daily.set(d._id.day, (s.daily.get(d._id.day) || 0) + d.views); });
    raw.deviceAll.forEach(d => { const s = ensureProg(store, d._id.prog); const dev = d._id.device || 'Unknown'; s.device.set(dev, (s.device.get(dev) || 0) + d.count); });
    raw.hourlyAll.forEach(h => { const s = ensureProg(store, h._id.prog); s.hourly.set(h._id.hour, (s.hourly.get(h._id.hour) || 0) + h.views); });
    raw.uvPairs.forEach(u => { const s = ensureProg(store, u._id.prog); if (u._id.fp) hllAdd(s.hll, u._id.fp); });
    raw.attrPairs.forEach(a => { const s = ensureProg(store, a._id.prog); if (a._id.aid && String(a._id.aid).trim()) s.attrIds.add(a._id.aid); });
}

function serializeProgStore(s) {
    return {
        monthly: Array.from(s.monthly, ([month, views]) => ({ month, views })),
        daily: Array.from(s.daily, ([day, views]) => ({ day, views })),
        device: Array.from(s.device, ([device, count]) => ({ device, count })),
        hourly: Array.from(s.hourly, ([hour, views]) => ({ hour, views })),
        attributionIds: Array.from(s.attrIds),
        hllSketch: hllToBase64(s.hll)
    };
}

function deserializeProgStore(d) {
    return {
        monthly: new Map((d.monthly || []).map(m => [m.month, m.views])),
        daily: new Map((d.daily || []).map(x => [x.day, x.views])),
        device: new Map((d.device || []).map(x => [x.device, x.count])),
        hourly: new Map((d.hourly || []).map(x => [x.hour, x.views])),
        attrIds: new Set(d.attributionIds || []),
        hll: hllFromBase64(d.hllSketch)
    };
}

async function main() {
    const client = new MongoClient(uri);
    try {
        console.log("Connecting to DMP database...");
        await client.connect();
        console.log("Connected!");
        const db = client.db("trek-first-party-dmp");
        const coll = db.collection("event");

        const existingState = loadExistingState();
        let allProgramViews, dataDateStart, dataDateEnd, top10Store;

        if (!existingState) {
            console.log("No existing state found - running FULL historical bootstrap (one-time, ~40min)...");

            console.log("Step 1: Getting all-program totals...");
            console.time("allTotals");
            const allRaw = await coll.aggregate([
                { $match: baseMatch },
                { $group: { _id: "$content_name", views: { $sum: 1 } } },
                { $sort: { views: -1 } }
            ], { allowDiskUse: true }).toArray();
            console.timeEnd("allTotals");

            allProgramViews = {};
            allRaw.forEach(r => { allProgramViews[r._id] = r.views; });

            console.log("Getting data date range...");
            console.time("dateRange");
            const dateRangeResult = await coll.aggregate([
                { $match: { ...baseMatch, time: { $exists: true, $ne: null } } },
                { $group: { _id: null, minTime: { $min: "$time" }, maxTime: { $max: "$time" } } }
            ], { allowDiskUse: true }).toArray();
            console.timeEnd("dateRange");
            dataDateStart = fmtDate(dateRangeResult[0]?.minTime);
            dataDateEnd = fmtDate(dateRangeResult[0]?.maxTime);

            const top10Names = allRaw.slice(0, 10).map(r => r._id);

            console.log("Step 2: Fetching full breakdowns for Top10 (monthly/daily/device/hourly/uv/attribution)...");
            console.time("breakdowns");
            const raw = await queryBreakdowns(coll, { content_name: { $in: top10Names } });
            console.timeEnd("breakdowns");

            top10Store = {};
            mergeBreakdownsInto(top10Store, raw);

        } else {
            console.log(`Existing state found. Last processed: ${existingState.lastProcessedTime}`);
            allProgramViews = existingState.allProgramViews || {};
            dataDateStart = existingState.dataDateStart;
            dataDateEnd = existingState.dataDateEnd || dataDateStart;

            top10Store = {};
            Object.entries(existingState.top10Detail || {}).forEach(([prog, d]) => {
                top10Store[prog] = deserializeProgStore(d);
            });
            const trackedNames = new Set(Object.keys(top10Store));

            console.log(`Fetching new data since ${existingState.lastProcessedTime}...`);
            console.time("incremental");
            const raw = await queryBreakdowns(coll, { time: { $gt: new Date(existingState.lastProcessedTime) } });
            console.timeEnd("incremental");

            // Add incremental view deltas into the all-program totals (covers programs never tracked before too)
            const deltaViewsByProg = {};
            raw.monthlyAll.forEach(m => { deltaViewsByProg[m._id.prog] = (deltaViewsByProg[m._id.prog] || 0) + m.views; });
            Object.entries(deltaViewsByProg).forEach(([prog, views]) => {
                allProgramViews[prog] = (allProgramViews[prog] || 0) + views;
            });

            if (raw.dailyAll.length > 0) {
                const maxDay = raw.dailyAll.map(d => d._id.day).sort().pop();
                if (!dataDateEnd || maxDay > dataDateEnd) dataDateEnd = maxDay;
            }

            const newTop10Names = Object.entries(allProgramViews).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name]) => name);
            const keepSet = new Set(newTop10Names);
            const newlyPromoted = newTop10Names.filter(n => !trackedNames.has(n));

            // Only merge the incremental delta into programs we're keeping AND already had detail for
            const filteredRaw = {
                monthlyAll: raw.monthlyAll.filter(x => keepSet.has(x._id.prog) && trackedNames.has(x._id.prog)),
                dailyAll: raw.dailyAll.filter(x => keepSet.has(x._id.prog) && trackedNames.has(x._id.prog)),
                deviceAll: raw.deviceAll.filter(x => keepSet.has(x._id.prog) && trackedNames.has(x._id.prog)),
                hourlyAll: raw.hourlyAll.filter(x => keepSet.has(x._id.prog) && trackedNames.has(x._id.prog)),
                uvPairs: raw.uvPairs.filter(x => keepSet.has(x._id.prog) && trackedNames.has(x._id.prog)),
                attrPairs: raw.attrPairs.filter(x => keepSet.has(x._id.prog) && trackedNames.has(x._id.prog))
            };
            mergeBreakdownsInto(top10Store, filteredRaw);

            for (const prog of newlyPromoted) {
                console.log(`New entrant into Top10: "${prog}" - running one-off full-history backfill...`);
                console.time(`backfill:${prog}`);
                const soloRaw = await queryBreakdowns(coll, { content_name: prog });
                console.timeEnd(`backfill:${prog}`);
                mergeBreakdownsInto(top10Store, soloRaw);
            }

            Object.keys(top10Store).forEach(prog => { if (!keepSet.has(prog)) delete top10Store[prog]; });
        }

        // ============ Build final Top10 + detail data ============
        const overallTotal = Object.values(allProgramViews).reduce((a, b) => a + b, 0);
        const top10 = Object.entries(allProgramViews)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, views], i) => ({ name, totalViews: views, rank: i + 1 }));

        console.log("Step 3: Building detail pages...");
        if (!fs.existsSync(DETAILS_DIR)) fs.mkdirSync(DETAILS_DIR);

        for (let idx = 0; idx < top10.length; idx++) {
            const prog = top10[idx];
            console.log(`  [${idx + 1}/10] Building: ${prog.name}`);

            const s = top10Store[prog.name];
            const monthlyData = Array.from(s.monthly, ([month, views]) => ({ month, views })).sort((a, b) => a.month.localeCompare(b.month));
            const dailyData = Array.from(s.daily, ([day, views]) => ({ day, views })).sort((a, b) => a.day.localeCompare(b.day));
            const deviceData = Array.from(s.device, ([device, count]) => ({ device, count }));
            const hourlyData = Array.from(s.hourly, ([hour, views]) => ({ hour, views }));
            const uvCount = hllEstimate(s.hll);
            const idStr = s.attrIds.size > 0 ? Array.from(s.attrIds).join(', ') : '-';
            prog.idStr = idStr;

            const monthLabels = monthlyData.map(d => d.month);
            const monthValues = monthlyData.map(d => d.views);
            const dailyLabels = dailyData.map(d => d.day);
            const dailyValues = dailyData.map(d => d.views);
            const deviceLabels = deviceData.map(d => d.device || 'Unknown');
            const deviceValues = deviceData.map(d => d.count);
            const deviceTotal = deviceValues.reduce((a, b) => a + b, 0);

            const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
            const hourValues = Array.from({ length: 24 }, (_, i) => {
                const found = hourlyData.find(h => h.hour === i);
                return found ? found.views : 0;
            });

            const totalMonthly = monthValues.reduce((a, b) => a + b, 0);
            const monthTableRows = [...monthlyData].reverse().map(m => {
                const pct = totalMonthly > 0 ? ((m.views / totalMonthly) * 100).toFixed(2) : '0.00';
                return `<tr><td style="color:#94a3b8;">${m.month}</td><td style="text-align:right;color:#f8fafc;font-weight:500;">${m.views.toLocaleString()}</td><td style="text-align:right;color:#a78bfa;">${pct}%</td></tr>`;
            }).join('');

            const deviceTableRows = deviceData.map(d => {
                const pct = deviceTotal > 0 ? ((d.count / deviceTotal) * 100).toFixed(1) : '0.0';
                return `<tr><td style="color:#94a3b8;">${d.device || 'Unknown'}</td><td style="text-align:right;color:#f8fafc;font-weight:500;">${d.count.toLocaleString()}</td><td style="text-align:right;color:#34d399;">${pct}%</td></tr>`;
            }).join('');

            const avgDaily = dailyValues.length > 0 ? Math.round(dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length) : 0;
            const peakIdx = dailyValues.length > 0 ? dailyValues.indexOf(Math.max(...dailyValues)) : -1;
            const peakDay = peakIdx >= 0 ? dailyLabels[peakIdx] : '-';
            const peakViews = peakIdx >= 0 ? dailyValues[peakIdx] : 0;

            const detailFileName = `A_DMP_PageView_AllTime_Detail_${idx.toString().padStart(3, '0')}.html`;
            prog.detailLink = `dmp_details_alltime/${detailFileName}`;

            const detailHtml = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${prog.name} - DMP 流量深度分析</title>
    <!-- IP Allowlist: internal network only -->
    <style>html { visibility: hidden; }</style>
    <script>
        (function () {
            var ALLOWED = [
                '211.75.181.109', '211.75.181.110',
                '220.130.6.196',  '220.130.6.197',  '220.130.6.198',
                '220.130.134.238','220.130.134.239', '220.130.134.240',
                '133.149.194.24'
            ];
            function deny(ip) {
                document.documentElement.style.visibility = 'visible';
                document.body.style.cssText = 'margin:0;padding:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;';
                document.body.innerHTML =
                    '<div style="text-align:center;font-family:Outfit,sans-serif;padding:40px">' +
                    '<div style="font-size:5rem;margin-bottom:20px">🔒</div>' +
                    '<h1 style="color:#ef4444;font-size:2rem;margin:0 0 14px">存取被拒絕</h1>' +
                    '<p style="color:#94a3b8;margin:0 0 8px">您目前的 IP 位址：' +
                    '<code style="background:#1e293b;padding:2px 10px;border-radius:4px;color:#f472b6">' + ip + '</code></p>' +
                    '<p style="color:#64748b;font-size:0.88rem">此頁面僅限內部網路存取 &middot; Access restricted to internal network only</p>' +
                    '</div>';
            }
            var timer = setTimeout(function () { deny('timeout'); }, 6000);
            fetch('https://api.ipify.org?format=json')
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    clearTimeout(timer);
                    if (ALLOWED.indexOf(d.ip) !== -1) {
                        document.documentElement.style.visibility = 'visible';
                    } else {
                        deny(d.ip);
                    }
                })
                .catch(function () { clearTimeout(timer); deny('unknown'); });
        })();
    <\/script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg-color: #0f172a; --card-bg: rgba(30, 41, 59, 0.7); --card-border: rgba(255, 255, 255, 0.1); }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background: var(--bg-color); background-image: radial-gradient(at 0% 0%, rgba(59,130,246,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(139,92,246,0.15) 0px, transparent 50%); background-attachment: fixed; color: #f8fafc; padding: 40px 20px; }
        .container { max-width: 1100px; margin: 0 auto; }
        .header { margin-bottom: 30px; border-bottom: 1px solid var(--card-border); padding-bottom: 20px; }
        .header h1 { font-size: 1.8rem; color: #60a5fa; margin-bottom: 10px; font-weight: 700; }
        .header p { color: #94a3b8; font-size: 1rem; }
        .card { background: var(--card-bg); border-radius: 12px; padding: 25px; margin-bottom: 25px; border: 1px solid var(--card-border); backdrop-filter: blur(10px); }
        .chart-container { height: 300px; width: 100%; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .stat-box { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 20px; text-align: center; backdrop-filter: blur(10px); }
        .stat-box .label { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .stat-box .value { font-size: 1.8rem; font-weight: 700; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 10px 12px; color: #94a3b8; border-bottom: 2px solid rgba(255,255,255,0.1); font-size: 0.85rem; }
        td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem; }
        tr:hover { background-color: rgba(255,255,255,0.03); }
        .btn-back { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; margin-bottom: 20px; font-weight: 500; transition: all 0.3s; }
        .btn-back:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(37,99,235,0.4); }
        .table-wrapper { max-height: 400px; overflow-y: auto; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
        @media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <a href="../A_DMP_PageView_Report_AllTime_Top10.html" class="btn-back">← 返回 Top 10 排行榜</a>
        <div class="header">
            <h1>${prog.name}</h1>\n<!-- Data Source Header -->\n<div style="margin-top:8px; color: #888; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px;">\n    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> \n    Data Source: MongoDB (QwareAi / Qware_A_Ticket_data)\n</div>
            <p>First-Party DMP 深度流量分析 · 排名 #${prog.rank}</p>
        </div>

        <div class="stats-grid">
            <div class="stat-box">
                <div class="label">總瀏覽量</div>
                <div class="value" style="color: #60a5fa;">${prog.totalViews.toLocaleString()}</div>
            </div>
            <div class="stat-box">
                <div class="label">不重複訪客（估算）</div>
                <div class="value" style="color: #a78bfa;">${uvCount.toLocaleString()}</div>
            </div>
            <div class="stat-box">
                <div class="label">日均瀏覽量</div>
                <div class="value" style="color: #34d399;">${avgDaily.toLocaleString()}</div>
            </div>
            <div class="stat-box">
                <div class="label">尖峰日</div>
                <div class="value" style="color: #fbbf24; font-size: 1.2rem;">${peakDay}<br><span style="font-size:0.85rem;color:#94a3b8;">${peakViews.toLocaleString()} views</span></div>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-bottom: 15px; color: #60a5fa;">📈 每日瀏覽量趨勢</h3>
            <div class="chart-container">
                <canvas id="dailyChart"></canvas>
            </div>
        </div>

        <div class="two-col">
            <div class="card">
                <h3 style="margin-bottom: 15px; color: #a78bfa;">📊 每月數據明細</h3>
                <div class="table-wrapper">
                    <table>
                        <thead><tr><th>月份</th><th style="text-align:right;">瀏覽量</th><th style="text-align:right;">佔比</th></tr></thead>
                        <tbody>${monthTableRows}</tbody>
                    </table>
                </div>
            </div>
            <div class="card">
                <h3 style="margin-bottom: 15px; color: #34d399;">📱 裝置分佈</h3>
                <div style="height: 200px; margin-bottom: 15px;"><canvas id="deviceChart"></canvas></div>
                <table>
                    <thead><tr><th>裝置類型</th><th style="text-align:right;">次數</th><th style="text-align:right;">佔比</th></tr></thead>
                    <tbody>${deviceTableRows}</tbody>
                </table>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-bottom: 15px; color: #fb923c;">🕐 時段分佈 (UTC)</h3>
            <div class="chart-container">
                <canvas id="hourlyChart"></canvas>
            </div>
        </div>
    </div>

    <script>
        Chart.register(ChartDataLabels);

        // Daily Chart
        new Chart(document.getElementById('dailyChart').getContext('2d'), {
            type: 'line',
            data: { labels: ${JSON.stringify(dailyLabels)}, datasets: [{ label: 'Page Views', data: ${JSON.stringify(dailyValues)}, borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 2, tension: 0.2, fill: true, pointRadius: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } }, interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 12, maxRotation: 45, font: { size: 10 } } } } }
        });

        // Device Doughnut
        new Chart(document.getElementById('deviceChart').getContext('2d'), {
            type: 'doughnut',
            data: { labels: ${JSON.stringify(deviceLabels)}, datasets: [{ data: ${JSON.stringify(deviceValues)}, backgroundColor: ['#a78bfa', '#34d399', '#fb923c', '#60a5fa'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0', font: { size: 12 } } }, datalabels: { color: '#fff', formatter: (val, ctx) => { const t = ctx.dataset.data.reduce((a,b)=>a+b,0); return ((val/t)*100).toFixed(1)+'%'; }, font: { weight: 'bold', size: 13 } } } }
        });

        // Hourly Bar
        new Chart(document.getElementById('hourlyChart').getContext('2d'), {
            type: 'bar',
            data: { labels: ${JSON.stringify(hourLabels)}, datasets: [{ label: 'Views', data: ${JSON.stringify(hourValues)}, backgroundColor: 'rgba(251,146,60,0.6)', borderColor: '#fb923c', borderWidth: 1, borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } } } }
        });
    <\/script>
</body>
</html>`;

            fs.writeFileSync(path.join(DETAILS_DIR, detailFileName), detailHtml, 'utf8');
            console.log(`    -> Saved ${detailFileName}`);
        }

        // ============ Build main Top10 report ============
        console.log("Step 4: Building main Top 10 report...");

        const tableRows = top10.map((item) => {
            const rankClass = item.rank === 1 ? 'rank-1' : item.rank === 2 ? 'rank-2' : item.rank === 3 ? 'rank-3' : '';
            const pct = ((item.totalViews / overallTotal) * 100).toFixed(2);
            const idStr = item.idStr || '-';
            return `<tr><td style="text-align:center;"><span class="rank ${rankClass}">${item.rank}</span></td><td style="font-weight:500;"><a href="${item.detailLink}" target="_blank" style="color:#60a5fa;text-decoration:none;border-bottom:1px dashed #60a5fa;">${item.name}</a></td><td style="color:#bbf7d0;font-size:0.85rem;word-break:break-all;">${idStr}</td><td style="text-align:right;color:#f8fafc;font-weight:600;">${item.totalViews.toLocaleString()}</td><td style="text-align:right;color:var(--text-secondary);">${pct}%</td></tr>`;
        }).join('');

        // Persist state for next incremental run
        const generatedAtStr = new Date().toISOString();
        const finalState = {
            dataDateStart,
            dataDateEnd,
            allProgramViews,
            top10Detail: {}
        };
        top10.forEach(item => {
            finalState.top10Detail[item.name] = serializeProgStore(top10Store[item.name]);
        });

        const mainHtml = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DMP 歷史累積 Top 10 節目 Page View 排行榜</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg-color: #0f172a; --card-bg: rgba(30, 41, 59, 0.7); --card-border: rgba(255, 255, 255, 0.1); --text-primary: #f8fafc; --text-secondary: #94a3b8; --accent: #3b82f6; --glass-bg: rgba(15, 23, 42, 0.6); }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Outfit', 'Noto Sans TC', sans-serif; background-color: var(--bg-color); background-image: radial-gradient(at 0% 0%, rgba(59,130,246,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(139,92,246,0.15) 0px, transparent 50%); background-attachment: fixed; color: var(--text-primary); min-height: 100vh; padding: 40px 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid var(--card-border); }
        .header-left h1 { font-size: 2.5rem; font-weight: 800; background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
        .header-left p { color: var(--text-secondary); font-size: 1.1rem; }
        .stat-card { background: var(--card-bg); backdrop-filter: blur(12px); border: 1px solid var(--card-border); border-radius: 16px; padding: 24px; display: inline-block; }
        .stat-card h3 { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .stat-card .value { font-size: 2.5rem; font-weight: 700; color: var(--text-primary); text-shadow: 0 0 20px rgba(59,130,246,0.3); }
        .content-grid { display: grid; grid-template-columns: 1fr; gap: 30px; margin-bottom: 40px; }
        .card { background: var(--card-bg); backdrop-filter: blur(12px); border: 1px solid var(--card-border); border-radius: 16px; padding: 30px; }
        .card-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
        .chart-container { height: 400px; width: 100%; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 16px; color: var(--text-secondary); font-weight: 600; border-bottom: 2px solid rgba(255,255,255,0.1); position: sticky; top: 0; background: var(--glass-bg); backdrop-filter: blur(8px); }
        td { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        tbody tr:hover { background-color: rgba(255,255,255,0.03); }
        .rank { display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; background: rgba(255,255,255,0.1); font-weight: bold; font-size: 0.85rem; }
        .rank-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #000; box-shadow: 0 0 10px rgba(245,158,11,0.5); }
        .rank-2 { background: linear-gradient(135deg, #94a3b8, #64748b); color: #fff; }
        .rank-3 { background: linear-gradient(135deg, #b45309, #78350f); color: #fff; }
        .btn-home { position: fixed; bottom: 30px; right: 30px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(37,99,235,0.4); z-index: 50; }
        .btn-home:hover { transform: translateY(-3px); }
        .table-wrapper { max-height: 600px; overflow-y: auto; border-radius: 8px; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        @media (max-width: 768px) { .header { flex-direction: column; align-items: flex-start; gap: 20px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-left">
                <h1>歷史累積 Top 10 節目流量排行榜</h1>
                <p>First-Party DMP 歷史所有資料總計 Page View 排行榜</p>
                <p style="font-size:0.85rem;color:#64748b;margin-top:4px;">資料起訖：${dataDateStart} ~ ${dataDateEnd}</p>
            </div>
            <div style="display: flex; gap: 15px; align-items: stretch;">
                <div class="stat-card">
                    <h3>歷史總瀏覽量 (All-Time Valid Match)</h3>
                    <div class="value">${overallTotal.toLocaleString()}</div>
                </div>
            </div>
        </div>
        <div class="content-grid">
            <div class="card">
                <div class="card-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                    Top 10 熱門節目 (歷史累積)
                </div>
                <div class="chart-container"><canvas id="top10Chart"></canvas></div>
            </div>
            <div class="card" style="padding: 0;">
                <div style="padding: 30px 30px 15px;">
                    <div class="card-title" style="margin-bottom: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                        節目場次瀏覽量詳情 <span style="font-size:0.85rem;color:#94a3b8;margin-left:8px;">點擊節目名稱查看深度分析</span>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead><tr>
                            <th style="width:80px;text-align:center;">排名</th>
                            <th>節目名稱 (Content Name)</th>
                            <th style="width:15%;color:#bbf7d0;">節目ID</th>
                            <th style="text-align:right;">瀏覽量 (Page Views)</th>
                            <th style="text-align:right;width:120px;">歷史總佔比</th>
                        </tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    <a href="report_index.html" class="btn-home">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
        回首頁
    </a>
    <script>
        const top10Labels = ${JSON.stringify(top10.map(t => t.name))};
        const top10Data = ${JSON.stringify(top10.map(t => t.totalViews))};
        Chart.register(ChartDataLabels);
        const formattedLabels = top10Labels.map(l => l.length > 20 ? l.substring(0, 20) + '...' : l);
        new Chart(document.getElementById('top10Chart').getContext('2d'), {
            type: 'bar',
            data: { labels: formattedLabels, datasets: [{ label: 'Page Views', data: top10Data, backgroundColor: 'rgba(59,130,246,0.7)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 6, hoverBackgroundColor: 'rgba(96,165,250,0.9)' }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', titleFont: { size: 14 }, bodyFont: { size: 14 }, padding: 12, callbacks: { title: ctx => top10Labels[ctx[0].dataIndex], label: ctx => 'Views: ' + ctx.parsed.y.toLocaleString() } }, datalabels: { color: '#f8fafc', anchor: 'end', align: 'top', formatter: v => v.toLocaleString(), font: { weight: 'bold', size: 11 } } },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, border: { display: false } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Noto Sans TC' }, maxRotation: 45, minRotation: 45 }, border: { color: 'rgba(255,255,255,0.1)' } } },
                layout: { padding: { top: 30 } }
            }
        });
    <\/script>
    <script>
        const generatedAt = "${generatedAtStr}";
        const dmpState = /*SD_START*/${JSON.stringify(finalState)}/*SD_END*/;
    <\/script>
</body>
</html>`;

        fs.writeFileSync(MAIN_HTML_PATH, mainHtml, 'utf8');
        console.log('Main report regenerated!');
        console.log('All done!');

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

main().catch(console.dir);
