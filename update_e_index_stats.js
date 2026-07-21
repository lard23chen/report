require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB Connection Setup
const uri = process.env.MONGODB_URI_QWARE;
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
                    orderId: "$訂單編號",
                    // 取票方式：E 系統直接存 "電子票" / "紙本票"（與 A 系統的「未列印/已取」編碼不同）
                    pickup: "$取票方式"
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
                    orderId: 1,
                    pickup: 1
                }
            },
            {
                $group: {
                    _id: "$month",
                    totalTickets: { $sum: { $cond: [{ $eq: ["$status", "成功"] }, 1, 0] } },
                    totalRevenue: { $sum: { $cond: [{ $eq: ["$status", "成功"] }, "$price", 0] } },
                    eTicketsSales: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "成功"] }, { $eq: ["$pickup", "電子票"] }] }, 1, 0] } },
                    paperTicketsSales: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "成功"] }, { $eq: ["$pickup", "紙本票"] }] }, 1, 0] } },
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
                    eTicketCount: "$eTicketsSales",
                    paperTicketCount: "$paperTicketsSales",
                    refundOrderCount: { $size: { $setDifference: ["$refundOrders", [null]] } },
                    refundTickets: 1,
                    refundFees: 1,
                    orderCount: { $size: { $setDifference: ["$validOrders", [null]] } }
                }
            },
            { $sort: { month: -1 } }
        ];

        const allStats = await collection.aggregate(pipeline).toArray();
        const stats = allStats; // removed filter 2026-02
        console.log("Stats found:", stats);

        // 2. Generate E_report_index.html
        let template = fs.readFileSync(path.join(__dirname, 'E_report_index.html'), 'utf8');

        // 2a. Replace Stats Table
        let tableRows = '';
        let totalStats = { orders: 0, tickets: 0, eTickets: 0, paperTickets: 0, revenue: 0, refOrders: 0, refTickets: 0, refFees: 0 };

        // 電子票/紙票欄：張數 + 占購票張數比例（占比放次行避免表格過寬）；與 A 系統 update_index_stats.js 同規格
        const ticketTypeCell = (count, total) => {
            const pct = total ? ((count / total) * 100).toFixed(1) : '0.0';
            return `${(count || 0).toLocaleString()}<div style="font-size: 0.8em; color: var(--text-secondary);">(${pct}%)</div>`;
        };

        stats.forEach((s, index) => {
            if (!s.month) return;
            totalStats.orders += s.orderCount;
            totalStats.tickets += s.totalTickets;
            totalStats.eTickets += (s.eTicketCount || 0);
            totalStats.paperTickets += (s.paperTicketCount || 0);
            totalStats.revenue += s.totalRevenue;
            totalStats.refOrders += s.refundOrderCount;
            totalStats.refTickets += s.refundTickets;
            totalStats.refFees += s.refundFees;

            // Calculate MoM differences if there is a previous month (which is the NEXT element in the descending array)
            let prevS = index + 1 < stats.length ? stats[index + 1] : null;

            const formatMoM = (current, previous, isNegativeGood = false) => {
                if (!previous || previous === 0) return '';
                const diff = current - previous;
                const pct = ((Math.abs(diff) / previous) * 100).toFixed(1);

                let badgeClass = '';
                let arrow = '';

                if (diff > 0) {
                    badgeClass = isNegativeGood ? 'change-down' : 'change-up';
                    arrow = '▲';
                } else if (diff < 0) {
                    badgeClass = isNegativeGood ? 'change-up' : 'change-down';
                    arrow = '▼';
                } else {
                    return '';
                }

                return `<span class="change-badge ${badgeClass}" style="display: inline-block; white-space: nowrap; margin-left: 4px;">${arrow} ${pct}%</span>`;
            };

            const ordersMoM = formatMoM(s.orderCount, prevS ? prevS.orderCount : null);
            const ticketsMoM = formatMoM(s.totalTickets, prevS ? prevS.totalTickets : null);
            const revenueMoM = formatMoM(s.totalRevenue, prevS ? prevS.totalRevenue : null);
            const refOrdersMoM = formatMoM(s.refundOrderCount, prevS ? prevS.refundOrderCount : null, true);
            const refTicketsMoM = formatMoM(s.refundTickets, prevS ? prevS.refundTickets : null, true);
            const refFeesMoM = formatMoM(s.refundFees, prevS ? prevS.refundFees : null, true);


            let monthDisplay = s.month;
            const currentMonthStr = new Date().toISOString().substring(0, 7);
            if (s.month === currentMonthStr) {
                monthDisplay += '<br><span style="font-size: 0.75em; color: var(--text-secondary);">(部份數據)</span>';
            }

            tableRows += `
                <tr style="transition: background-color 0.2s;">
                    <td style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); font-weight: 500; white-space: nowrap;">${monthDisplay}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); white-space: nowrap;">${s.orderCount.toLocaleString()}${ordersMoM}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); font-weight: 500; white-space: nowrap;">${s.totalTickets.toLocaleString()}${ticketsMoM}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); white-space: nowrap;">${ticketTypeCell(s.eTicketCount, s.totalTickets)}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); white-space: nowrap;">${ticketTypeCell(s.paperTicketCount, s.totalTickets)}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); white-space: nowrap;">NT$ ${s.totalRevenue.toLocaleString()}${revenueMoM}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary); white-space: nowrap;">${s.refundOrderCount.toLocaleString()}${refOrdersMoM}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary); white-space: nowrap;">${s.refundTickets.toLocaleString()}${refTicketsMoM}</td>
                    <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary); white-space: nowrap;">NT$ ${s.refundFees.toLocaleString()}${refFeesMoM}</td>
                </tr>
            `;
        });

        // Add Total Row
        tableRows += `
            <tr style="background-color: rgba(255, 255, 255, 0.05); font-weight: bold;">
                <td style="padding: 1rem; color: var(--text-primary); border-top: 2px solid rgba(255,255,255,0.1); white-space: nowrap;">總計</td>
                <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalStats.orders.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalStats.tickets.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--accent-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalStats.eTickets.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--purple-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalStats.paperTickets.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">NT$ ${totalStats.revenue.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalStats.refOrders.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalStats.refTickets.toLocaleString()}</td>
                <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">NT$ ${totalStats.refFees.toLocaleString()}</td>
            </tr>
        `;

        const statsHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    📊 E系統 月份交易統計
                </h3>
                <span style="font-size: 0.85rem; color: var(--text-secondary);">最後更新: ${new Date().toLocaleString('zh-TW')} (每月一號 08:30)</span>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: separate; border-spacing: 0; color: var(--text-secondary); font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 1rem; color: var(--text-primary); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; white-space: nowrap;">月份</th>
                            <th style="text-align: right; padding: 1rem; color: var(--success-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; white-space: nowrap;">購票筆數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--success-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; white-space: nowrap;">購票張數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--accent-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; white-space: nowrap;">電子票張數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--purple-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; white-space: nowrap;">紙票張數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--success-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; white-space: nowrap;">購票金額</th>
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; white-space: nowrap;">退票筆數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; white-space: nowrap;">退票張數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; white-space: nowrap;">退票手續費</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                MOM_ANALYSIS_PLACEHOLDER
            </div>
            </div>
            <div style="margin-top: 1rem; text-align: right; font-size: 0.85rem; color: var(--text-secondary);">
                * 數據來源: MongoDB (Qware_Ticket_Data_Esys) / 電子票=取票方式「電子票」、紙票=「紙本票」，占比為占當月購票張數比例
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

        // Build MoM analysis block
        let momHtml = '';
        if (stats.length >= 2) {
            const cur = stats[0], prev = stats[1];
            const pct = (v, p) => p ? ((v - p) / p * 100).toFixed(1) : '0';
            const sign = v => parseFloat(v) >= 0 ? '+' : '';
            const ordPct  = pct(cur.orderCount,       prev.orderCount);
            const tkPct   = pct(cur.totalTickets,     prev.totalTickets);
            const revPct  = pct(cur.totalRevenue,     prev.totalRevenue);
            const rOrdPct = pct(cur.refundOrderCount, prev.refundOrderCount);
            const rTkPct  = pct(cur.refundTickets,    prev.refundTickets);
            const rFeePct = pct(cur.refundFees,       prev.refundFees);
            const ordDiff = Math.abs(cur.orderCount - prev.orderCount).toLocaleString();
            const tkDiff  = Math.abs(cur.totalTickets - prev.totalTickets).toLocaleString();
            const revDiff = Math.abs(cur.totalRevenue - prev.totalRevenue).toLocaleString();
            momHtml = '<div style="margin-top:24px;">'
                + '<h4 style="color:var(--accent-color);font-size:1rem;margin-bottom:10px;">最近月份趨勢分析 (MoM Analysis)</h4>'
                + '<div style="background:#252525;border-radius:10px;padding:14px 18px;border-left:3px solid #66BB6A;max-width:640px;line-height:1.8;font-size:0.92rem;">'
                + '<div style="font-weight:700;margin-bottom:6px;color:var(--text-primary);">' + cur.month + ' 較上月(' + prev.month + ')</div>'
                + '<div style="color:var(--text-secondary);">📊 <b style="color:var(--text-primary);">交易量：</b>購票筆數 ' + sign(ordPct) + ordDiff + ' 筆（' + sign(ordPct) + ordPct + '%），購票張數 ' + sign(tkPct) + tkDiff + ' 張（' + sign(tkPct) + tkPct + '%）。</div>'
                + '<div style="color:var(--text-secondary);">💰 <b style="color:var(--text-primary);">收入：</b>購票金額 ' + sign(revPct) + ' NT$' + revDiff + '（' + sign(revPct) + revPct + '%），達 NT$' + cur.totalRevenue.toLocaleString() + '。</div>'
                + '<div style="color:var(--text-secondary);">🔻 <b style="color:var(--text-primary);">退票：</b>退票筆數 ' + sign(rOrdPct) + rOrdPct + '%、退票張數 ' + sign(rTkPct) + rTkPct + '%；退票手續費 ' + sign(rFeePct) + rFeePct + '%。</div>'
                + '</div></div>';
        }

        // Embed MoM analysis into statsHtml before writing (replacing in template would be overwritten by the stats block replacement below)
        const statsHtmlFinal = statsHtml.replace('MOM_ANALYSIS_PLACEHOLDER', momHtml);
        const newHtml = template.replace(
            /<!-- STATS_START -->[\s\S]*?<!-- Tabs Navigation -->/,
            () => `<!-- STATS_START -->
            <div class="stats-section" style="margin-bottom: 3rem; background: var(--card-bg); border-radius: 16px; padding: 2rem; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                ${statsHtmlFinal}
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
