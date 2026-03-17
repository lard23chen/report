const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function updateIndexStats() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Aggregating data (Distinct Orders & Ticket Counts)...");

        // Pipeline to safely count distinct orders and total tickets
        const pipeline = [
            // 1. Filter
            {
                $match: {
                    "交易時間": { $exists: true, $ne: null },
                    "狀態": { $in: ["正常", "退票"] }
                }
            },
            // 2. Project
            {
                $project: {
                    month: { $substr: ["$交易時間", 0, 7] }, // YYYY-MM
                    status: "$狀態",
                    // Extract base Order ID (remove _N suffix)
                    orderId: {
                        $arrayElemAt: [
                            { $split: [{ $ifNull: ["$訂單編號", "UNKNOWN"] }, "_"] },
                            0
                        ]
                    },
                    price: { $ifNull: ["$售價", 0] },
                    fee: { $ifNull: ["$手續費", 0] }
                }
            },
            // 3. First Group by Month + OrderID
            {
                $group: {
                    _id: { month: "$month", orderId: "$orderId" },

                    // Tickets in this order
                    ticketsSales: { $sum: { $cond: [{ $eq: ["$status", "正常"] }, 1, 0] } },
                    revenueSales: { $sum: { $cond: [{ $eq: ["$status", "正常"] }, "$price", 0] } },

                    ticketsRefund: { $sum: { $cond: [{ $eq: ["$status", "退票"] }, 1, 0] } },
                    feeRefund: { $sum: { $cond: [{ $eq: ["$status", "退票"] }, "$fee", 0] } }
                }
            },
            // 4. Second Group by Month
            {
                $group: {
                    _id: "$_id.month",

                    // Sales Stats
                    salesOrderCount: {
                        $sum: { $cond: [{ $gt: ["$ticketsSales", 0] }, 1, 0] }
                    },
                    salesTicketCount: { $sum: "$ticketsSales" },
                    salesAmount: { $sum: "$revenueSales" },

                    // Refund Stats
                    refundOrderCount: {
                        $sum: { $cond: [{ $gt: ["$ticketsRefund", 0] }, 1, 0] }
                    },
                    refundTicketCount: { $sum: "$ticketsRefund" },
                    refundFee: { $sum: "$feeRefund" }
                }
            },
            // 5. Sort descending
            { $sort: { _id: -1 } }
        ];

        const results = await collection.aggregate(pipeline).toArray();
        console.log("Aggregation Results:", results);

        const validResults = results.filter(r => r._id && r._id.match(/^\d{4}-\d{2}$/));

        // Calculate Totals
        const totalSalesOrders = validResults.reduce((acc, r) => acc + r.salesOrderCount, 0);
        const totalSalesTickets = validResults.reduce((acc, r) => acc + r.salesTicketCount, 0);
        const totalSalesAmount = validResults.reduce((acc, r) => acc + r.salesAmount, 0);
        const totalRefundOrders = validResults.reduce((acc, r) => acc + r.refundOrderCount, 0);
        const totalRefundTickets = validResults.reduce((acc, r) => acc + r.refundTicketCount, 0);
        const totalRefundFee = validResults.reduce((acc, r) => acc + r.refundFee, 0);

        // Generate HTML
        let statsHtml = `
        <!-- STATS_START -->
        <div class="stats-section" style="margin-bottom: 3rem; background: var(--card-bg); border-radius: 16px; padding: 2rem; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    📊 月份交易統計 <span style="font-size: 1rem; color: var(--text-secondary); font-weight: 400;">(Monthly Statistics)</span>
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
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">退票筆數 (Refund Orders)</th>
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">退票張數 (Refund Tickets)</th>
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">退票手續費 (Fees)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        validResults.forEach((r, index) => {
            const nextMonth = validResults[index + 1];
            
            const getCompareHtml = (current, previous) => {
                if (!previous) return '';
                const diff = current - previous;
                const percent = ((Math.abs(diff) / previous) * 100).toFixed(1);
                const isUp = diff >= 0;
                return `<div class="change-note">
                    <span class="change-badge ${isUp ? 'change-up' : 'change-down'}">
                        ${isUp ? '▲' : '▼'} ${percent}%
                    </span>
                </div>`;
            };

            statsHtml += `
                        <tr style="transition: background-color 0.2s;">
                            <td style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); font-weight: 500;">${r._id}</td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary);">
                                ${r.salesOrderCount.toLocaleString()}
                                ${getCompareHtml(r.salesOrderCount, nextMonth ? nextMonth.salesOrderCount : null)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); font-weight: 500;">
                                ${r.salesTicketCount.toLocaleString()}
                                ${getCompareHtml(r.salesTicketCount, nextMonth ? nextMonth.salesTicketCount : null)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary);">
                                NT$ ${r.salesAmount.toLocaleString()}
                                ${getCompareHtml(r.salesAmount, nextMonth ? nextMonth.salesAmount : null)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">
                                ${r.refundOrderCount.toLocaleString()}
                                ${getCompareHtml(r.refundOrderCount, nextMonth ? nextMonth.refundOrderCount : null)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">
                                ${r.refundTicketCount.toLocaleString()}
                                ${getCompareHtml(r.refundTicketCount, nextMonth ? nextMonth.refundTicketCount : null)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">
                                NT$ ${r.refundFee.toLocaleString()}
                                ${getCompareHtml(r.refundFee, nextMonth ? nextMonth.refundFee : null)}
                            </td>
                        </tr>
            `;
        });

        statsHtml += `
                        <tr style="background-color: rgba(255, 255, 255, 0.05); font-weight: bold;">
                            <td style="padding: 1rem; color: var(--text-primary); border-top: 2px solid rgba(255,255,255,0.1);">總計 (Total)</td>
                            <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalSalesOrders.toLocaleString()}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalSalesTickets.toLocaleString()}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">NT$ ${totalSalesAmount.toLocaleString()}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalRefundOrders.toLocaleString()}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalRefundTickets.toLocaleString()}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">NT$ ${totalRefundFee.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 1rem; text-align: right; font-size: 0.85rem; color: var(--text-secondary);">
                * 購票/退票筆數: 不重複訂單編號數 (Orders) / 購票張數: 實際票券數量 (Tickets)
            </div>
        </div>
        <!-- STATS_END -->
        `;

        const indexPath = path.join(__dirname, 'report_index.html');
        let htmlContent = fs.readFileSync(indexPath, 'utf-8');

        const startMarker = '<!-- STATS_START -->';
        const endMarker = '<!-- STATS_END -->';
        const startIndex = htmlContent.indexOf(startMarker);
        const endIndex = htmlContent.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1) {
            console.log("Replacing existing stats block...");
            htmlContent = htmlContent.substring(0, startIndex) + statsHtml.trim() + htmlContent.substring(endIndex + endMarker.length);
        } else {
            const insertPoint = htmlContent.indexOf('<!-- Tabs Navigation -->');
            if (insertPoint !== -1) {
                htmlContent = htmlContent.substring(0, insertPoint) + statsHtml + '\n\n' + htmlContent.substring(insertPoint);
            }
        }

        // Update Chart Data
        const chartDataArray = [...validResults].reverse();
        const chartLabels = chartDataArray.map(r => r._id);
        const chartDataVals = chartDataArray.map(r => r.salesAmount);

        htmlContent = htmlContent.replace(/labels:\s*\[.*?\]/, `labels: ${JSON.stringify(chartLabels)}`);
        htmlContent = htmlContent.replace(/data:\s*\[.*?\]/, `data: ${JSON.stringify(chartDataVals)}`);

        fs.writeFileSync(indexPath, htmlContent, 'utf-8');
        console.log("Updated report_index.html successfully.");

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

updateIndexStats();
