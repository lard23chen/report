const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function main() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");

        // 1. 取得所有節目清單 (依照 MAX SessionCount 排序)
        const topEvents = await db.collection("QwareTrafficSession").aggregate([
            { $sort: { CreateTime: 1 } }, // Sort so $last gets the latest name
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

        console.log(`fetching session details for ${topEventIds.length} events...`);
        // 2. 獲取所有節目的 Session 資料
        let allSessions = await db.collection("QwareTrafficSession")
            .find({ ActivityID: { $in: topEventIds } })
            .sort({ CreateTime: 1 })
            .toArray();

        // 3. 獲取所有節目的 GAReadTime 資料
        console.log(`fetching read time details for ${topEventIds.length} events...`);
        let allReads = await db.collection("QwareTrafficGAReadTime")
            .find({ ActivityID: { $in: topEventIds } })
            .sort({ CreateTime: 1 })
            .toArray();

        console.log("Processing data structure for frontend...");

        let clientData = [];

        function formatDateStr(val) {
            if (!val) return '';
            const dt = new Date(val);
            if (isNaN(dt.getTime())) {
                return String(val).slice(0, 16);
            }
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            const h = String(dt.getHours()).padStart(2, '0');
            const min = String(dt.getMinutes()).padStart(2, '0');
            return y + '-' + m + '-' + d + ' ' + h + ':' + min;
        }

        for (let event of topEvents) {
            let eId = event._id;
            let eName = event.Name;

            // Filter sessions for this event
            let evSessions = allSessions.filter(s => s.ActivityID === eId);
            let evReads = allReads.filter(r => r.ActivityID === eId);

            // Group by minute (hh:mm string)
            let timeMap = new Map();

            evSessions.forEach(s => {
                let timeKey = formatDateStr(s.CreateTime);
                if (!timeKey) return;

                if (!timeMap.has(timeKey)) {
                    timeMap.set(timeKey, { time: timeKey, session: s.SessionCount, activeD: null, activeA: null, activeDMin: null, activeAMin: null, orders: 0, tickets: 0 });
                } else {
                    timeMap.get(timeKey).session = Math.max(timeMap.get(timeKey).session, s.SessionCount);
                }
            });

            evReads.forEach(r => {
                let timeKey = formatDateStr(r.CreateTime);
                if (!timeKey) return;

                if (!timeMap.has(timeKey)) {
                    timeMap.set(timeKey, { time: timeKey, session: null, activeD: (r.ActiveUsersDCount === 'NULL' ? 0 : Number(r.ActiveUsersDCount)), activeA: (r.ActiveUsersACount === 'NULL' ? 0 : Number(r.ActiveUsersACount)), activeDMin: (r.ActiveUsersDMinCount === 'NULL' ? 0 : Number(r.ActiveUsersDMinCount)), activeAMin: (r.ActiveUsersAMinCount === 'NULL' ? 0 : Number(r.ActiveUsersAMinCount)), orders: 0, tickets: 0 });
                } else {
                    let d = timeMap.get(timeKey);
                    let dCount = (r.ActiveUsersDCount === 'NULL' ? 0 : Number(r.ActiveUsersDCount));
                    let aCount = (r.ActiveUsersACount === 'NULL' ? 0 : Number(r.ActiveUsersACount));
                    let dMinCount = (r.ActiveUsersDMinCount === 'NULL' ? 0 : Number(r.ActiveUsersDMinCount));
                    let aMinCount = (r.ActiveUsersAMinCount === 'NULL' ? 0 : Number(r.ActiveUsersAMinCount));
                    d.activeD = Math.max(d.activeD || 0, dCount);
                    d.activeA = Math.max(d.activeA || 0, aCount);
                    d.activeDMin = Math.max(d.activeDMin || 0, dMinCount);
                    d.activeAMin = Math.max(d.activeAMin || 0, aMinCount);
                }
            });

            let timeDataArr = Array.from(timeMap.values()).sort((a, b) => a.time.localeCompare(b.time));

            // Group by Date (YYYY-MM-DD)
            let dateGroups = new Map();
            timeDataArr.forEach(item => {
                let dateStr = item.time.slice(0, 10);
                if (!dateGroups.has(dateStr)) {
                    dateGroups.set(dateStr, []);
                }
                dateGroups.get(dateStr).push(item);
            });

            for (let [dateStr, dailyData] of dateGroups.entries()) {
                // FETCH TICKET STATS for this event on this day
                const now = new Date();
                const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const isCurrentMonth = dateStr.startsWith(currentMonthPrefix);
                const ticketCollName = isCurrentMonth ? "Qware_A_Ticket_data_Daily" : "Qware_Ticket_Data";
                
                console.log(`fetching tickets for ${eName} on ${dateStr} from ${ticketCollName}...`);
                
                // Match by all associated event names and date
                const ticketsData = await db.collection(ticketCollName).find({
                    "節目/商品名稱": { $in: event.AllNames },
                    "交易時間": { $regex: new RegExp(`^${dateStr}`) },
                    "狀態": "正常"
                }).toArray();

                // Group tickets by minute
                const ticketTrend = {};
                ticketsData.forEach(tick => {
                    const tTime = tick["交易時間"] ? tick["交易時間"].slice(0, 16) : null;
                    if (!tTime) return;
                    if (!ticketTrend[tTime]) ticketTrend[tTime] = { orders: new Set(), tickets: 0 };
                    
                    const orderId = tick["訂單編號"] ? tick["訂單編號"].split('_')[0] : tick._id;
                    ticketTrend[tTime].orders.add(orderId);
                    ticketTrend[tTime].tickets += 1;
                });

                let maxSession = 0;
                let maxActiveD = 0;
                let maxActiveA = 0;
                let maxActiveDMin = 0;
                let maxActiveAMin = 0;
                let maxSessionTime = '';
                let maxActiveDTime = '';
                let maxActiveATime = '';
                let maxActiveDMinTime = '';
                let maxActiveAMinTime = '';

                dailyData.forEach(item => {
                    // Update per-minute ticket stats
                    if (ticketTrend[item.time]) {
                        item.orders = ticketTrend[item.time].orders.size;
                        item.tickets = ticketTrend[item.time].tickets;
                    }

                    if (item.session > maxSession) {
                        maxSession = item.session;
                        maxSessionTime = item.time;
                    }
                    if (item.activeD > maxActiveD) {
                        maxActiveD = item.activeD;
                        maxActiveDTime = item.time;
                    }
                    if (item.activeA > maxActiveA) {
                        maxActiveA = item.activeA;
                        maxActiveATime = item.time;
                    }
                    if (item.activeDMin > maxActiveDMin) {
                        maxActiveDMin = item.activeDMin;
                        maxActiveDMinTime = item.time;
                    }
                    if (item.activeAMin > maxActiveAMin) {
                        maxActiveAMin = item.activeAMin;
                        maxActiveAMinTime = item.time;
                    }
                });

                if (maxSession > 2000) {
                    clientData.push({
                        activityId: eId,
                        name: eName,
                        maxSession: maxSession,
                        maxActiveD: maxActiveD,
                        maxActiveA: maxActiveA,
                        maxActiveDMin: maxActiveDMin,
                        maxActiveAMin: maxActiveAMin,
                        maxSessionTime: maxSessionTime,
                        maxActiveDTime: maxActiveDTime,
                        maxActiveATime: maxActiveATime,
                        maxActiveDMinTime: maxActiveDMinTime,
                        maxActiveAMinTime: maxActiveAMinTime,
                        start: dailyData.length > 0 ? dailyData[0].time : '',
                        end: dailyData.length > 0 ? dailyData[dailyData.length - 1].time : '',
                        data: dailyData
                    });
                }
            }
        }

        // 依據時間先後順序排序 (由新到舊)
        clientData.sort((a, b) => b.start.localeCompare(a.start));

        console.log("Building HTML file...");

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GA 事件流量深度分析</title>
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
        .card-1::before { background: #3b82f6; } /* Session */
        .card-2::before { background: #f59e0b; } /* Active D 30 */
        .card-3::before { background: #10b981; } /* Active A 30 */
        .card-4::before { background: #fbbf24; } /* Active D Min */
        .card-5::before { background: #34d399; } /* Active A Min */
        .card-6::before { background: #ec4899; } /* Time Range */

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

        /* Go Home Button */
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
        <div class="event-list" id="eventList">
            ${clientData.map((d, i) => `
                <div class="event-item" id="event-item-${i}" onclick="updateDashboard(${i})">
                    <div class="date">[${d.start ? d.start.slice(0, 10) : '未知日期'}]</div>
                    <div class="name">${d.name}</div>
                </div>
            `).join('')}
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
    const serverData = ${JSON.stringify(clientData)};
    let chartInstance = null;

    function updateDashboard(idx) {
        document.querySelectorAll('.event-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.getElementById('event-item-' + idx);
        if(activeItem) activeItem.classList.add('active');

        const d = serverData[idx];
        document.getElementById('eventHeading').innerText = d.name;

        // Calc peak tickets/orders
        let maxOrders = 0; let maxOrdersTime = '';
        let maxTickets = 0; let maxTicketsTime = '';
        d.data.forEach(item => {
            if (item.orders > maxOrders) { maxOrders = item.orders; maxOrdersTime = item.time; }
            if (item.tickets > maxTickets) { maxTickets = item.tickets; maxTicketsTime = item.time; }
        });

        // Update cards
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
        
        document.getElementById('valTime').innerText = d.start.slice(5) + " ~ " + d.end.slice(5);
        document.getElementById('valTimeSub').innerText = "總數據點數: " + d.data.length;

        // Update Table
        const tbody = document.querySelector('#dataTable tbody');
        tbody.innerHTML = d.data.map(item => {
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

    // Init
    window.onload = () => {
        updateDashboard(0);
    };

</script>
</body>
</html>
        `;

        const outPath = path.join(__dirname, 'A_GA_Events_Traffic_Report.html');
        fs.writeFileSync(outPath, htmlContent, 'utf8');
        console.log('Report generated successfully at ' + outPath);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

main().catch(console.dir);
