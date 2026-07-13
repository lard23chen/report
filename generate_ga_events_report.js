require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

function formatDateStr(val) {
    if (!val) return '';
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return String(val).slice(0, 16);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const h = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}`;
}

async function main() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");

        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // ── 0. Load existing HTML for incremental update ──────────────────────
        const htmlPath = path.join(__dirname, 'A_GA_Events_Traffic_Report.html');
        let existingEntries = [];
        let lastGeneratedAt = null;

        if (fs.existsSync(htmlPath)) {
            console.log("Loading existing HTML data for incremental update...");
            const existingHtml = fs.readFileSync(htmlPath, 'utf8');
            const genMatch = existingHtml.match(/const generatedAt = "([^"]+)"/);
            const dataMatch = existingHtml.match(/\/\*SD_START\*\/([\s\S]*?)\/\*SD_END\*\//);
            if (genMatch) {
                lastGeneratedAt = new Date(genMatch[1]);
                console.log(`Last generated at: ${lastGeneratedAt.toISOString()}`);
            }
            if (dataMatch) {
                try { existingEntries = JSON.parse(dataMatch[1]); } catch(e) {
                    console.warn("Failed to parse existing serverData, will rebuild from scratch.");
                }
            }
        }

        // Build existingMap: keep past-month entries unchanged, discard current-month (will rebuild)
        const existingMap = new Map(); // `${activityId}_${date}` -> entry
        let keptCount = 0;
        let discardedCurrentMonth = 0;

        for (const entry of existingEntries) {
            const date = entry.start ? entry.start.slice(0, 10) : '';
            if (!date) continue;
            if (date.startsWith(currentMonthPrefix)) {
                discardedCurrentMonth++;
            } else {
                existingMap.set(`${entry.activityId}_${date}`, entry);
                keptCount++;
            }
        }

        console.log(`Kept ${keptCount} past-month entries, discarding ${discardedCurrentMonth} current-month entries for refresh.`);

        // ── 1. Get event list (always re-query, fast aggregation) ─────────────
        const topEvents = await db.collection("QwareTrafficSession").aggregate([
            { $sort: { CreateTime: 1 } },
            {
                $group: {
                    _id: "$ActivityID",
                    Name: { $last: "$ActivityInfoName" },
                    AllNames: { $addToSet: "$ActivityInfoName" },
                    MaxSessions: { $max: "$SessionCount" }
                }
            },
            { $match: { MaxSessions: { $gt: 2000 } } },
            { $sort: { MaxSessions: -1 } }
        ]).toArray();

        const topEventIds = topEvents.map(e => e._id);

        // ── 2. Fetch only NEW session/readtime data (incremental) ─────────────
        let sessionsToProcess = [];
        let readsToProcess = [];

        if (lastGeneratedAt) {
            // New records since last generation
            console.log(`Fetching new sessions since ${lastGeneratedAt.toISOString()}...`);
            const newSessions = await db.collection("QwareTrafficSession")
                .find({ ActivityID: { $in: topEventIds }, CreateTime: { $gt: lastGeneratedAt } })
                .sort({ CreateTime: 1 }).toArray();

            // Current month: always re-fetch completely (data keeps flowing in during the month)
            console.log("Fetching all current-month sessions for refresh...");
            const curMonthSessions = await db.collection("QwareTrafficSession")
                .find({ ActivityID: { $in: topEventIds }, CreateTime: { $gte: currentMonthStart } })
                .sort({ CreateTime: 1 }).toArray();

            // Merge + deduplicate by _id
            const seen = new Set();
            for (const s of [...newSessions, ...curMonthSessions]) {
                const id = s._id.toString();
                if (!seen.has(id)) { seen.add(id); sessionsToProcess.push(s); }
            }

            const newReads = await db.collection("QwareTrafficGAReadTime")
                .find({ ActivityID: { $in: topEventIds }, CreateTime: { $gt: lastGeneratedAt } })
                .sort({ CreateTime: 1 }).toArray();

            const curMonthReads = await db.collection("QwareTrafficGAReadTime")
                .find({ ActivityID: { $in: topEventIds }, CreateTime: { $gte: currentMonthStart } })
                .sort({ CreateTime: 1 }).toArray();

            const seenR = new Set();
            for (const r of [...newReads, ...curMonthReads]) {
                const id = r._id.toString();
                if (!seenR.has(id)) { seenR.add(id); readsToProcess.push(r); }
            }
        } else {
            // Initial run: fetch everything
            console.log("Initial run — fetching all sessions and read-time records...");
            sessionsToProcess = await db.collection("QwareTrafficSession")
                .find({ ActivityID: { $in: topEventIds } }).sort({ CreateTime: 1 }).toArray();
            readsToProcess = await db.collection("QwareTrafficGAReadTime")
                .find({ ActivityID: { $in: topEventIds } }).sort({ CreateTime: 1 }).toArray();
        }

        console.log(`Processing ${sessionsToProcess.length} sessions, ${readsToProcess.length} read-time records...`);

        // ── 3. Group new data by event → date → minute ────────────────────────
        const eventDateMap = new Map(); // eId -> (date -> (timeKey -> dataPoint))

        sessionsToProcess.forEach(s => {
            const timeKey = formatDateStr(s.CreateTime);
            if (!timeKey) return;
            const date = timeKey.slice(0, 10);
            const eId = s.ActivityID;
            if (!eventDateMap.has(eId)) eventDateMap.set(eId, new Map());
            const dateMap = eventDateMap.get(eId);
            if (!dateMap.has(date)) dateMap.set(date, new Map());
            const tMap = dateMap.get(date);
            if (!tMap.has(timeKey)) {
                tMap.set(timeKey, { time: timeKey, session: s.SessionCount, activeD: null, activeA: null, activeDMin: null, activeAMin: null, orders: 0, tickets: 0 });
            } else {
                tMap.get(timeKey).session = Math.max(tMap.get(timeKey).session, s.SessionCount);
            }
        });

        readsToProcess.forEach(r => {
            const timeKey = formatDateStr(r.CreateTime);
            if (!timeKey) return;
            const date = timeKey.slice(0, 10);
            const eId = r.ActivityID;
            if (!eventDateMap.has(eId)) eventDateMap.set(eId, new Map());
            const dateMap = eventDateMap.get(eId);
            if (!dateMap.has(date)) dateMap.set(date, new Map());
            const tMap = dateMap.get(date);
            const dCount   = r.ActiveUsersDCount    === 'NULL' ? 0 : Number(r.ActiveUsersDCount);
            const aCount   = r.ActiveUsersACount    === 'NULL' ? 0 : Number(r.ActiveUsersACount);
            const dMinCount = r.ActiveUsersDMinCount === 'NULL' ? 0 : Number(r.ActiveUsersDMinCount);
            const aMinCount = r.ActiveUsersAMinCount === 'NULL' ? 0 : Number(r.ActiveUsersAMinCount);
            if (!tMap.has(timeKey)) {
                tMap.set(timeKey, { time: timeKey, session: null, activeD: dCount, activeA: aCount, activeDMin: dMinCount, activeAMin: aMinCount, orders: 0, tickets: 0 });
            } else {
                const d = tMap.get(timeKey);
                d.activeD    = Math.max(d.activeD    || 0, dCount);
                d.activeA    = Math.max(d.activeA    || 0, aCount);
                d.activeDMin = Math.max(d.activeDMin || 0, dMinCount);
                d.activeAMin = Math.max(d.activeAMin || 0, aMinCount);
            }
        });

        // ── 4. Fetch tickets and build entries for new/current-month combos ───
        for (const [eId, dateMap] of eventDateMap.entries()) {
            const event = topEvents.find(e => e._id === eId);
            if (!event) continue;
            const eName = event.Name;

            for (const [dateStr, tMap] of dateMap.entries()) {
                const key = `${eId}_${dateStr}`;
                const isCurrentMonth = dateStr.startsWith(currentMonthPrefix);

                // Skip past-month entries already in existingMap
                if (!isCurrentMonth && existingMap.has(key)) {
                    continue;
                }

                const ticketCollName = isCurrentMonth ? "Qware_A_Ticket_data_Daily" : "Qware_Ticket_Data";
                console.log(`fetching tickets for ${eName} on ${dateStr} from ${ticketCollName}...`);

                const ticketsData = await db.collection(ticketCollName).find({
                    "節目/商品名稱": { $in: event.AllNames },
                    "交易時間": { $regex: new RegExp(`^${dateStr}`) },
                    "狀態": "正常"
                }).toArray();

                const ticketTrend = {};
                ticketsData.forEach(tick => {
                    const tTime = tick["交易時間"] ? tick["交易時間"].slice(0, 16) : null;
                    if (!tTime) return;
                    if (!ticketTrend[tTime]) ticketTrend[tTime] = { orders: new Set(), tickets: 0 };
                    const orderId = tick["訂單編號"] ? tick["訂單編號"].split('_')[0] : tick._id;
                    ticketTrend[tTime].orders.add(orderId);
                    ticketTrend[tTime].tickets += 1;
                });

                const dailyData = Array.from(tMap.values()).sort((a, b) => a.time.localeCompare(b.time));

                let maxSession = 0, maxActiveD = 0, maxActiveA = 0;
                let maxActiveDMin = 0, maxActiveAMin = 0;
                let maxSessionTime = '', maxActiveDTime = '', maxActiveATime = '';
                let maxActiveDMinTime = '', maxActiveAMinTime = '';

                dailyData.forEach(item => {
                    if (ticketTrend[item.time]) {
                        item.orders = ticketTrend[item.time].orders.size;
                        item.tickets = ticketTrend[item.time].tickets;
                    }
                    if (item.session > maxSession) { maxSession = item.session; maxSessionTime = item.time; }
                    if (item.activeD > maxActiveD) { maxActiveD = item.activeD; maxActiveDTime = item.time; }
                    if (item.activeA > maxActiveA) { maxActiveA = item.activeA; maxActiveATime = item.time; }
                    if (item.activeDMin > maxActiveDMin) { maxActiveDMin = item.activeDMin; maxActiveDMinTime = item.time; }
                    if (item.activeAMin > maxActiveAMin) { maxActiveAMin = item.activeAMin; maxActiveAMinTime = item.time; }
                });

                if (maxSession > 0) {
                    existingMap.set(key, {
                        activityId: eId,
                        name: eName,
                        maxSession, maxActiveD, maxActiveA, maxActiveDMin, maxActiveAMin,
                        maxSessionTime, maxActiveDTime, maxActiveATime, maxActiveDMinTime, maxActiveAMinTime,
                        start: dailyData.length > 0 ? dailyData[0].time : '',
                        end:   dailyData.length > 0 ? dailyData[dailyData.length - 1].time : '',
                        data: dailyData
                    });
                }
            }
        }

        // ── 5. Build final clientData ──────────────────────────────────────────
        const generatedAtStr = now.toISOString();
        let clientData = Array.from(existingMap.values());
        clientData.sort((a, b) => b.start.localeCompare(a.start));

        console.log(`Total entries in report: ${clientData.length}`);
        console.log("Building HTML file...");

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GA 事件流量深度分析</title>
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
    </script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-color: #3b82f6;
            --purple: #8b5cf6;
            --green: #10b981;
            --shadow: 0 4px 6px -1px rgba(0,0,0,0.5);
        }

        body {
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            padding: 20px 40px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .title h1 {
            margin: 0;
            font-size: 2rem;
            background: linear-gradient(to right, #60a5fa, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .layout {
            display: flex;
            gap: 30px;
            max-width: 1800px;
            margin: 0 auto;
        }
        .sidebar {
            width: 350px;
            flex-shrink: 0;
            background: var(--card-bg);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.05);
            display: flex;
            flex-direction: column;
            height: calc(100vh - 40px);
            position: sticky;
            top: 20px;
        }
        .sidebar-header {
            padding: 20px;
            font-size: 1.2rem;
            font-weight: 700;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            color: var(--accent-color);
        }
        .event-list {
            flex-grow: 1;
            overflow-y: auto;
            padding: 10px;
        }
        .event-item {
            padding: 15px;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
            margin-bottom: 8px;
        }
        .event-item:hover {
            background: rgba(255,255,255,0.03);
            border-color: rgba(255,255,255,0.1);
        }
        .event-item.active {
            background: rgba(59, 130, 246, 0.15);
            border-color: #3b82f6;
        }
        .event-item .date {
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-bottom: 5px;
        }
        .event-item .name {
            font-size: 0.95rem;
            font-weight: 600;
            line-height: 1.4;
        }
        .main-wrapper {
            flex-grow: 1;
            min-width: 0;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }

        .card {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 20px;
            box-shadow: var(--shadow);
            border: 1px solid rgba(255,255,255,0.05);
            transition: transform 0.2s;
            position: relative;
            overflow: hidden;
        }

        .card::before {
            content: '';
            position: absolute;
            left: 0; top: 0; bottom: 0; width: 4px;
        }
        .card-1::before { background: #3b82f6; }
        .card-2::before { background: #f59e0b; }
        .card-3::before { background: #10b981; }
        .card-4::before { background: #fbbf24; }
        .card-5::before { background: #34d399; }
        .card-6::before { background: #ec4899; }

        .card h3 {
            margin: 0 0 10px 0;
            font-size: 0.9rem;
            color: var(--text-secondary);
            font-weight: 500;
        }

        .card .value {
            font-size: 1.8rem;
            font-weight: 700;
            margin-bottom: 5px;
        }

        .card .sub {
            font-size: 0.8rem;
            color: #64748b;
        }

        .chart-container {
            background: var(--card-bg);
            border-radius: 16px;
            padding: 25px;
            border: 1px solid rgba(255,255,255,0.05);
            height: 500px;
            position: relative;
        }

        .sys-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; color: #fff; background: rgba(255,255,255,0.1); }

        .table-container {
            margin-top: 30px;
            background: var(--card-bg);
            border-radius: 16px;
            padding: 25px;
            border: 1px solid rgba(255,255,255,0.05);
            max-height: 400px;
            overflow-y: auto;
        }

        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { position: sticky; top: -25px; background: var(--card-bg); padding: 12px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid rgba(255,255,255,0.1); }
        td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); }
        tr:hover { background: rgba(255,255,255,0.02); }

        #goHomeBtn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #424242, #212121);
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.1);
            padding: 12px 24px;
            border-radius: 50px;
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
            z-index: 1000;
        }
        #goHomeBtn:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.6);
            border-color: rgba(255,255,255,0.2);
            background: linear-gradient(135deg, #4a4a4a, #2a2a2a);
        }
    </style>
</head>
<body>

<a href="report_index.html" id="goHomeBtn">
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
    </svg>
    回首頁
</a>

<div class="layout">
    <div class="sidebar">
        <div class="sidebar-header">選擇節目</div>
        <div style="padding: 6px 12px 4px; font-size: 0.75rem; color: #6b7280;">最近更新：${now.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei', hour12: false})}</div>
        <div class="event-list" id="eventList">
            ${clientData.map((d, i) => d.maxSession > 2000 ? `
                <div class="event-item" id="event-item-${i}" onclick="updateDashboard(${i})">
                    <div class="date">[${d.start ? d.start.slice(0, 10) : '未知日期'}]</div>
                    <div class="name">${d.name}</div>
                </div>
            ` : '').join('')}
        </div>
    </div>

    <div class="main-wrapper">
        <div class="header">
            <div class="title">
                <h1 id="eventHeading"></h1>\n<!-- Data Source Header -->\n<div style="margin-top:8px; color: #888; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px;">\n    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> \n    Data Source: MongoDB (QwareAi / GA_EventsStats)\n</div>
                <div style="color: var(--text-secondary); margin-top: 5px; font-size: 0.9rem;">
                    基於 QwareTrafficSession 與 QwareTrafficGAReadTime 數據
                </div>
            </div>
        </div>

<div class="summary-grid">
    <div class="card card-1">
        <h3>最高 A session數</h3>
        <div class="value" id="valSession" style="color: #3b82f6;">-</div>
        <div class="sub" id="subSessionTime">Peak Time: -</div>
    </div>
    <div class="card card-4">
        <h3>最高 D每分鐘流量</h3>
        <div class="value" id="valActiveDMin" style="color: #fbbf24;">-</div>
        <div class="sub" id="subActiveDMinTime">Peak Time: -</div>
    </div>
    <div class="card card-5">
        <h3>最高 A每分鐘流量</h3>
        <div class="value" id="valActiveAMin" style="color: #34d399;">-</div>
        <div class="sub" id="subActiveAMinTime">Peak Time: -</div>
    </div>
    <div class="card card-2">
        <h3>最高 每分鐘訂單</h3>
        <div class="value" id="valMaxOrders" style="color: #f59e0b;">-</div>
        <div class="sub" id="subMaxOrdersTime">Peak Time: -</div>
    </div>
    <div class="card card-3">
        <h3>最高 每分鐘張數</h3>
        <div class="value" id="valMaxTickets" style="color: #10b981;">-</div>
        <div class="sub" id="subMaxTicketsTime">Peak Time: -</div>
    </div>
    <div class="card card-6">
        <h3>資料記錄區間</h3>
        <div class="value" id="valTime" style="font-size: 1.2rem; margin-top: 10px;">-</div>
        <div class="sub" id="valTimeSub">From start to end</div>
    </div>
</div>

<div class="table-container" style="margin-top: 0; margin-bottom: 30px;">
    <table id="dataTable">
        <thead>
            <tr>
                <th>GATime</th>
                <th>D每分鐘流量</th>
                <th>A每分鐘流量</th>
                <th>A session數</th>
                <th>每分鐘訂單</th>
                <th>每分鐘張數</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    </table>
</div>

<div class="chart-container">
    <div style="position: absolute; top: 20px; right: 25px; z-index: 10;">
        <span class="sys-badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid #3b82f6;">A session數</span>
        <span class="sys-badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b;">D流量</span>
        <span class="sys-badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981;">A流量</span>
    </div>
    <canvas id="mainChart"></canvas>
</div>
</div> <!-- End main-wrapper -->
</div> <!-- End layout -->

<script>
    const generatedAt = "${generatedAtStr}";
    const serverData = /*SD_START*/${JSON.stringify(clientData)}/*SD_END*/;
    let chartInstance = null;

    function updateDashboard(idx) {
        document.querySelectorAll('.event-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.getElementById('event-item-' + idx);
        if(activeItem) activeItem.classList.add('active');

        const d = serverData[idx];
        document.getElementById('eventHeading').innerText = d.name;

        let maxOrders = 0; let maxOrdersTime = '';
        let maxTickets = 0; let maxTicketsTime = '';
        d.data.forEach(item => {
            if (item.orders > maxOrders) { maxOrders = item.orders; maxOrdersTime = item.time; }
            if (item.tickets > maxTickets) { maxTickets = item.tickets; maxTicketsTime = item.time; }
        });

        document.getElementById('valSession').innerText = d.maxSession.toLocaleString();
        document.getElementById('valActiveDMin').innerText = d.maxActiveDMin.toLocaleString();
        document.getElementById('valActiveAMin').innerText = d.maxActiveAMin.toLocaleString();
        document.getElementById('valMaxOrders').innerText = maxOrders.toLocaleString();
        document.getElementById('valMaxTickets').innerText = maxTickets.toLocaleString();

        document.getElementById('subSessionTime').innerText = "發生時間點: " + (d.maxSessionTime || '-');
        document.getElementById('subActiveDMinTime').innerText = "發生時間點: " + (d.maxActiveDMinTime || '-');
        document.getElementById('subActiveAMinTime').innerText = "發生時間點: " + (d.maxActiveAMinTime || '-');
        document.getElementById('subMaxOrdersTime').innerText = "發生時間點: " + (maxOrdersTime || '-');
        document.getElementById('subMaxTicketsTime').innerText = "發生時間點: " + (maxTicketsTime || '-');

        (function() {
            var _sd = d.start.slice(0, 10), _ed = d.end.slice(0, 10);
            var _sParts = d.start.slice(11).split(':'), _eParts = d.end.slice(11).split(':');
            var _sh = parseInt(_sParts[0])*2 + (parseInt(_sParts[1]||0)>=30?1:0);
            var _eh = parseInt(_eParts[0])*2 + (parseInt(_eParts[1]||0)>=30?1:0);
            var _isThisMonth = _sd.slice(0,7) === new Date().toISOString().slice(0,7);
            var _geoBase = _isThisMonth ? 'A_IP_Geo_Analysis_Report.html' : 'A_IP_Geo_Analysis_Report_Historical.html';
            var _url = _geoBase + '?startDate=' + _sd + '&endDate=' + _ed + '&startHour=' + _sh + '&endHour=' + _eh;
            document.getElementById('valTime').innerHTML = '<a href="' + _url + '" target="_blank" title="查看 IP 地理分析" style="color:#60a5fa;text-decoration:underline dotted;">' + d.start.slice(5) + ' ~ ' + d.end.slice(5) + '</a>';
        })();
        document.getElementById('valTimeSub').innerText = "總數據點數: " + d.data.length;

        const tbody = document.querySelector('#dataTable tbody');
        const displayData = d.data;
        tbody.innerHTML = displayData.map(item => {
            const isMax = item.session === d.maxSession && d.maxSession > 0;
            const bg = isMax ? ' style="background: rgba(59, 130, 246, 0.2);"' : '';
            return '<tr' + bg + '>' +
                '<td>' + item.time + '</td>' +
                '<td style="color: #fcd34d;">' + (item.activeDMin || 0).toLocaleString() + '</td>' +
                '<td style="color: #6ee7b7;">' + (item.activeAMin || 0).toLocaleString() + '</td>' +
                '<td style="color: #60a5fa; font-weight: ' + (isMax ? 'bold' : 'normal') + ';">' + (item.session || 0).toLocaleString() + (isMax ? ' ⭐' : '') + '</td>' +
                '<td style="color: #ff9800;">' + (item.orders || 0).toLocaleString() + '</td>' +
                '<td style="color: #e91e63;">' + (item.tickets || 0).toLocaleString() + '</td>' +
                '</tr>';
        }).join('');
        document.getElementById('valTimeSub').innerText = "顯示 " + displayData.length + " / 總 " + d.data.length + " 筆";

        if (chartInstance) {
            chartInstance.destroy();
        }

        const ctx = document.getElementById('mainChart').getContext('2d');
        Chart.register(ChartDataLabels);

        chartInstance = new Chart(ctx, {
            type: 'line',
            plugins: [ChartDataLabels],
            data: {
                labels: d.data.map(item => item.time.slice(5)),
                datasets: [
                    {
                        label: 'A session數',
                        data: d.data.map(item => item.session),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        yAxisID: 'y',
                        tension: 0.3,
                        fill: true,
                        pointRadius: 2
                    },
                    {
                        label: 'D流量 (每分)',
                        data: d.data.map(item => item.activeDMin),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        yAxisID: 'y1',
                        tension: 0.3,
                        fill: true,
                        pointRadius: 2
                    },
                    {
                        label: 'A流量 (每分)',
                        data: d.data.map(item => item.activeAMin),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        yAxisID: 'y1',
                        tension: 0.3,
                        fill: true,
                        pointRadius: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: ctx => ctx.dataset.borderColor,
                        align: 'top',
                        font: { size: 10, family: 'Outfit' },
                        formatter: val => val > 0 ? (val >= 1000 ? (val/1000).toFixed(1) + 'k' : val) : ''
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', maxTicksLimit: 12 } },
                    y: { position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Sessions', color: '#60a5fa' } },
                    y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Traffic', color: '#fbbf24' } }
                }
            }
        });
    }

    window.onload = () => {
        serverData.forEach((d, i) => {
            if (d.maxSession <= 2000) {
                const el = document.getElementById('event-item-' + i);
                if (el) el.style.display = 'none';
            }
        });
        const firstVisible = serverData.findIndex(d => d.maxSession > 2000);
        updateDashboard(firstVisible >= 0 ? firstVisible : 0);
    };

</script>
</body>
</html>
        `;

        fs.writeFileSync(htmlPath, htmlContent, 'utf8');
        console.log('Report updated successfully at ' + htmlPath);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

main().catch(console.dir);
