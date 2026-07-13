require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

// Auto-detect previous month (run on 1st of each month)
// Allows override via CLI: node generate_monthly_report.js 2026-05
function getTargetMonth() {
    const arg = process.argv[2];
    if (arg && /^\d{4}-\d{2}$/.test(arg)) return arg;
    const d = new Date();
    d.setDate(0); // last day of previous month
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

const CHINESE_MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

async function generateReport() {
    const targetMonth = getTargetMonth(); // e.g. "2026-05"
    const [year, mon] = targetMonth.split('-');
    const monNum = parseInt(mon, 10);
    const monthLabel = `${year}年${mon}月`;                // "2026年05月"
    const chineseMon = CHINESE_MONTHS[monNum - 1];         // "五"
    const titleFull = `${monthLabel} 分析報表 (A系統)`;
    const outputFile = `A_Qware_Revenue_Report_${monthLabel}_分析報表.html`;

    console.log(`Generating report for: ${targetMonth} (${monthLabel})`);

    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log(`Fetching and aggregating ${targetMonth} data...`);
        const rawData = await collection.find(
            { "交易時間": { $regex: `^${targetMonth}` }, "訂單編號": { $not: /^B/ } },
            { projection: { "交易時間": 1, "售價": 1, "狀態": 1, "訂單編號": 1, "節目/商品名稱": 1, "業態別": 1, "付款方式": 1, "銷售點": 1, "手續費": 1, "實退金額": 1, "退票時間": 1, "退票因素": 1, "會員編號": 1, "取票方式": 1 } }
        ).toArray();

        console.log(`Processing ${rawData.length} records...`);

        const getVal = (v) => (v && v['$numberDecimal'] ? parseFloat(v['$numberDecimal']) : (Number(v) || 0));

        // --- 1. Global Aggregation ---
        const validOrders = rawData.filter(d => d['狀態'] === '正常');
        const totalRevenue = validOrders.reduce((acc, cur) => acc + getVal(cur['售價']), 0);
        const totalTickets = validOrders.length;
        const totalRefundedTickets = rawData.filter(d => getVal(d['手續費']) > 0).length;
        const totalRefundedValue = rawData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票').reduce((acc, cur) => acc + getVal(cur['實退金額']), 0);
        const totalRefundFees = rawData.reduce((acc, cur) => acc + getVal(cur['手續費']), 0);

        const globalOrdersSet = new Set();
        validOrders.forEach(o => { if(o['訂單編號']) globalOrdersSet.add(o['訂單編號'].split('_')[0]); });
        const orderCount = globalOrdersSet.size;
        const aov = orderCount ? Math.round(totalRevenue / orderCount) : 0;

        // --- 2. Trends ---
        const salesByDate = {};
        const dailyEventSales = {};
        validOrders.forEach(item => {
            const date = item['交易時間'].split(' ')[0];
            const p = getVal(item['售價']);
            const eventName = item['節目/商品名稱'] || 'Unknown';
            salesByDate[date] = (salesByDate[date] || 0) + p;
            if (!dailyEventSales[date]) dailyEventSales[date] = {};
            dailyEventSales[date][eventName] = (dailyEventSales[date][eventName] || 0) + p;
        });
        const trendDates = Object.keys(salesByDate).sort();
        const trendSales = trendDates.map(d => salesByDate[d]);

        const peakAnnotations = [];
        trendDates.forEach(date => {
            if (salesByDate[date] > 6000000) {
                const events = dailyEventSales[date];
                const topEventName = Object.entries(events).sort((a,b) => b[1] - a[1])[0][0];
                peakAnnotations.push({ date, value: salesByDate[date], label: topEventName.substring(0, 15) });
            }
        });

        const refundsByDate = {};
        rawData.filter(d => getVal(d['手續費']) > 0).forEach(item => {
            const date = (item['退票時間'] || item['交易時間']).split(' ')[0];
            refundsByDate[date] = (refundsByDate[date] || 0) + getVal(item['實退金額']);
        });
        const refundDates = Object.keys(refundsByDate).sort();
        const refundAmounts = refundDates.map(d => refundsByDate[d]);

        // --- 3. Per-Event & Payment/Point Aggregation ---
        const eventSummaryMap = {};
        const payMap = {};
        const pointMap = {};

        validOrders.forEach(item => {
            const p = getVal(item['售價']);
            const baseOrder = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'Unknown';
            const name = item['節目/商品名稱'] || 'Unknown';
            const date = item['交易時間'].split(' ')[0];

            if (!eventSummaryMap[name]) eventSummaryMap[name] = { category: item['業態別'] || '未知', revenue: 0, tickets: 0, eTickets: 0, paperTickets: 0, orders: new Set(), refunds: 0, refundTickets: 0, priceStats: {}, pointStats: {}, refundReasons: {}, refundOrders: new Set(), dailyTrend: {} };
            const es = eventSummaryMap[name];
            es.revenue += p;
            es.tickets += 1;
            // 取票方式：未列印=電子票、已取=紙票（與 report_index 月份統計/週報判定一致）
            if (item['取票方式'] === '未列印') es.eTickets += 1;
            else if (item['取票方式'] === '已取') es.paperTickets += 1;
            es.orders.add(baseOrder);
            es.priceStats[p] = (es.priceStats[p] || 0) + 1;
            es.pointStats[item['銷售點'] || '未知'] = (es.pointStats[item['銷售點'] || '未知'] || 0) + p;
            es.dailyTrend[date] = (es.dailyTrend[date] || 0) + p;

            const payMode = item['付款方式'] || '未知';
            if (!payMap[payMode]) payMap[payMode] = { revenue: 0, tickets: 0, orders: new Set() };
            payMap[payMode].revenue += p;
            payMap[payMode].tickets += 1;
            payMap[payMode].orders.add(baseOrder);

            const ptName = item['銷售點'] || '未知';
            if (!pointMap[ptName]) pointMap[ptName] = { revenue: 0, tickets: 0, orders: new Set() };
            pointMap[ptName].revenue += p;
            pointMap[ptName].tickets += 1;
            pointMap[ptName].orders.add(baseOrder);
        });

        rawData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票' || getVal(d['手續費']) > 0).forEach(item => {
            const name = item['節目/商品名稱'] || 'Unknown';
            if (!eventSummaryMap[name]) return;
            const es = eventSummaryMap[name];
            const f = getVal(item['手續費']);
            es.refunds += f;
            es.refundTickets += 1;
            if(item['訂單編號']) es.refundOrders.add(item['訂單編號'].split('_')[0]);
            const reason = item['退票因素'] || '未知';
            if(!es.refundReasons[reason]) es.refundReasons[reason] = { count: 0, fee: 0 };
            es.refundReasons[reason].count += 1;
            es.refundReasons[reason].fee += f;
        });

        const eventList = Object.entries(eventSummaryMap).map(([name, s]) => {
            s.orderCount = s.orders.size;
            s.refundOrderCount = s.refundOrders.size;
            const sortedDates = Object.keys(s.dailyTrend).sort();
            s.trendData = { labels: sortedDates, values: sortedDates.map(d => s.dailyTrend[d]) };
            delete s.orders; delete s.refundOrders; delete s.dailyTrend;
            return { name, ...s };
        });

        // --- 4. Nationality from Member Data ---
        const memberIds = [...new Set(validOrders.map(o => o['會員編號']).filter(Boolean))];
        const memberCollection = db.collection('Qware_Member_data');
        const memberDocs = await memberCollection.find(
            { '會員編號': { $in: memberIds } },
            { projection: { '會員編號': 1, '國家': 1, '_id': 0 } }
        ).toArray();

        const memberNationalityMap = {};
        memberDocs.forEach(m => { memberNationalityMap[m['會員編號']] = m['國家'] || '未知'; });

        const nationalityOrderMap = {};
        const seenOrders = new Set();
        validOrders.forEach(o => {
            const baseOrder = o['訂單編號'] ? o['訂單編號'].split('_')[0] : null;
            if (!baseOrder || seenOrders.has(baseOrder)) return;
            seenOrders.add(baseOrder);
            const country = memberNationalityMap[o['會員編號']] || '未知';
            nationalityOrderMap[country] = (nationalityOrderMap[country] || 0) + 1;
        });

        const totalNationalityOrders = Object.values(nationalityOrderMap).reduce((a, b) => a + b, 0);
        const nationalityListRaw = Object.entries(nationalityOrderMap)
            .map(([name, orders]) => ({ name, orders, share: (orders / totalNationalityOrders * 100).toFixed(1) }))
            .sort((a, b) => b.orders - a.orders);

        const top10 = nationalityListRaw.slice(0, 10);
        const othersOrders = nationalityListRaw.slice(10).reduce((acc, cur) => acc + cur.orders, 0);
        const nationalityList = othersOrders > 0
            ? [...top10, { name: '其他', orders: othersOrders, share: (othersOrders / totalNationalityOrders * 100).toFixed(1) }]
            : top10;

        const topByRevenue = [...eventList].sort((a,b) => b.revenue - a.revenue).slice(0, 5);
        const topByTickets = [...eventList].sort((a,b) => b.tickets - a.tickets).slice(0, 5);
        const topByRefunds = [...eventList].sort((a,b) => b.refunds - a.refunds).slice(0, 5);

        // 排除體育項目（業態別 = 運動票）的銷售排行；佔比分母維持全月總營收
        const nonSportsEventList = eventList.filter(e => e.category !== '運動票');
        const topByRevenueNoSports = [...nonSportsEventList].sort((a,b) => b.revenue - a.revenue).slice(0, 5);
        const topByTicketsNoSports = [...nonSportsEventList].sort((a,b) => b.tickets - a.tickets).slice(0, 5);

        const paymentList = Object.entries(payMap).map(([name, s]) => ({ name, revenue: s.revenue, tickets: s.tickets, orderCount: s.orders.size, share: (s.revenue/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue);
        const spList = Object.entries(pointMap).map(([name, s]) => ({ name, revenue: s.revenue, tickets: s.tickets, orderCount: s.orders.size, share: (s.revenue/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue);

        const summaryData = {
            totalRevenue, totalTickets, orderCount, aov, totalRefundTickets: totalRefundedTickets, totalRefundedValue, totalRefundFees,
            trendDates, trendSales, peakAnnotations, refundDates, refundAmounts,
            topByRevenue, topByTickets, topByRefunds, topByRevenueNoSports, topByTicketsNoSports, paymentList, spList,
            eventSummaryMap: Object.fromEntries(eventList.map(e => [e.name, e])),
            nationalityList,
            meta: { totalRows: rawData.length, reportTime: new Date().toLocaleString('zh-TW') }
        };

        // Extract HTML template from the Feb generator script
        const genScript = fs.readFileSync('generate_report_feb_2026.js', 'utf8');
        const backtickMarker = 'const htmlContent = `';
        const markerIdx = genScript.indexOf(backtickMarker);
        let tplStart = markerIdx + backtickMarker.length;
        while (tplStart < genScript.length && (genScript[tplStart] === '\r' || genScript[tplStart] === '\n')) tplStart++;
        const tplEnd = genScript.lastIndexOf('\n`;\n') !== -1
            ? genScript.lastIndexOf('\n`;\n')
            : genScript.lastIndexOf('\r\n`;\r\n');
        let uiTemplate = tplEnd > tplStart ? genScript.substring(tplStart, tplEnd) : genScript.substring(tplStart, genScript.lastIndexOf('`;\r\n'));

        const reportTime = new Date().toLocaleString('zh-TW');
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, 'ibon_logo.png');
            if (fs.existsSync(logoPath)) {
                logoBase64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
            }
        } catch(e) {}
        uiTemplate = uiTemplate
            .replace(/\\n/g, '\n')
            .replace(/\$\{dateTitle\}/g, titleFull)
            .replace(/\$\{reportTime\}/g, reportTime)
            .replace("${logoBase64 ? logoBase64 : 'https://ticket.ibon.com.tw/assets/img/logo.png'}", logoBase64 || 'https://ticket.ibon.com.tw/assets/img/logo.png')
            .replace('Data Source: MongoDB (QwareAi / Qware_A_Ticket_data)', 'Data Source: MongoDB (QwareAi / Qware_Ticket_Data) &middot; 已排除訂單編號 B 開頭之訂單');

        // 銷售排行兩張表的表頭插入電子票/紙票欄（以 table id 錨定，避免影響退票/付款/銷售點表）
        const eTicketThs = '\n                    <th class="text-right">電子票 (E-Ticket)</th>\n                    <th class="text-right">紙票 (Paper)</th>';
        uiTemplate = uiTemplate
            .replace(/(<table id="topEventsTable">[\s\S]*?<th class="text-right">張數 \(Tickets\)<\/th>)/, `$1${eTicketThs}`)
            .replace(/(<table id="topTicketsEventsTable">[\s\S]*?<th class="text-right">張數 \(Tickets\)<\/th>)/, `$1${eTicketThs}`);

        const uiPart = uiTemplate.split("    const dbData = '__DB_DATA_PLACEHOLDER__';")[0];

        let finalHtml = uiPart + `const summaryData = ${JSON.stringify(summaryData)};
    const dbData = [];
    let modalChart = null;

    window.addEventListener('load', function() {
        const s = summaryData;
        document.title = "ibon售票系統 ${titleFull}";
        const metaRows = document.getElementById('meta-total-rows');
        if (metaRows) metaRows.innerText = s.meta.totalRows.toLocaleString();
        const h1 = document.querySelector('h1');
        if(h1) h1.innerText = "ibon售票系統 ${titleFull}";

        document.getElementById('val-revenue').innerText = 'NT$ ' + s.totalRevenue.toLocaleString();
        document.getElementById('val-tickets').innerText = s.totalTickets.toLocaleString();
        document.getElementById('val-orders').innerText = s.orderCount.toLocaleString();
        document.getElementById('val-aov').innerText = 'NT$ ' + s.aov.toLocaleString();
        document.getElementById('val-refunded-amount').innerText = 'NT$ ' + s.totalRefundedValue.toLocaleString();
        document.getElementById('val-refund-fees').innerText = 'NT$ ' + s.totalRefundFees.toLocaleString();
        document.getElementById('val-refund-tickets').innerText = s.totalRefundTickets.toLocaleString();

        const renderTable = (selector, list, templateFn) => {
            const tbody = document.querySelector(selector + ' tbody');
            if(!tbody) return;
            tbody.innerHTML = '';
            list.forEach((item, i) => tbody.innerHTML += templateFn(item, i));
        };

        // 電子票/紙票欄：張數 + 占該節目張數比例
        const ttCell = (cnt, total) => \`<td class="text-right">\${(cnt||0).toLocaleString()}<span style="color:#888; font-size:0.85em;"> (\${total ? ((cnt||0)/total*100).toFixed(1) : '0.0'}%)</span></td>\`;

        const revenueRowTpl = (item, i) => \`<tr><td><span style="background:var(--accent-color); color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">\${i+1}</span></td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name.replace(/'/g, "\\\\'")}')">\${item.name}</span></td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td>\${ttCell(item.eTickets, item.tickets)}\${ttCell(item.paperTickets, item.tickets)}<td class="text-right" style="color: var(--accent-color); font-weight:bold;">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right" style="color:#888;">\${(item.revenue/s.totalRevenue*100).toFixed(1)}%</td></tr>\`;
        const ticketsRowTpl = (item, i) => \`<tr><td><span style="background:var(--accent-color); color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">\${i+1}</span></td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name.replace(/'/g, "\\\\'")}')">\${item.name}</span></td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right" style="color: var(--accent-color); font-weight:bold;">\${item.tickets.toLocaleString()}</td>\${ttCell(item.eTickets, item.tickets)}\${ttCell(item.paperTickets, item.tickets)}<td class="text-right">NT$ \${item.revenue.toLocaleString()}</td></tr>\`;
        // 銷售排行「全部 / 排除體育」切換（排除體育 = 業態別為運動票的節目不列入）
        window.switchRankView = function(mode) {
            const rev = (mode === 'noSports' && s.topByRevenueNoSports) ? s.topByRevenueNoSports : s.topByRevenue;
            const tik = (mode === 'noSports' && s.topByTicketsNoSports) ? s.topByTicketsNoSports : s.topByTickets;
            renderTable('#topEventsTable', rev, revenueRowTpl);
            renderTable('#topTicketsEventsTable', tik, ticketsRowTpl);
            document.querySelectorAll('#rankViewToggle .rank-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        };
        window.switchRankView('all');
        renderTable('#topRefundTable', s.topByRefunds, (item, i) => \`<tr><td><span style="background:#c62828; color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">\${i+1}</span></td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name.replace(/'/g, "\\\\'")}')">\${item.name}</span></td><td class="text-right">\${item.refundOrderCount.toLocaleString()}</td><td class="text-right">\${item.refundTickets.toLocaleString()}</td><td class="text-right" style="color: #c62828; font-weight:bold;">NT$ \${item.refunds.toLocaleString()}</td></tr>\`);

        renderTable('#paymentTable', s.paymentList, (item) => \`<tr><td class="font-bold">\${item.name}</td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${item.share}%</td></tr>\`);
        renderTable('#salesPointTable', s.spList, (item) => \`<tr><td class="font-bold">\${item.name}</td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${item.share}%</td></tr>\`);

        const natColors = ['#d81b60','#e53935','#fb8c00','#fdd835','#43a047','#00acc1','#1e88e5','#5e35b1','#8e24aa','#00897b','#546e7a'];
        const natLabels = s.nationalityList.map(n => n.name);
        const natData = s.nationalityList.map(n => n.orders);
        new Chart(document.getElementById('nationalityChart'), {
            type: 'doughnut',
            data: { labels: natLabels, datasets: [{ data: natData, backgroundColor: natColors.slice(0, natLabels.length), borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }] },
            plugins: [ChartDataLabels],
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#444', font: { size: 12 }, padding: 12 } }, tooltip: { callbacks: { label: (ctx) => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = (ctx.raw / total * 100).toFixed(1); return \` \${ctx.label}: \${ctx.raw.toLocaleString()} 筆 (\${pct}%)\`; } } }, datalabels: { color: 'white', font: { weight: 'bold', size: 11 }, formatter: (value, ctx) => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = (value / total * 100); if (pct < 2) return ''; return \`\${ctx.chart.data.labels[ctx.dataIndex]}\n\${pct.toFixed(1)}%\`; } } } }
        });

        renderTable('#nationalityTable', s.nationalityList, (item, i) => \`<tr><td><span style="background:var(--accent-color); color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">\${i + 1}</span></td><td class="font-bold">\${item.name}</td><td class="text-right">\${item.orders.toLocaleString()}</td><td class="text-right">\${item.share}%</td></tr>\`);

        const chartAnnotations = {};
        s.peakAnnotations.forEach((ann, idx) => {
            chartAnnotations['label' + idx] = { type: 'label', xValue: ann.date, yValue: ann.value, backgroundColor: 'rgba(255, 243, 224, 0.9)', borderColor: '#ff9800', borderWidth: 1, borderRadius: 4, content: [ann.label], font: { size: 11, weight: 'bold' }, padding: 6, position: 'center', yAdjust: -20 };
        });

        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: { labels: s.trendDates, datasets: [{ label: '每日營收', data: s.trendSales, borderColor: '#d81b60', backgroundColor: 'rgba(216, 27, 96, 0.1)', fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { annotation: { annotations: chartAnnotations } } }
        });

        new Chart(document.getElementById('refundTrendChart'), {
            type: 'line',
            data: { labels: s.refundDates, datasets: [{ label: '每日退票金額', data: s.refundAmounts, borderColor: '#757575', fill: false }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    });

    function analyzeEvent(eventName) {
        const s = summaryData.eventSummaryMap[eventName];
        if(!s) return;
        document.body.style.overflow = 'hidden';
        document.getElementById('analysisModal').style.display = 'flex';
        document.getElementById('modalTitle').innerText = eventName;
        document.getElementById('m-val-revenue').innerText = 'NT$ ' + s.revenue.toLocaleString();
        document.getElementById('m-val-tickets').innerText = s.tickets.toLocaleString();
        document.getElementById('m-val-aov').innerText = 'NT$ ' + (s.orderCount ? Math.round(s.revenue/s.orderCount).toLocaleString() : '0');
        document.getElementById('m-val-refunds').innerText = 'NT$ ' + s.refunds.toLocaleString();

        const pTbody = document.querySelector('#modalPriceTable tbody');
        if(pTbody) {
            pTbody.innerHTML = '';
            Object.entries(s.priceStats).sort((a,b) => b[0]-a[0]).forEach(([price, count]) => {
                pTbody.innerHTML += \`<tr><td>$\${Number(price).toLocaleString()}</td><td>\${count.toLocaleString()}</td><td>$\${(price*count).toLocaleString()}</td><td class="text-right">\${(price*count/s.revenue*100).toFixed(1)}%</td></tr>\`;
            });
        }

        const spTbody = document.querySelector('#modalSalesPointTable tbody');
        if(spTbody) {
            spTbody.innerHTML = '';
            Object.entries(s.pointStats).sort((a,b) => b[1]-a[1]).forEach(([name, rev]) => {
                spTbody.innerHTML += \`<tr><td>\${name}</td><td>--</td><td>$\${rev.toLocaleString()}</td><td class="text-right">\${(rev/s.revenue*100).toFixed(1)}%</td></tr>\`;
            });
        }

        const rfTbody = document.querySelector('#modalRefundTable tbody');
        if(rfTbody) {
            rfTbody.innerHTML = '';
            Object.entries(s.refundReasons).forEach(([reason, data]) => {
                rfTbody.innerHTML += \`<tr><td>\${reason}</td><td>\${data.count}</td><td>NT$ \${data.fee.toLocaleString()}</td></tr>\`;
            });
        }

        if(modalChart) modalChart.destroy();
        const ctx = document.getElementById('modalTrendChart').getContext('2d');
        modalChart = new Chart(ctx, {
            type: 'line',
            data: { labels: s.trendData.labels, datasets: [{ label: '每日營收', data: s.trendData.values, borderColor: '#d81b60', tension: 0.3, fill: true, backgroundColor: 'rgba(216, 27, 96, 0.05)' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function closeModal() {
        document.getElementById('analysisModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }
</script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>

<div style="max-width:1400px; margin:0 auto 40px; padding:0 30px;">
    <h2 style="font-size:1.1rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px; border-left:4px solid var(--accent-color); padding-left:10px; margin-bottom:20px;">訂單國籍占比 (Order Nationality)</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:25px;">
        <div style="background:var(--card-bg); border-radius:16px; padding:25px; box-shadow:var(--shadow); border:1px solid rgba(0,0,0,0.08);">
            <h3 style="margin-top:0; color:var(--text-primary); border-left:4px solid var(--accent-color); padding-left:10px;">國籍分佈</h3>
            <div style="height:350px;"><canvas id="nationalityChart"></canvas></div>
        </div>
        <div style="background:var(--card-bg); border-radius:16px; padding:25px; box-shadow:var(--shadow); border:1px solid rgba(0,0,0,0.08);">
            <h3 style="margin-top:0; color:var(--text-primary); border-left:4px solid var(--accent-color); padding-left:10px;">國籍明細</h3>
            <table id="nationalityTable" style="width:100%; border-collapse:collapse; font-size:0.95em;">
                <thead><tr>
                    <th style="padding:15px; text-align:left; border-bottom:1px solid rgba(0,0,0,0.1); color:var(--accent-color); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">排名</th>
                    <th style="padding:15px; text-align:left; border-bottom:1px solid rgba(0,0,0,0.1); color:var(--accent-color); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">國家/地區</th>
                    <th style="padding:15px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.1); color:var(--accent-color); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">訂單數</th>
                    <th style="padding:15px; text-align:right; border-bottom:1px solid rgba(0,0,0,0.1); color:var(--accent-color); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">佔比</th>
                </tr></thead>
                <tbody></tbody>
            </table>
        </div>
    </div>
</div>

<!-- Fixed PDF Button -->
<button onclick="window.print()" style="position:fixed; bottom:90px; right:30px; background:linear-gradient(135deg,#1e88e5,#1565c0); color:white; padding:12px 24px; border:none; border-radius:50px; cursor:pointer; font-weight:600; font-size:0.95rem; box-shadow:0 4px 15px rgba(30,136,229,0.4); display:flex; align-items:center; gap:8px; transition:all 0.3s ease; z-index:1000;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
    下載 PDF
</button>

<!-- Fixed Home Button -->
<a href="report_index.html" style="position:fixed; bottom:30px; right:30px; background:linear-gradient(135deg,#d81b60,#ad1457); color:white; padding:12px 24px; border-radius:50px; text-decoration:none; font-weight:600; font-size:0.95rem; box-shadow:0 4px 15px rgba(216,27,96,0.4); display:flex; align-items:center; gap:8px; transition:all 0.3s ease; z-index:1000;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
    回首頁
</a>

</body></html>`.replace(/2026年02月/g, monthLabel);

        fs.writeFileSync(path.join(__dirname, outputFile), '﻿' + finalHtml);
        console.log(`Monthly report generated: ${outputFile}`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

generateReport();
