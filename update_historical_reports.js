require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function run(targetMonth) {
    try {
        console.log(`--- Generating Report for ${targetMonth} ---`);
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log(`Fetching and aggregating ${targetMonth} data...`);
        const rawData = await collection.find(
            { "交易時間": { $regex: "^" + targetMonth } },
            { projection: { "交易時間": 1, "售價": 1, "狀態": 1, "訂單編號": 1, "節目/商品名稱": 1, "付款方式": 1, "銷售點": 1, "手續費": 1, "實退金額": 1, "退票時間": 1, "退票因素": 1 } }
        ).toArray();

        if (rawData.length === 0) {
            console.log(`No data found for ${targetMonth}. Skipping.`);
            return;
        }

        console.log(`Processing ${rawData.length} records...`);

        const getVal = (v) => (v && v['$numberDecimal'] ? parseFloat(v['$numberDecimal']) : (Number(v) || 0));

        // --- Aggregation Logic (Synchronized with Mar 2026) ---
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

        const eventSummaryMap = {};
        const payMap = {};
        const pointMap = {};

        validOrders.forEach(item => {
            const p = getVal(item['售價']);
            const baseOrder = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'Unknown';
            const name = item['節目/商品名稱'] || 'Unknown';
            const date = item['交易時間'].split(' ')[0];

            if (!eventSummaryMap[name]) eventSummaryMap[name] = { revenue: 0, tickets: 0, orders: new Set(), refunds: 0, refundTickets: 0, priceStats: {}, pointStats: {}, refundReasons: {}, refundOrders: new Set(), dailyTrend: {} };
            const es = eventSummaryMap[name];
            es.revenue += p; es.tickets += 1; es.orders.add(baseOrder);
            es.priceStats[p] = (es.priceStats[p] || 0) + 1;
            es.pointStats[item['銷售點'] || '未知'] = (es.pointStats[item['銷售點'] || '未知'] || 0) + p;
            es.dailyTrend[date] = (es.dailyTrend[date] || 0) + p;

            const payMode = item['付款方式'] || '未知';
            if (!payMap[payMode]) payMap[payMode] = { revenue: 0, tickets: 0, orders: new Set() };
            payMap[payMode].revenue += p; payMap[payMode].tickets += 1; payMap[payMode].orders.add(baseOrder);

            const ptName = item['銷售點'] || '未知';
            if (!pointMap[ptName]) pointMap[ptName] = { revenue: 0, tickets: 0, orders: new Set() };
            pointMap[ptName].revenue += p; pointMap[ptName].tickets += 1; pointMap[ptName].orders.add(baseOrder);
        });

        rawData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票' || getVal(d['手續費']) > 0).forEach(item => {
            const name = item['節目/商品名稱'] || 'Unknown';
            if (!eventSummaryMap[name]) return;
            const es = eventSummaryMap[name];
            const f = getVal(item['手續費']);
            es.refunds += f; es.refundTickets += 1;
            if(item['訂單編號']) es.refundOrders.add(item['訂單編號'].split('_')[0]);
            const reason = item['退票因素'] || '未知';
            if(!es.refundReasons[reason]) es.refundReasons[reason] = { count: 0, fee: 0 };
            es.refundReasons[reason].count += 1; es.refundReasons[reason].fee += f;
        });

        const eventList = Object.entries(eventSummaryMap).map(([name, s]) => {
            s.orderCount = s.orders.size;
            s.refundOrderCount = s.refundOrders.size;
            const sortedDates = Object.keys(s.dailyTrend).sort();
            s.trendData = { labels: sortedDates, values: sortedDates.map(d => s.dailyTrend[d]) };
            delete s.orders; delete s.refundOrders; delete s.dailyTrend;
            return { name, ...s };
        });

        const summaryData = {
            totalRevenue, totalTickets, orderCount, aov, totalRefundTickets: totalRefundedTickets, totalRefundedValue, totalRefundFees,
            trendDates, trendSales, peakAnnotations, refundDates, refundAmounts,
            topByRevenue: [...eventList].sort((a,b) => b.revenue - a.revenue).slice(0, 5),
            topByTickets: [...eventList].sort((a,b) => b.tickets - a.tickets).slice(0, 5),
            topByRefunds: [...eventList].sort((a,b) => b.refunds - b.refunds).slice(0, 5), // will sort by fee
            paymentList: Object.entries(payMap).map(([name, s]) => ({ name, revenue: s.revenue, tickets: s.tickets, orderCount: s.orders.size, share: (s.revenue/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue),
            spList: Object.entries(pointMap).map(([name, s]) => ({ name, revenue: s.revenue, tickets: s.tickets, orderCount: s.orders.size, share: (s.revenue/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue),
            eventSummaryMap: Object.fromEntries(eventList.map(e => [e.name, e])),
            meta: { totalRows: rawData.length, reportTime: new Date().toLocaleString('zh-TW') }
        };

        const templateHtml = fs.readFileSync('A_Qware_Revenue_Report_2026年03月_分析報表.html', 'utf8');
        const headerPart = templateHtml.split('const summaryData =')[0];
        const footerPart = templateHtml.split('function exportPDF() {')[1];

        const displayMonth = targetMonth.replace('-', '年') + '月';
        let finalHtml = headerPart + `const summaryData = ${JSON.stringify(summaryData)};
    const dbData = [];
    let modalChart = null;

    window.addEventListener('load', function() {
        const s = summaryData;
        document.title = "ibon售票系統 ${displayMonth} 分析報表 (A系統)";
        const h1 = document.querySelector('h1');
        if(h1) h1.innerText = "ibon售票系統 ${displayMonth} 分析報表 (A系統)";
        
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

        renderTable('#topEventsTable', s.topByRevenue, (item, i) => \`<tr><td><span style="background:var(--accent-color); color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">\${i+1}</span></td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name.replace(/'/g, "\\\\'")}')">\${item.name}</span></td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right" style="color: var(--accent-color); font-weight:bold;">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right" style="color:#888;">\${(item.revenue/s.totalRevenue*100).toFixed(1)}%</td></tr>\`);
        renderTable('#topTicketsEventsTable', s.topByTickets, (item, i) => \`<tr><td><span style="background:var(--accent-color); color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">\${i+1}</span></td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name.replace(/'/g, "\\\\'")}')">\${item.name}</span></td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right" style="color: var(--accent-color); font-weight:bold;">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td></tr>\`);
        renderTable('#topRefundTable', s.topByRefunds, (item, i) => \`<tr><td><span style="background:#c62828; color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">\${i+1}</span></td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name.replace(/'/g, "\\\\'")}')">\${item.name}</span></td><td class="text-right">\${item.refundOrderCount.toLocaleString()}</td><td class="text-right">\${item.refundTickets.toLocaleString()}</td><td class="text-right" style="color: #c62828; font-weight:bold;">NT$ \${item.refunds.toLocaleString()}</td></tr>\`);
        renderTable('#paymentTable', s.paymentList, (item) => \`<tr><td class="font-bold">\${item.name}</td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${item.share}%</td></tr>\`);
        renderTable('#salesPointTable', s.spList, (item) => \`<tr><td class="font-bold">\${item.name}</td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${item.share}%</td></tr>\`);

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
    
    function exportPDF() {` + footerPart;

        const fileName = `A_Qware_Revenue_Report_${displayMonth}_分析報表.html`;
        fs.writeFileSync(path.join(__dirname, fileName), '\ufeff' + finalHtml);
        console.log(`Successfully updated report: ${fileName}`);

    } catch (e) {
        console.error(`Error for ${targetMonth}:`, e);
    }
}

async function main() {
    await run("2026-02");
    await run("2026-01");
    await client.close();
}

main();
