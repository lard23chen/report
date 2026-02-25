
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB Connection Setup
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
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data_Esys'); // Target Collection

        // 1. Get Monthly Statistics
        console.log("Aggregating Monthly Stats...");
        const pipeline = [
            {
                $project: {
                    month: { $substr: ["$交易時間", 0, 7] }, // Extract YYYY-MM
                    status: "$狀態",
                    price: { $ifNull: ["$售價", 0] },
                    refundAmt: { $ifNull: ["$實退金額", 0] },
                    refundFeeRaw: { $ifNull: ["$手續費", 0] },
                    orderId: "$訂單編號"
                }
            },
            {
                $project: {
                    month: 1,
                    status: 1,
                    price: 1,
                    refundAmt: 1,
                    refundFee: {
                        $cond: {
                            if: { $eq: [{ $type: "$refundFeeRaw" }, "string"] },
                            then: { $convert: { input: "$refundFeeRaw", to: "double", onError: 0, onNull: 0 } },
                            else: "$refundFeeRaw"
                        }
                    },
                    orderId: 1
                }
            },
            {
                $group: {
                    _id: "$month",
                    totalTickets: { $sum: { $cond: [{ $eq: ["$status", "成功"] }, 1, 0] } },
                    totalRevenue: { $sum: { $cond: [{ $eq: ["$status", "成功"] }, "$price", 0] } },
                    refundOrders: { $addToSet: { $cond: [{ $in: ["$status", ["已退票", "退票"]] }, "$orderId", null] } },
                    refundTickets: { $sum: { $cond: [{ $in: ["$status", ["已退票", "退票"]] }, 1, 0] } },
                    refundFees: { $sum: { $cond: [{ $in: ["$status", ["已退票", "退票"]] }, "$refundFee", 0] } },
                    validOrders: { $addToSet: { $cond: [{ $eq: ["$status", "成功"] }, "$orderId", null] } }
                }
            },
            {
                $project: {
                    month: "$_id",
                    totalTickets: 1,
                    totalRevenue: 1,
                    refundOrderCount: { $size: { $setDifference: ["$refundOrders", [null]] } },
                    refundTickets: 1,
                    refundFees: 1,
                    orderCount: { $size: { $setDifference: ["$validOrders", [null]] } }
                }
            },
            { $sort: { month: -1 } }
        ];

        const allStats = await collection.aggregate(pipeline).toArray();
        const stats = allStats.filter(s => s._id !== '2026-02');
        console.log("Stats found:", stats);

        // 2. Generate E_report_index.html
        let template = fs.readFileSync(path.join(__dirname, 'E_report_index.html'), 'utf8');

        // 2a. Replace Stats Table
        let tableRows = '';
        let totalStats = { orders: 0, tickets: 0, revenue: 0, refOrders: 0, refTickets: 0, refFees: 0 };

        stats.forEach((s, index) => {
            if (!s.month) return;
            totalStats.orders += s.orderCount;
            totalStats.tickets += s.totalTickets;
            totalStats.revenue += s.totalRevenue;
            totalStats.refOrders += s.refundOrderCount;
            totalStats.refTickets += s.refundTickets;
            totalStats.refFees += s.refundFees;

            // Calculate MoM differences if there is a previous month (which is the NEXT element in the descending array)
            let prevS = index + 1 < stats.length ? stats[index + 1] : null;

            const formatMoM = (current, previous, isNegativeGood = false) => {
                if (!previous || previous === 0) return '';
                const diff = current - previous;
                const pct = ((diff / previous) * 100).toFixed(1);

                let color = '';
                let arrow = '';

                if (diff > 0) {
                    color = isNegativeGood ? 'var(--warning-color)' : 'var(--success-color)';
                    arrow = '▲';
                } else if (diff < 0) {
                    color = isNegativeGood ? 'var(--success-color)' : 'var(--warning-color)';
                    arrow = '▼';
                } else {
                    return `<span style="font-size: 0.8em; color: var(--text-secondary); margin-left: 8px;">-</span>`;
                }

                return `<span style="font-size: 0.8em; color: ${color}; margin-left: 8px;">${arrow} ${Math.abs(pct)}%</span>`;
            };

            const ordersMoM = formatMoM(s.orderCount, prevS ? prevS.orderCount : null);
            const ticketsMoM = formatMoM(s.totalTickets, prevS ? prevS.totalTickets : null);
            const revenueMoM = formatMoM(s.totalRevenue, prevS ? prevS.totalRevenue : null);
            const refOrdersMoM = formatMoM(s.refundOrderCount, prevS ? prevS.refundOrderCount : null, true);
            const refTicketsMoM = formatMoM(s.refundTickets, prevS ? prevS.refundTickets : null, true);
            const refFeesMoM = formatMoM(s.refundFees, prevS ? prevS.refundFees : null, true);


            tableRows += `
                <tr style="transition: background-color 0.2s;">
                    <td style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); font-weight: 500;">${s.month}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary);">${s.orderCount.toLocaleString()}${ordersMoM}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); font-weight: 500;">${s.totalTickets.toLocaleString()}${ticketsMoM}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary);">NT$ ${s.totalRevenue.toLocaleString()}${revenueMoM}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">${s.refundOrderCount.toLocaleString()}${refOrdersMoM}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">${s.refundTickets.toLocaleString()}${refTicketsMoM}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">NT$ ${s.refundFees.toLocaleString()}${refFeesMoM}</td>
                </tr>
            `;
        });

        // Add Total Row
        tableRows += `
            <tr style="background-color: rgba(255, 255, 255, 0.05); font-weight: bold;">
                <td style="padding: 1rem; color: var(--text-primary); border-top: 2px solid rgba(255,255,255,0.1);">總計 (Total)</td>
                <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalStats.orders.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalStats.tickets.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">NT$ ${totalStats.revenue.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalStats.refOrders.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalStats.refTickets.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">NT$ ${totalStats.refFees.toLocaleString()}</td>
            </tr>
        `;

        const statsHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    📊 E系統 月份交易統計 <span style="font-size: 1rem; color: var(--text-secondary); font-weight: 400;">(Monthly Statistics - E-System)</span>
                </h3>
                <span style="font-size: 0.85rem; color: var(--text-secondary);">Last Updated: ${new Date().toLocaleString('zh-TW')}</span>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: separate; border-spacing: 0; color: var(--text-secondary); font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 1rem; color: var(--text-primary); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">月份 (Month)</th>
                            <th style="text-align: right; padding: 1rem; color: var(--success-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">購票筆數 (Orders)</th>
                            <th style="text-align: right; padding: 1rem; color: var(--success-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">購票張數 (Tickets)</th>
                            <th style="text-align: right; padding: 1rem; color: var(--success-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">購票金額 (Revenue)</th>
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">退票筆數 (Ref Orders)</th>
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">退票張數 (Ref Tix)</th>
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">退票手續費 (Fees)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
            </div>
            <div style="margin-top: 1rem; text-align: right; font-size: 0.85rem; color: var(--text-secondary);">
                * 數據來源: MongoDB (Qware_Ticket_Data_Esys)
            </div>
            <div style="margin-top: 3rem; background: var(--card-bg); border-radius: 12px; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.05);">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem; font-size: 1.2rem; display: flex; align-items: center; gap: 0.5rem;">📈 每月購票金額趨勢 <span style="font-size: 0.95rem; color: var(--text-secondary); font-weight: 400;">(Monthly Revenue Trend)</span></h4>
                <div style="height: 350px; position: relative;">
                    <canvas id="monthlyTrendChart"></canvas>
                </div>
            </div>
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    const ctx = document.getElementById('monthlyTrendChart');
                    if(ctx) {
                        try {
                            new Chart(ctx, {
                                type: 'line',
                                data: {
                                    labels: ${JSON.stringify([...stats].reverse().map(s => s.month))},
                                    datasets: [{
                                        label: '購票金額 (Revenue)',
                                        data: ${JSON.stringify([...stats].reverse().map(s => s.totalRevenue))},
                                        borderColor: '#ef4444',
                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                        fill: true,
                                        tension: 0.4
                                    }]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { 
                                        legend: { display: false },
                                        datalabels: {
                                            color: '#f8fafc',
                                            anchor: 'end',
                                            align: 'top',
                                            formatter: function(value) {
                                                if (value >= 1000000) {
                                                    return '$' + (value / 1000000).toFixed(1) + 'M';
                                                } else if (value >= 10000) {
                                                    return '$' + (value / 10000).toFixed(1) + 'W';
                                                }
                                                return '$' + value.toLocaleString();
                                            },
                                            font: {
                                                weight: 'bold',
                                                size: 11
                                            }
                                        }
                                    },
                                    layout: {
                                        padding: {
                                            top: 25
                                        }
                                    },
                                    scales: {
                                        y: { ticks: { callback: v => '$' + v.toLocaleString() } }
                                    }
                                },
                                plugins: [window.ChartDataLabels]
                            });
                        } catch (e) {
                            console.error('Chart.js failed to initialize', e);
                        }
                    }
                });
            </script>
        `;

        // Replace Placeholder
        const newHtml = template.replace(
            /<!-- STATS_START -->[\s\S]*?<!-- Tabs Navigation -->/,
            () => `<!-- STATS_START -->
            <div class="stats-section" style="margin-bottom: 3rem; background: var(--card-bg); border-radius: 16px; padding: 2rem; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                ${statsHtml}
            </div>
            <!-- STATS_END -->
            
            <!-- Tabs Navigation -->`
        );

        // Add BOM for Excel compatibility (optional) but mainly consistent UTF-8
        fs.writeFileSync(path.join(__dirname, 'E_report_index.html'), '\ufeff' + newHtml);
        console.log("Updated E_report_index.html with real stats.");

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main();
