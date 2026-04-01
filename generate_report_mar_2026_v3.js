
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function generateReport() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Fetching and aggregating March 2026 data...");
        const rawData = await collection.find(
            { "交易時間": { $regex: "^2026-03" } },
            { projection: { "交易時間": 1, "售價": 1, "狀態": 1, "訂單編號": 1, "節目/商品名稱": 1, "付款方式": 1, "銷售點": 1, "手續費": 1, "實退金額": 1, "退票時間": 1, "退票因素": 1 } }
        ).toArray();

        console.log(`Processing ${rawData.length} records...`);

        const getVal = (v) => (v && v['$numberDecimal'] ? parseFloat(v['$numberDecimal']) : (Number(v) || 0));

        // --- 1. Global Aggregation ---
        const validOrders = rawData.filter(d => d['狀態'] === '正常');
        const refundDocs = rawData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');
        const totalRefundFeesDocs = rawData.filter(d => getVal(d['手續費']) > 0);

        const totalRevenue = validOrders.reduce((acc, cur) => acc + getVal(cur['售價']), 0);
        const totalTickets = validOrders.length;
        const totalRefundedTickets = totalRefundFeesDocs.length;
        const totalRefundedValue = refundDocs.reduce((acc, cur) => acc + getVal(cur['實退金額']), 0);
        const totalRefundFees = rawData.reduce((acc, cur) => acc + getVal(cur['手續費']), 0);

        const uniqueOrdersSet = new Set();
        validOrders.forEach(o => { if(o['訂單編號']) uniqueOrdersSet.add(o['訂單編號'].split('_')[0]); });
        const orderCount = uniqueOrdersSet.size;
        const aov = orderCount ? Math.round(totalRevenue / orderCount) : 0;

        // --- 2. Trends ---
        const salesByDate = {};
        validOrders.forEach(item => {
            const date = item['交易時間'].split(' ')[0];
            salesByDate[date] = (salesByDate[date] || 0) + getVal(item['售價']);
        });
        const trendDates = Object.keys(salesByDate).sort();
        const trendSales = trendDates.map(d => salesByDate[d]);

        const refundsByDate = {};
        totalRefundFeesDocs.forEach(item => {
            let dateStr = item['退票時間'] || item['交易時間'];
            const date = dateStr.split(' ')[0];
            refundsByDate[date] = (refundsByDate[date] || 0) + getVal(item['實退金額']);
        });
        const refundDates = Object.keys(refundsByDate).sort();
        const refundAmounts = refundDates.map(d => refundsByDate[d]);

        // --- 3. Per-Event Summaries (For Modal) ---
        const eventSummaryMap = {};
        rawData.forEach(item => {
            const name = item['節目/商品名稱'] || 'Unknown';
            if (!eventSummaryMap[name]) {
                eventSummaryMap[name] = { 
                    revenue: 0, tickets: 0, orders: new Set(), refunds: 0, refundTickets: 0,
                    priceStats: {}, pointStats: {}, refundReasons: {}
                };
            }
            const s = eventSummaryMap[name];
            const p = getVal(item['售價']);
            const f = getVal(item['手續費']);

            if (item['狀態'] === '正常') {
                s.revenue += p;
                s.tickets += 1;
                if(item['訂單編號']) s.orders.add(item['訂單編號'].split('_')[0]);
                s.priceStats[p] = (s.priceStats[p] || 0) + 1;
                s.pointStats[item['銷售點'] || '未知'] = (s.pointStats[item['銷售點'] || '未知'] || 0) + p;
            } else if (item['狀態'] === '已退票' || item['狀態'] === '退票' || f > 0) {
                s.refunds += f;
                s.refundTickets += 1;
                const reason = item['退票因素'] || '未知';
                if(!s.refundReasons[reason]) s.refundReasons[reason] = { count: 0, fee: 0 };
                s.refundReasons[reason].count += 1;
                s.refundReasons[reason].fee += f;
            }
        });

        for (let name in eventSummaryMap) {
            eventSummaryMap[name].orderCount = eventSummaryMap[name].orders.size;
            delete eventSummaryMap[name].orders;
        }

        const eventList = Object.entries(eventSummaryMap).map(([name, s]) => ({ name, ...s }));
        const topByRevenue = [...eventList].sort((a,b) => b.revenue - a.revenue).slice(0, 10);
        const topByTickets = [...eventList].sort((a,b) => b.tickets - a.tickets).slice(0, 10);

        const payMap = {};
        validOrders.forEach(item => { payMap[item['付款方式'] || '未知'] = (payMap[item['付款方式'] || '未知'] || 0) + getVal(item['售價']); });
        const paymentList = Object.entries(payMap).map(([name, rev]) => ({ name, revenue: rev, share: (rev/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue);

        const pointMap = {};
        validOrders.forEach(item => { pointMap[item['銷售點'] || '未知'] = (pointMap[item['銷售點'] || '未知'] || 0) + getVal(item['售價']); });
        const spList = Object.entries(pointMap).map(([name, rev]) => ({ name, revenue: rev, share: (rev/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue);

        const reportTime = new Date().toLocaleString('zh-TW');
        const summaryData = {
            totalRevenue, totalTickets, orderCount, aov, totalRefundTickets: totalRefundedTickets, totalRefundedValue, totalRefundFees,
            trendDates, trendSales, refundDates, refundAmounts,
            topByRevenue, topByTickets, paymentList, spList,
            eventSummaryMap,
            meta: { totalRows: rawData.length, reportTime }
        };

        // --- 6. Build HTML by patching the template properly ---
        const templateHtml = fs.readFileSync('A_Qware_Revenue_Report_2026年02月_分析報表.html', 'utf8');
        
        // Split template into UI part and Script part
        // We find the <script> tag that starts defining dbData
        const scriptSplitTag = '<script>';
        const parts = templateHtml.split(scriptSplitTag);
        
        // part[0] is the entire HTML + CSS head
        // we want to rebuild everything from scratch after part[0]
        
        let finalHtml = parts[0] + `
<script>
    const summaryData = ${JSON.stringify(summaryData)};
    const dbData = []; // Legacy support

    // Core Initialization
    window.addEventListener('load', function() {
        const s = summaryData;
        
        // Update Meta
        if(document.getElementById('meta-total-rows'))
            document.getElementById('meta-total-rows').innerText = s.meta.totalRows.toLocaleString();
        
        // Update Cards
        document.getElementById('val-revenue').innerText = 'NT$ ' + s.totalRevenue.toLocaleString();
        document.getElementById('val-tickets').innerText = s.totalTickets.toLocaleString();
        document.getElementById('val-orders').innerText = s.orderCount.toLocaleString();
        document.getElementById('val-aov').innerText = 'NT$ ' + s.aov.toLocaleString();
        document.getElementById('val-refunded-amount').innerText = 'NT$ ' + s.totalRefundedValue.toLocaleString();
        document.getElementById('val-refund-fees').innerText = 'NT$ ' + s.totalRefundFees.toLocaleString();
        document.getElementById('val-refund-tickets').innerText = s.totalRefundTickets.toLocaleString();

        // Render Tables
        const renderTable = (selector, list, templateFn) => {
            const tbody = document.querySelector(selector + ' tbody');
            if(!tbody) return;
            tbody.innerHTML = '';
            list.forEach((item, i) => tbody.innerHTML += templateFn(item, i));
        };

        renderTable('#topEventsTable', s.topByRevenue, (item, i) => \`<tr><td>\${i+1}</td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name.replace(/'/g, "\\\\'")}')">\${item.name}</span></td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${(item.revenue/s.totalRevenue*100).toFixed(1)}%</td></tr>\`);
        renderTable('#topTicketsEventsTable', s.topByTickets, (item, i) => \`<tr><td>\${i+1}</td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name.replace(/'/g, "\\\\'")}')">\${item.name}</span></td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td></tr>\`);
        renderTable('#paymentTable', s.paymentList, (item) => \`<tr><td class="font-bold">\${item.name}</td><td class="text-right">--</td><td class="text-right">--</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${item.share}%</td></tr>\`);
        renderTable('#salesPointTable', s.spList, (item) => \`<tr><td class="font-bold">\${item.name}</td><td class="text-right">--</td><td class="text-right">--</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${item.share}%</td></tr>\`);

        // Charts
        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: s.trendDates,
                datasets: [{ label: '每日營收', data: s.trendSales, borderColor: '#d81b60', backgroundColor: 'rgba(216, 27, 96, 0.1)', fill: true, tension: 0.4 }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        new Chart(document.getElementById('refundTrendChart'), {
            type: 'line',
            data: {
                labels: s.refundDates,
                datasets: [{ label: '每日退票金額', data: s.refundAmounts, borderColor: '#757575', fill: false }]
            },
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
        pTbody.innerHTML = '';
        Object.entries(s.priceStats).sort((a,b) => b[0]-a[0]).forEach(([price, count]) => {
            pTbody.innerHTML += \`<tr><td>$\${price}</td><td>\${count}</td><td>$\${(price*count).toLocaleString()}</td><td class="text-right">\${(price*count/s.revenue*100).toFixed(1)}%</td></tr>\`;
        });

        const spTbody = document.querySelector('#modalSalesPointTable tbody');
        spTbody.innerHTML = '';
        Object.entries(s.pointStats).sort((a,b) => b[1]-a[1]).forEach(([name, rev]) => {
            spTbody.innerHTML += \`<tr><td>\${name}</td><td>--</td><td>$\${rev.toLocaleString()}</td><td class="text-right">\${(rev/s.revenue*100).toFixed(1)}%</td></tr>\`;
        });

        const rfTbody = document.querySelector('#modalRefundTable tbody');
        rfTbody.innerHTML = '';
        Object.entries(s.refundReasons).forEach(([reason, data]) => {
            rfTbody.innerHTML += \`<tr><td>\${reason}</td><td>\${data.count}</td><td>NT$ \${data.fee.toLocaleString()}</td></tr>\`;
        });
    }

    function closeModal() {
        document.getElementById('analysisModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }
</script>
</body></html>`.replace(/2026年02月/g, "2026年03月");

        const fileName = `A_Qware_Revenue_Report_2026年03月_分析報表.html`;
        fs.writeFileSync(path.join(__dirname, fileName), '\ufeff' + finalHtml);
        console.log(`Cleanly patched report generated: ${fileName}`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

generateReport();
