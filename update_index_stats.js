require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
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
            // 1. Filter（排除訂單編號 B 開頭的訂單）
            {
                $match: {
                    "交易時間": { $exists: true, $ne: null },
                    "狀態": { $in: ["正常", "退票"] },
                    "訂單編號": { $not: /^B/ }
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
                    fee: { $ifNull: ["$手續費", 0] },
                    // 取票方式：未列印=電子票、已取=紙票（與週報判定慣例一致）
                    pickup: "$取票方式"
                }
            },
            // 3. First Group by Month + OrderID
            {
                $group: {
                    _id: { month: "$month", orderId: "$orderId" },

                    // Tickets in this order
                    ticketsSales: { $sum: { $cond: [{ $eq: ["$status", "正常"] }, 1, 0] } },
                    revenueSales: { $sum: { $cond: [{ $eq: ["$status", "正常"] }, "$price", 0] } },
                    eTicketsSales: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "正常"] }, { $eq: ["$pickup", "未列印"] }] }, 1, 0] } },
                    paperTicketsSales: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "正常"] }, { $eq: ["$pickup", "已取"] }] }, 1, 0] } },

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
                    eTicketCount: { $sum: "$eTicketsSales" },
                    paperTicketCount: { $sum: "$paperTicketsSales" },

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

        // Convert Decimal128 to plain number
        const toNum = (v) => {
            if (v == null) return 0;
            if (typeof v === 'number') return v;
            if (v.$numberDecimal !== undefined) return parseFloat(v.$numberDecimal);
            if (v.constructor && v.constructor.name === 'Decimal128') return parseFloat(v.toString());
            return parseFloat(v) || 0;
        };

        // Normalize all results to plain numbers
        validResults.forEach(r => {
            r.salesAmount = toNum(r.salesAmount);
            r.refundFee = toNum(r.refundFee);
        });

        // Calculate Totals
        const totalSalesOrders = validResults.reduce((acc, r) => acc + r.salesOrderCount, 0);
        const totalSalesTickets = validResults.reduce((acc, r) => acc + r.salesTicketCount, 0);
        const totalETickets = validResults.reduce((acc, r) => acc + (r.eTicketCount || 0), 0);
        const totalPaperTickets = validResults.reduce((acc, r) => acc + (r.paperTicketCount || 0), 0);
        const totalSalesAmount = validResults.reduce((acc, r) => acc + r.salesAmount, 0);
        const totalRefundOrders = validResults.reduce((acc, r) => acc + r.refundOrderCount, 0);
        const totalRefundTickets = validResults.reduce((acc, r) => acc + r.refundTicketCount, 0);
        const totalRefundFee = validResults.reduce((acc, r) => acc + r.refundFee, 0);

        // 電子票/紙票欄：張數 + 占購票張數比例（占比放次行避免表格過寬）
        const ticketTypeCell = (count, total) => {
            const pct = total ? ((count / total) * 100).toFixed(1) : '0.0';
            return `${(count || 0).toLocaleString()}<div style="font-size: 0.8em; color: var(--text-secondary);">(${pct}%)</div>`;
        };

        // Generate HTML
        let statsHtml = `
        <!-- STATS_START -->
        <div class="stats-section" style="margin-bottom: 3rem; background: var(--card-bg); border-radius: 16px; padding: 2rem; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    📊 月份交易統計
                </h3>
                <span id="lastUpdated" style="font-size: 0.85rem; color: var(--text-secondary);">最後更新: ${new Date().toLocaleString('zh-TW')} (每日 08:00 自動更新)</span>
            </div>

            <div style="overflow-x: hidden;">
                <table style="width: 100%; border-collapse: separate; border-spacing: 0; color: var(--text-secondary); font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 1rem; color: var(--text-primary); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">月份</th>
                            <th style="text-align: right; padding: 1rem; color: var(--success-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">購票筆數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--success-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">購票張數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--accent-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">電子票張數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--purple-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">紙票張數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--success-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">購票金額</th>
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">退票筆數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">退票張數</th>
                            <th style="text-align: right; padding: 1rem; color: var(--warning-color); border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600;">退票手續費</th>
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
                return `<span class="change-badge ${isUp ? 'change-up' : 'change-down'}" style="display: inline-block; white-space: nowrap; margin-left: 4px;">${isUp ? '▲' : '▼'} ${percent}%</span>`;
            };

            statsHtml += `
                        <tr style="transition: background-color 0.2s;">
                            <td style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); font-weight: 500;">${r._id}</td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary);">
                                ${r.salesOrderCount.toLocaleString()} ${getCompareHtml(r.salesOrderCount, nextMonth ? nextMonth.salesOrderCount : null)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); font-weight: 500;">
                                ${r.salesTicketCount.toLocaleString()} ${getCompareHtml(r.salesTicketCount, nextMonth ? nextMonth.salesTicketCount : null)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary);">
                                ${ticketTypeCell(r.eTicketCount, r.salesTicketCount)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary);">
                                ${ticketTypeCell(r.paperTicketCount, r.salesTicketCount)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary);">
                                NT$ ${r.salesAmount.toLocaleString()} ${getCompareHtml(r.salesAmount, nextMonth ? nextMonth.salesAmount : null)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">
                                ${r.refundOrderCount.toLocaleString()} ${getCompareHtml(r.refundOrderCount, nextMonth ? nextMonth.refundOrderCount : null)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">
                                ${r.refundTicketCount.toLocaleString()} ${getCompareHtml(r.refundTicketCount, nextMonth ? nextMonth.refundTicketCount : null)}
                            </td>
                            <td style="text-align: right; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">
                                NT$ ${r.refundFee.toLocaleString()} ${getCompareHtml(r.refundFee, nextMonth ? nextMonth.refundFee : null)}
                            </td>
                        </tr>
            `;
        });

        // Build MoM analysis for the two most recent months (E-system style)
        const momHtml = (() => {
            if (validResults.length < 2) return '';
            const cur = validResults[0];
            const prev = validResults[1];

            const diff = (c, p) => c - p;
            const pct = (c, p) => ((diff(c, p) / p) * 100).toFixed(1);
            const sign = (n) => n >= 0 ? '+' : '';
            const wan = (n) => {
                const abs = Math.abs(n);
                if (abs >= 100000000) return (n / 100000000).toFixed(2) + '億';
                return (n / 10000).toFixed(0) + '萬';
            };
            const describe = (pctVal, upWord, downWord) =>
                parseFloat(pctVal) >= 0 ? upWord : downWord;

            const orderDiff   = diff(cur.salesOrderCount, prev.salesOrderCount);
            const ticketDiff  = diff(cur.salesTicketCount, prev.salesTicketCount);
            const revDiff     = diff(cur.salesAmount, prev.salesAmount);
            const rOrderDiff  = diff(cur.refundOrderCount, prev.refundOrderCount);
            const rTicketDiff = diff(cur.refundTicketCount, prev.refundTicketCount);
            const rFeeDiff    = diff(cur.refundFee, prev.refundFee);

            const orderPct   = pct(cur.salesOrderCount, prev.salesOrderCount);
            const ticketPct  = pct(cur.salesTicketCount, prev.salesTicketCount);
            const revPct     = pct(cur.salesAmount, prev.salesAmount);
            const rOrderPct  = pct(cur.refundOrderCount, prev.refundOrderCount);
            const rTicketPct = pct(cur.refundTicketCount, prev.refundTicketCount);
            const rFeePct    = pct(cur.refundFee, prev.refundFee);

            const isRevUp = cur.salesAmount >= prev.salesAmount;
            const borderColor = isRevUp ? '#66BB6A' : '#EF5350';

            // 交易量描述
            const volDesc = (() => {
                const scale = Math.abs(parseFloat(orderPct));
                const qualifier = scale >= 30 ? '大幅' : scale >= 10 ? '明顯' : '小幅';
                const orderDir = parseFloat(orderPct) >= 0 ? '成長' : '下滑';
                const orderLabel = `購票筆數${qualifier}${orderDir}（${sign(orderDiff)}${wan(orderDiff)}筆，${sign(orderDiff)}${orderPct}%）`;
                const ticketScale = Math.abs(parseFloat(ticketPct));
                const tQualifier = ticketScale >= 30 ? '大幅' : ticketScale >= 10 ? '明顯' : '小幅';
                const ticketDir = parseFloat(ticketPct) >= 0 ? '增加' : '減少';
                const ticketLabel = `購票張數${tQualifier}${ticketDir}（${sign(ticketDiff)}${wan(ticketDiff)}張，${sign(ticketDiff)}${ticketPct}%）`;
                return `${orderLabel}；${ticketLabel}。`;
            })();

            // 收入描述
            const revDesc = (() => {
                const qualifier = Math.abs(parseFloat(revPct)) >= 30 ? '大幅' : Math.abs(parseFloat(revPct)) >= 10 ? '明顯' : '小幅';
                const dirWord = isRevUp ? '增加' : '減少';
                return `購票金額${qualifier}${dirWord}約 NT$${wan(Math.abs(revDiff))}（${sign(revDiff)}${revPct}%），本月達 NT$${wan(cur.salesAmount)}，客單價${isRevUp ? '提升' : '下滑'}。`;
            })();

            // 票種結構描述（電子票/紙票張數與占比變化；占比差以百分點 pp 表示）
            const ticketTypeDesc = (() => {
                const eCur = cur.eTicketCount || 0, ePrev = prev.eTicketCount || 0;
                const pCur = cur.paperTicketCount || 0, pPrev = prev.paperTicketCount || 0;
                const share = (c, t) => t ? (c / t) * 100 : 0;
                const eShareCur = share(eCur, cur.salesTicketCount);
                const eSharePrev = share(ePrev, prev.salesTicketCount);
                const eShareDiff = eShareCur - eSharePrev;
                const eDiff = diff(eCur, ePrev);
                const pDiff = diff(pCur, pPrev);
                const ePct = ePrev ? pct(eCur, ePrev) : '0.0';
                const pPct = pPrev ? pct(pCur, pPrev) : '0.0';
                const shiftWord = Math.abs(eShareDiff) < 0.5 ? '票種結構與上月相當'
                    : (eShareDiff >= 0 ? '電子票占比提升，無紙化趨勢向上' : '紙票占比回升');
                const eLabel = `電子票 ${eCur.toLocaleString()} 張（占 ${eShareCur.toFixed(1)}%，較上月 ${sign(eShareDiff)}${eShareDiff.toFixed(1)}pp，張數 ${sign(eDiff)}${ePct}%）`;
                const pLabel = `紙票 ${pCur.toLocaleString()} 張（占 ${(100 - eShareCur).toFixed(1)}%，張數 ${sign(pDiff)}${pPct}%）`;
                return `${eLabel}；${pLabel}。${shiftWord}。`;
            })();

            // 退票描述
            const refundDesc = (() => {
                const isRefundDown = cur.refundOrderCount < prev.refundOrderCount;
                const emoji = isRefundDown ? '🔻' : '🔺';
                const label = isRefundDown ? '退票改善' : '退票增加';
                const orderLabel = `退票筆數 ${sign(rOrderDiff)}${rOrderPct}%（${sign(rOrderDiff)}${rOrderDiff.toLocaleString()} 筆）`;
                const ticketLabel = `退票張數 ${sign(rTicketDiff)}${rTicketPct}%（${sign(rTicketDiff)}${rTicketDiff.toLocaleString()} 張）`;
                const feeLabel = `退票手續費 ${sign(rFeeDiff)}${rFeePct}%`;
                const feeNote = isRefundDown ? '，手續費同步減少。' : '，手續費亦增加。';
                return `${emoji} <b style="color:var(--text-primary);">${label}：</b>${orderLabel}、${ticketLabel}；${feeLabel}${feeNote}`;
            })();

            const volEmoji  = parseFloat(orderPct) >= 0 ? '📊' : '📉';
            const revEmoji  = isRevUp ? '💰' : '📉';

            return `
                <div style="margin-top:24px;">
                    <h4 style="color:var(--accent-color);font-size:1rem;margin-bottom:10px;">最近月份趨勢分析 (MoM Analysis)</h4>
                    <div style="background:#252525;border-radius:10px;padding:14px 18px;border-left:3px solid ${borderColor};max-width:640px;line-height:1.8;font-size:0.92rem;">
                        <div style="font-weight:700;margin-bottom:6px;color:var(--text-primary);">${cur._id} 較上月(${prev._id})</div>
                        <div style="color:var(--text-secondary);">${volEmoji} <b style="color:var(--text-primary);">交易量：</b>${volDesc}</div>
                        <div style="color:var(--text-secondary);">${revEmoji} <b style="color:var(--text-primary);">收入：</b>${revDesc}</div>
                        <div style="color:var(--text-secondary);">🎫 <b style="color:var(--text-primary);">票種結構：</b>${ticketTypeDesc}</div>
                        <div style="color:var(--text-secondary);">${refundDesc}</div>
                    </div>
                </div>`;
        })();

        statsHtml += `
                        <tr style="background-color: rgba(255, 255, 255, 0.05); font-weight: bold;">
                            <td style="padding: 1rem; color: var(--text-primary); border-top: 2px solid rgba(255,255,255,0.1);">總計 (Total)</td>
                            <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalSalesOrders.toLocaleString()}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalSalesTickets.toLocaleString()}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--accent-color); border-top: 2px solid rgba(255,255,255,0.1);">${ticketTypeCell(totalETickets, totalSalesTickets)}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--purple-color); border-top: 2px solid rgba(255,255,255,0.1);">${ticketTypeCell(totalPaperTickets, totalSalesTickets)}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--success-color); border-top: 2px solid rgba(255,255,255,0.1);">NT$ ${totalSalesAmount.toLocaleString()}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalRefundOrders.toLocaleString()}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">${totalRefundTickets.toLocaleString()}</td>
                            <td style="text-align: right; padding: 1rem; color: var(--warning-color); border-top: 2px solid rgba(255,255,255,0.1);">NT$ ${totalRefundFee.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
                ${momHtml}
            </div>
            <div style="margin-top: 1rem; text-align: right; font-size: 0.85rem; color: var(--text-secondary);">
                * 購票/退票筆數: 不重複訂單編號數 (Orders) / 購票張數: 實際票券數量 (Tickets) / 電子票=取票方式「未列印」、紙票=「已取」，占比為占當月購票張數比例 / 已排除訂單編號 B 開頭之訂單
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

        // Update Header Date
        const now = new Date();
        const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
        const timeStr = now.toLocaleString('zh-TW');

        htmlContent = fs.readFileSync(indexPath, 'utf-8');
        htmlContent = htmlContent.replace(/<div style="color: var\(--text-primary\); font-weight: 600;">.*?<\/div>/, `<div style="color: var(--text-primary); font-weight: 600;">${dateStr}</div>`);
        htmlContent = htmlContent.replace(/<div>報表產生時間：.*?<\/div>/, `<div>報表產生時間：${timeStr}</div>`);
        
        fs.writeFileSync(indexPath, htmlContent, 'utf-8');
        console.log("Updated header date and time successfully.");

        // Update Tab1 monthly report card (between TAB1_MONTH_CARD_START / TAB1_MONTH_CARD_END)
        if (validResults.length > 0) {
            const latestMonth = validResults[0]._id; // e.g. "2026-05"
            const [ly, lm] = latestMonth.split('-');
            const monthLabel = `${ly}年${lm}月`;
            const CHINESE_MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
            const chineseMon = CHINESE_MONTHS[parseInt(lm, 10) - 1];
            const newHref = `A_Qware_Revenue_Report_${monthLabel}_分析報表.html`;
            const newCard = `<!-- TAB1_MONTH_CARD_START -->
                <div class="card">
                    <div class="card-icon icon-revenue">📊</div>
                    <div class="card-content">
                        <h3>${monthLabel} 分析報表 (A系統)</h3>
                        <p>完整的${chineseMon}月份營收數據分析，包含支付方式佔比與重要銷售指標。</p>
                    </div>
                    <div class="card-meta">
                        <span class="badge">Monthly</span>
                        <a href="${newHref}" class="btn-link">查看報表</a>
                    </div>
                </div>
<!-- TAB1_MONTH_CARD_END -->`;

            let updatedHtml = fs.readFileSync(indexPath, 'utf-8');

            // Capture the outgoing Tab1 card before it's overwritten, so that if the
            // month rolled over we can migrate it into Tab3 (history) instead of
            // relying on someone remembering to do it manually.
            const oldCardMatch = updatedHtml.match(/<!-- TAB1_MONTH_CARD_START -->([\s\S]*?)<!-- TAB1_MONTH_CARD_END -->/);
            const oldHrefMatch = oldCardMatch && oldCardMatch[1].match(/href="(A_Qware_Revenue_Report_(\d{4})年(\d{2})月_分析報表\.html)"/);

            updatedHtml = updatedHtml.replace(
                /<!-- TAB1_MONTH_CARD_START -->[\s\S]*?<!-- TAB1_MONTH_CARD_END -->/,
                newCard
            );

            if (oldHrefMatch && oldHrefMatch[1] !== newHref && !updatedHtml.includes(oldHrefMatch[1])) {
                const [, oldHref, oldYear, oldMonthNum] = oldHrefMatch;
                const oldChineseMon = CHINESE_MONTHS[parseInt(oldMonthNum, 10) - 1];
                const tab3Card = `                <div class="card">
                    <div class="card-icon icon-revenue">📊</div>
                    <div class="card-content">
                        <h3>${oldYear}年${oldMonthNum}月 分析報表 (A系統)</h3>
                        <p>完整的${oldChineseMon}月份營收數據分析。</p>
                    </div>
                    <div class="card-meta">
                        <span class="badge">Monthly</span>
                        <a href="${oldHref}" class="btn-link">查看報表</a>
                    </div>
                </div>
`;
                const tab3GridOpen = /(<!-- Tab 3: History -->\s*<div id="tab3" class="tab-content">\s*<div class="grid">\s*)/;
                if (tab3GridOpen.test(updatedHtml)) {
                    updatedHtml = updatedHtml.replace(tab3GridOpen, `$1${tab3Card}`);
                    console.log(`Migrated ${oldYear}年${oldMonthNum}月 card into Tab3 history`);
                } else {
                    console.warn("Could not find Tab3 grid insertion point; old month card NOT migrated automatically.");
                }
            }

            fs.writeFileSync(indexPath, updatedHtml, 'utf-8');
            console.log(`Updated Tab1 monthly card to: ${monthLabel}`);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

updateIndexStats();
