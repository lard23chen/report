
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
            const rfAmt = getVal(item['實退金額']);

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

        // Convert Sets to size for JSON safety
        for (let name in eventSummaryMap) {
            eventSummaryMap[name].orderCount = eventSummaryMap[name].orders.size;
            delete eventSummaryMap[name].orders;
        }

        // --- 4. Rankings ---
        const eventList = Object.entries(eventSummaryMap).map(([name, s]) => ({ name, ...s }));
        const topByRevenue = [...eventList].sort((a,b) => b.revenue - a.revenue).slice(0, 10);
        const topByTickets = [...eventList].sort((a,b) => b.tickets - a.tickets).slice(0, 10);
        const topByRefunds = [...eventList].sort((a,b) => b.refunds - b.refunds).slice(0, 10); // Actually use fee

        // --- 5. Payment & Points ---
        const payMap = {};
        validOrders.forEach(item => { payMap[item['付款方式'] || '未知'] = (payMap[item['付款方式'] || '未知'] || 0) + getVal(item['售價']); });
        const paymentList = Object.entries(payMap).map(([name, rev]) => ({ name, revenue: rev, share: (rev/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue);

        const pointMap = {};
        validOrders.forEach(item => { pointMap[item['銷售點'] || '未知'] = (pointMap[item['銷售點'] || '未知'] || 0) + getVal(item['售價']); });
        const spList = Object.entries(pointMap).map(([name, rev]) => ({ name, revenue: rev, share: (rev/totalRevenue*100).toFixed(1) })).sort((a,b) => b.revenue - a.revenue);

        // --- 6. Build HTML following REPORT_SPEC_REVENUE_A.md ---
        const reportTime = new Date().toLocaleString('zh-TW');
        
        // Read Feb script to steal CSS and structure
        const febScript = fs.readFileSync('generate_report_feb_2026.js', 'utf8');
        const startTag = 'const htmlContent = `';
        const endTag = '`;';
        const template = febScript.substring(febScript.indexOf(startTag) + startTag.length, febScript.lastIndexOf(endTag));

        // Inject Pre-aggregated Data and modify frontend logic to use it
        let finalHtml = template
            .replace('const dbData = \'__DB_DATA_PLACEHOLDER__\';', `const summaryData = ${JSON.stringify({
                totalRevenue, totalTickets, orderCount, aov, totalRefundTickets: totalRefundedTickets, totalRefundedValue, totalRefundFees,
                trendDates, trendSales, refundDates, refundAmounts,
                topByRevenue, topByTickets, paymentList, spList,
                eventSummaryMap,
                meta: { totalRows: rawData.length, reportTime }
            })};`)
            .replace(/\${dateTitle}/g, "2026年03月 分析報表 (A系統)")
            .replace(/\${reportTime}/g, reportTime);

        // Overwrite frontend init() and analyzeEvent() to use summaryData
        const newScripts = `
<script>
    // Overwrite the original init to use summaryData instead of filtering dbData
    function init() {
        const s = summaryData;
        document.getElementById('meta-total-rows').innerText = s.meta.totalRows.toLocaleString();
        document.getElementById('val-revenue').innerText = 'NT$ ' + s.totalRevenue.toLocaleString();
        document.getElementById('val-tickets').innerText = s.totalTickets.toLocaleString();
        document.getElementById('val-orders').innerText = s.orderCount.toLocaleString();
        document.getElementById('val-aov').innerText = 'NT$ ' + s.aov.toLocaleString();
        document.getElementById('val-refunded-amount').innerText = 'NT$ ' + s.totalRefundedValue.toLocaleString();
        document.getElementById('val-refund-fees').innerText = 'NT$ ' + s.totalRefundFees.toLocaleString();
        document.getElementById('val-refund-tickets').innerText = s.totalRefundTickets.toLocaleString();

        // Tables
        const renderTable = (id, list, type) => {
            const tbody = document.querySelector(id + ' tbody');
            tbody.innerHTML = '';
            list.forEach((item, i) => {
                const tr = document.createElement('tr');
                if (type === 'rank-rev') {
                    tr.innerHTML = \`<td>\${i+1}</td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name}')">\${item.name}</span></td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${(item.revenue/s.totalRevenue*100).toFixed(1)}%</td>\`;
                } else if (type === 'rank-tick') {
                    tr.innerHTML = \`<td>\${i+1}</td><td><span class="analysis-link" onclick="analyzeEvent('\${item.name}')">\${item.name}</span></td><td class="text-right">\${item.orderCount.toLocaleString()}</td><td class="text-right">\${item.tickets.toLocaleString()}</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td>\`;
                } else if (type === 'pay') {
                    tr.innerHTML = \`<td>\${item.name}</td><td class="text-right">--</td><td class="text-right">--</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${item.share}%</td>\`;
                } else if (type === 'sp') {
                    tr.innerHTML = \`<td>\${item.name}</td><td class="text-right">--</td><td class="text-right">--</td><td class="text-right">NT$ \${item.revenue.toLocaleString()}</td><td class="text-right">\${item.share}%</td>\`;
                }
                tbody.appendChild(tr);
            });
        };

        renderTable('#topEventsTable', s.topByRevenue, 'rank-rev');
        renderTable('#topTicketsEventsTable', s.topByTickets, 'rank-tick');
        renderTable('#paymentTable', s.paymentList, 'pay');
        renderTable('#salesPointTable', s.spList, 'sp');

        // Main Chart
        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: s.trendDates,
                datasets: [{ label: '每日營收', data: s.trendSales, borderColor: '#d81b60', backgroundColor: 'rgba(216, 27, 96, 0.1)', fill: true, tension: 0.4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: '營收趨勢圖' } } }
        });

        // Refund Chart
        new Chart(document.getElementById('refundTrendChart'), {
            type: 'line',
            data: {
                labels: s.refundDates,
                datasets: [{ label: '每日退票金額', data: s.refundAmounts, borderColor: '#757575', fill: false }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function analyzeEvent(eventName) {
        const s = summaryData.eventSummaryMap[eventName];
        if(!s) return;
        document.body.style.overflow = 'hidden';
        document.getElementById('analysisModal').style.display = 'flex';
        document.getElementById('modalTitle').innerText = eventName;
        
        document.getElementById('m-val-revenue').innerText = 'NT$ ' + s.revenue.toLocaleString();
        document.getElementById('m-val-tickets').innerText = s.tickets.toLocaleString();
        document.getElementById('m-val-aov').innerText = 'NT$ ' + Math.round(s.revenue/s.orderCount).toLocaleString();
        document.getElementById('m-val-refunds').innerText = 'NT$ ' + s.refunds.toLocaleString();

        // Price Table
        const pTbody = document.querySelector('#modalPriceTable tbody');
        pTbody.innerHTML = '';
        Object.entries(s.priceStats).sort((a,b) => b[0]-a[0]).forEach(([price, count]) => {
            pTbody.innerHTML += \`<tr><td>$\${price}</td><td>\${count}</td><td>$\${(price*count).toLocaleString()}</td><td class="text-right">\${(price*count/s.revenue*100).toFixed(1)}%</td></tr>\`;
        });

        // Point Table
        const spTbody = document.querySelector('#modalSalesPointTable tbody');
        spTbody.innerHTML = '';
        Object.entries(s.pointStats).sort((a,b) => b[1]-a[1]).forEach(([name, rev]) => {
            spTbody.innerHTML += \`<tr><td>\${name}</td><td>--</td><td>$\${rev.toLocaleString()}</td><td class="text-right">\${(rev/s.revenue*100).toFixed(1)}%</td></tr>\`;
        });

        // Refund Table
        const rfTbody = document.querySelector('#modalRefundTable tbody');
        rfTbody.innerHTML = '';
        Object.entries(s.refundReasons).forEach(([reason, data]) => {
            rfTbody.innerHTML += \`<tr><td>\${reason}</td><td>\${data.count}</td><td>NT$ \${data.fee.toLocaleString()}</td></tr>\`;
        });
    }

    // Initialize after overwrite
    window.onload = init;
</script>
`;
        // Replace the script block in template with our new logic
        const scriptStart = finalHtml.indexOf('<script>') + 8;
        const scriptEnd = finalHtml.lastIndexOf('init();');
        // We inject our new logic at the end instead of replacing to keep Modal UI helpers if any, 
        // but Feb template uses a simple <script> block.
        finalHtml = finalHtml.split('</script>')[0] + '</script>' + newScripts + '</body></html>';

        const fileName = `A_Qware_Revenue_Report_2026年03月_分析報表.html`;
        fs.writeFileSync(path.join(__dirname, fileName), '\ufeff' + finalHtml);
        console.log(`Professional report generated: ${fileName}`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

generateReport();
