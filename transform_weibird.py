# -*- coding: utf-8 -*-
# Transform A_WeiBird_Report_2026.html to match GoldenDisc format/data processing.
# Reads the original file, extracts 3 data array lines, rebuilds everything else.
filepath = 'D:/2025/ai/mongodb/A_WeiBird_Report_2026.html'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# --- Pattern-match key lines (robust, no hardcoded indices) ---
header_end_idx = next(i for i, l in enumerate(lines) if '    </header>' in l)
dbdata_line      = next(l for l in lines if l.lstrip().startswith('const dbData = ['))
sectiondata_line  = next((l for l in lines if l.lstrip().startswith('const sectionData = [')), None)
gasessions_line   = next(l for l in lines if l.lstrip().startswith('const gaSessions = ['))
gareads_line      = next(l for l in lines if l.lstrip().startswith('const gaReads = ['))
pageviews_line    = next((l for l in lines if l.lstrip().startswith('const pageViews = [')), None)

new_lines = []

# ── Part 1: keep HTML head + <header>...</header> ──────────────────────────
new_lines.extend(lines[0:header_end_idx + 1])

# ── Part 2: new HTML body (GoldenDisc-style layout) ────────────────────────
new_lines.append('\n')

# Stats grid – 8 cards (IDs match init() below)
new_lines.append('    <div class="stats-grid">\n')
new_lines.append('        <div class="card"><h3>總成交金額</h3><div class="value" id="val-revenue">--</div></div>\n')
new_lines.append('        <div class="card"><h3>總銷售張數</h3><div class="value" id="val-tickets">--</div></div>\n')
new_lines.append('        <div class="card"><h3>平均客單價 (AOV)</h3><div class="value" id="val-aov">--</div></div>\n')
new_lines.append('        <div class="card"><h3>淨營收 (Net)</h3><div class="value text-success" id="val-net-revenue">--</div></div>\n')
new_lines.append('        <div class="card"><h3>淨銷售張數</h3><div class="value text-success" id="val-net-tickets">--</div></div>\n')
new_lines.append('        <div class="card"><h3>退票金額</h3><div class="value text-danger" id="val-refunds">--</div></div>\n')
new_lines.append('        <div class="card"><h3>退票張數</h3><div class="value text-danger" id="val-refund-tickets">--</div></div>\n')
new_lines.append('        <div class="card"><h3>退票手續費</h3><div class="value" id="val-refund-fees">--</div></div>\n')
new_lines.append('    </div>\n')
new_lines.append('\n')

# Show breakdown table (per-show stats matching the 8 cards)
new_lines.append('    <!-- Show Breakdown Table -->\n')
new_lines.append('    <div class="main-content">\n')
new_lines.append('        <div class="chart-card" style="grid-column: span 2;">\n')
new_lines.append('            <h3>各場次銷售概覽 (Show Breakdown)</h3>\n')
new_lines.append('            <table id="showBreakdownTable">\n')
new_lines.append('                <thead><tr>\n')
new_lines.append('                    <th>場次</th>\n')
new_lines.append('                    <th class="text-right">成交金額</th>\n')
new_lines.append('                    <th class="text-right">銷售張數</th>\n')
new_lines.append('                    <th class="text-right">平均客單價 (AOV)</th>\n')
new_lines.append('                    <th class="text-right">淨營收</th>\n')
new_lines.append('                    <th class="text-right">淨銷售張數</th>\n')
new_lines.append('                    <th class="text-right">退票金額</th>\n')
new_lines.append('                    <th class="text-right">退票張數</th>\n')
new_lines.append('                    <th class="text-right">退票手續費</th>\n')
new_lines.append('                </tr></thead>\n')
new_lines.append('                <tbody></tbody>\n')
new_lines.append('            </table>\n')
new_lines.append('        </div>\n')
new_lines.append('    </div>\n')
new_lines.append('\n')

# View chart (sessions proxy, full-width)
new_lines.append('    <div class="main-content" style="grid-template-columns: 1fr;">\n')
new_lines.append('        <div class="chart-card"><h3>網站流量趨勢 (Sessions by Date)</h3>\n')
new_lines.append('            <div style="position: relative; height: 260px;"><canvas id="viewChart"></canvas></div>\n')
new_lines.append('        </div>\n')
new_lines.append('    </div>\n')
new_lines.append('\n')

# Trend chart (daily tickets, full-width)
new_lines.append('    <div class="main-content" style="grid-template-columns: 1fr;">\n')
new_lines.append('        <div class="chart-card"><h3>每日銷售趨勢 (Daily Tickets Sold)</h3>\n')
new_lines.append('            <div style="position: relative; height: 260px;"><canvas id="trendChart"></canvas></div>\n')
new_lines.append('        </div>\n')
new_lines.append('    </div>\n')
new_lines.append('\n')

# Demo content: gender + age pie charts
new_lines.append('    <div class="demo-content">\n')
new_lines.append('        <div class="chart-card"><h3>性別分佈</h3>\n')
new_lines.append('            <div style="position: relative; height: 300px;"><canvas id="genderChart"></canvas></div>\n')
new_lines.append('        </div>\n')
new_lines.append('        <div class="chart-card"><h3>年齡分佈</h3>\n')
new_lines.append('            <div style="position: relative; height: 300px;"><canvas id="ageChart"></canvas></div>\n')
new_lines.append('        </div>\n')
new_lines.append('    </div>\n')
new_lines.append('\n')

# Demo content: city bar + natTable
new_lines.append('    <div class="demo-content">\n')
new_lines.append('        <div class="chart-card"><h3>城市分佈 Top 10</h3>\n')
new_lines.append('            <div style="position: relative; height: 300px;"><canvas id="cityChart"></canvas></div>\n')
new_lines.append('        </div>\n')
new_lines.append('        <div class="chart-card">\n')
new_lines.append('            <h3>國籍分佈 (Nationality Top 5)</h3>\n')
new_lines.append('            <table id="natTable">\n')
new_lines.append('                <thead><tr><th>國籍</th><th>人數(張數)</th><th>筆數</th><th>占比(筆數)</th></tr></thead>\n')
new_lines.append('                <tbody></tbody>\n')
new_lines.append('            </table>\n')
new_lines.append('        </div>\n')
new_lines.append('    </div>\n')
new_lines.append('\n')

# Demo content: paymentTable (left) + empty filler (right)
new_lines.append('    <div class="demo-content">\n')
new_lines.append('        <div class="chart-card">\n')
new_lines.append('            <h3>付款方式 (Payment Methods)</h3>\n')
new_lines.append('            <table id="paymentTable">\n')
new_lines.append('                <thead><tr><th>付款方式</th><th>筆數</th><th>占比</th></tr></thead>\n')
new_lines.append('                <tbody></tbody>\n')
new_lines.append('            </table>\n')
new_lines.append('        </div>\n')
new_lines.append('        <div class="chart-card" style="display:flex; align-items:center; justify-content:center; color:var(--text-secondary); font-size:0.9em;">\n')
new_lines.append('            <span>&#8592; 付款方式統計</span>\n')
new_lines.append('        </div>\n')
new_lines.append('    </div>\n')
new_lines.append('\n')

# Price table (7-col, span 2)
new_lines.append('    <!-- Price Table (GoldenDisc 7-col format) -->\n')
new_lines.append('    <div class="main-content">\n')
new_lines.append('        <div class="chart-card" style="grid-column: span 2;">\n')
new_lines.append('            <h3>各票價銷售詳情 (Sales by Price)</h3>\n')
new_lines.append('            <table id="priceTable">\n')
new_lines.append('                <thead><tr>\n')
new_lines.append('                    <th>票價 (Price)</th>\n')
new_lines.append('                    <th>座位總數 (Total)</th>\n')
new_lines.append('                    <th>保留數 (Reserved)</th>\n')
new_lines.append('                    <th>可售數 (Available)</th>\n')
new_lines.append('                    <th>銷售張數 (Sold Qty)</th>\n')
new_lines.append('                    <th>營收 (Revenue)</th>\n')
new_lines.append('                    <th>實銷率 (Sell-Through Rate)</th>\n')
new_lines.append('                </tr></thead>\n')
new_lines.append('                <tbody></tbody>\n')
new_lines.append('            </table>\n')
new_lines.append('        </div>\n')
new_lines.append('    </div>\n')
new_lines.append('\n')

# Sales Point table (span 2)
new_lines.append('    <!-- Sales Point Table -->\n')
new_lines.append('    <div class="main-content">\n')
new_lines.append('        <div class="chart-card" style="grid-column: span 2;">\n')
new_lines.append('            <h3>各銷售點分析 (Sales by Point)</h3>\n')
new_lines.append('            <table id="salesPointTable">\n')
new_lines.append('                <thead><tr>\n')
new_lines.append('                    <th>銷售點 (Point)</th>\n')
new_lines.append('                    <th>筆數 (Orders)</th>\n')
new_lines.append('                    <th>張數 (Tickets)</th>\n')
new_lines.append('                    <th>營收 (Revenue)</th>\n')
new_lines.append('                    <th>占比 (Share)</th>\n')
new_lines.append('                </tr></thead>\n')
new_lines.append('                <tbody></tbody>\n')
new_lines.append('            </table>\n')
new_lines.append('        </div>\n')
new_lines.append('    </div>\n')
new_lines.append('\n')

# ── Helper: generate 13-col peak-hour table HTML ────────────────────────────
def peak_table_html(table_id, title):
    th_b    = 'color: white !important; border-bottom: 1px solid #548235; border-right: 1px solid #548235; text-align: center;'
    th_blue = th_b + ' background-color:#5a9bd5;'
    th_last = 'color: white !important; border-bottom: 1px solid #548235; text-align: center;'
    h = []
    h.append('    <!-- Peak Hour Table -->\n')
    h.append('    <div class="main-content">\n')
    h.append('        <div class="chart-card" style="grid-column: span 2;">\n')
    h.append(f'            <h3 style="border-left-color: #70ad47;">{title}</h3>\n')
    h.append('            <div style="width: 100%; overflow-x: auto; border: 1px solid #333; border-radius: 8px;">\n')
    h.append(f'                <table id="{table_id}" style="margin-top: 0; white-space: nowrap; min-width: 100%;">\n')
    h.append('                    <thead>\n')
    h.append('                        <tr style="background-color: #70ad47; color: white;">\n')
    h.append(f'                            <th style="{th_b}">時間</th>\n')
    h.append(f'                            <th style="{th_blue}">每分鐘D<br>(排隊)</th>\n')
    h.append(f'                            <th style="{th_blue}">每分鐘A<br>(搶票)</th>\n')
    h.append(f'                            <th style="{th_blue}">Session<br>(連線)</th>\n')
    h.append(f'                            <th style="{th_b}">booking數</th>\n')
    h.append(f'                            <th style="{th_b}">booking累加</th>\n')
    h.append(f'                            <th style="{th_b}">訂單張數</th>\n')
    h.append(f'                            <th style="{th_b}">訂單累加</th>\n')
    h.append(f'                            <th style="{th_b}">刷卡張數</th>\n')
    h.append(f'                            <th style="{th_b}">刷卡累加</th>\n')
    h.append(f'                            <th style="{th_b}">ATM張數</th>\n')
    h.append(f'                            <th style="{th_b}">ATM累加</th>\n')
    h.append(f'                            <th style="{th_last}">銷售率</th>\n')
    h.append('                        </tr>\n')
    h.append('                    </thead>\n')
    h.append('                    <tbody style="text-align: right;"></tbody>\n')
    h.append('                </table>\n')
    h.append('            </div>\n')
    h.append('        </div>\n')
    h.append('    </div>\n')
    h.append('\n')
    return h

new_lines.extend(peak_table_html('minuteTable1_530', '開賣尖峰時段分析 (3/14 10:50 - 11:30 ｜ 5/30 場次)'))
new_lines.extend(peak_table_html('minuteTable1_531', '開賣尖峰時段分析 (3/14 10:50 - 11:30 ｜ 5/31 場次)'))
new_lines.extend(peak_table_html('minuteTable2_530', '開賣尖峰時段分析 (3/21 10:50 - 11:30 ｜ 5/30 場次)'))
new_lines.extend(peak_table_html('minuteTable2_531', '開賣尖峰時段分析 (3/21 10:50 - 11:30 ｜ 5/31 場次)'))

# AOV Analysis
new_lines.append('    <!-- AOV Analysis Section -->\n')
new_lines.append('    <div class="main-content">\n')
new_lines.append('        <div class="chart-card" style="grid-column: span 2; border-left: 5px solid #ffd700; background: linear-gradient(145deg, #1e1e1e, #252525);">\n')
new_lines.append('            <div id="aovAnalysisContainer" style="padding: 10px; line-height: 1.6;">\n')
new_lines.append('            </div>\n')
new_lines.append('        </div>\n')
new_lines.append('    </div>\n')
new_lines.append('\n')

# Traffic Deep Dive
new_lines.append('    <!-- Traffic Analysis Section -->\n')
new_lines.append('    <div class="main-content">\n')
new_lines.append('        <div class="chart-card" style="grid-column: span 2; border-left: 5px solid #42A5F5; background: linear-gradient(145deg, #1e1e1e, #252525);">\n')
new_lines.append('            <h3>\U0001f310 流量與轉換深度分析 (Traffic Deep Dive)</h3>\n')
new_lines.append('            <div id="trafficAnalysisContainer" style="padding: 10px; line-height: 1.6;">\n')
new_lines.append('            </div>\n')
new_lines.append('        </div>\n')
new_lines.append('    </div>\n')
new_lines.append('\n')

# Container close
new_lines.append('</div>\n')
new_lines.append('\n')

# ── Part 3: <script> + data arrays ─────────────────────────────────────────
new_lines.append('<script>\n')
new_lines.append(dbdata_line)
if sectiondata_line:
    new_lines.append(sectiondata_line)
else:
    new_lines.append('    const sectionData = [];\n')
new_lines.append(gasessions_line)
new_lines.append(gareads_line)
if pageviews_line:
    new_lines.append(pageviews_line)
else:
    new_lines.append('    const pageViews = [];\n')

# ── Part 4: new init() function + HTML footer ───────────────────────────────
new_js = r"""
    function init() {
        const validOrders = dbData.filter(d => d['狀態'] === '正常');
        const refundOrders = dbData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票');

        const revenue = validOrders.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
        const tickets = validOrders.length;
        const refundAmount = refundOrders.reduce((acc, cur) => acc + (cur['實退金額'] || 0), 0);
        const refundTickets = refundOrders.length;
        const refundFees = refundOrders.reduce((acc, cur) => {
            const fee = cur['手續費'];
            return acc + (fee && fee['$numberDecimal'] ? parseFloat(fee['$numberDecimal']) : (typeof fee === 'number' ? fee : 0));
        }, 0);

        const orderSet = new Set();
        validOrders.forEach(o => { if(o['訂單編號']) orderSet.add(o['訂單編號'].split('_')[0]); });
        const orders = orderSet.size;
        const aov = orders > 0 ? Math.round(revenue / orders) : 0;
        const netRevenue = revenue - refundAmount;
        const netTickets = tickets - refundTickets;

        document.getElementById('val-revenue').innerText = '$' + revenue.toLocaleString();
        document.getElementById('val-tickets').innerText = tickets.toLocaleString();
        document.getElementById('val-aov').innerText = '$' + aov.toLocaleString();
        document.getElementById('val-net-revenue').innerText = '$' + netRevenue.toLocaleString();
        document.getElementById('val-net-tickets').innerText = netTickets.toLocaleString();
        document.getElementById('val-refunds').innerText = '$' + refundAmount.toLocaleString();
        document.getElementById('val-refund-tickets').innerText = refundTickets.toLocaleString();
        document.getElementById('val-refund-fees').innerText = '$' + Math.round(refundFees).toLocaleString();

        // Show Breakdown Table
        const showDates = [...new Set(dbData.map(o => (o['演出時間/規格'] || '').substring(0, 10)).filter(d => d && d !== ''))].sort();
        const sbTbody = document.querySelector('#showBreakdownTable tbody');
        let grandShowRev = 0, grandShowTix = 0, grandShowNet = 0, grandShowNetTix = 0;
        let grandShowRef = 0, grandShowRefTix = 0, grandShowFees = 0;
        showDates.forEach(showDate => {
            const sv = validOrders.filter(o => (o['演出時間/規格'] || '').startsWith(showDate));
            const sr = refundOrders.filter(o => (o['演出時間/規格'] || '').startsWith(showDate));
            const sRev = sv.reduce((a, c) => a + (c['售價'] || 0), 0);
            const sTix = sv.length;
            const sRefAmt = sr.reduce((a, c) => a + (c['實退金額'] || 0), 0);
            const sRefTix = sr.length;
            const sRefFees = sr.reduce((acc, cur) => {
                const fee = cur['手續費'];
                return acc + (fee && fee['$numberDecimal'] ? parseFloat(fee['$numberDecimal']) : (typeof fee === 'number' ? fee : 0));
            }, 0);
            const sOrdSet = new Set(); sv.forEach(o => { if(o['訂單編號']) sOrdSet.add(o['訂單編號'].split('_')[0]); });
            const sAov = sOrdSet.size > 0 ? Math.round(sRev / sOrdSet.size) : 0;
            const sNet = sRev - sRefAmt;
            const sNetTix = sTix - sRefTix;
            // Show time label
            const fullSpec = (dbData.find(o => (o['演出時間/規格'] || '').startsWith(showDate)) || {})['演出時間/規格'] || showDate;
            const timeLabel = fullSpec.length >= 16 ? fullSpec.substring(0, 16) : fullSpec;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600; color:var(--accent-color); white-space:nowrap;">${timeLabel}</td>
                <td class="text-right">$${sRev.toLocaleString()}</td>
                <td class="text-right" style="font-weight:600;">${sTix.toLocaleString()}</td>
                <td class="text-right" style="color:#ffd700;">$${sAov.toLocaleString()}</td>
                <td class="text-right" style="color:var(--success);">$${sNet.toLocaleString()}</td>
                <td class="text-right" style="color:var(--success);">${sNetTix.toLocaleString()}</td>
                <td class="text-right" style="color:var(--danger);">$${sRefAmt.toLocaleString()}</td>
                <td class="text-right" style="color:var(--danger);">${sRefTix.toLocaleString()}</td>
                <td class="text-right">$${Math.round(sRefFees).toLocaleString()}</td>
            `;
            sbTbody.appendChild(tr);
            grandShowRev += sRev; grandShowTix += sTix; grandShowNet += sNet;
            grandShowNetTix += sNetTix; grandShowRef += sRefAmt;
            grandShowRefTix += sRefTix; grandShowFees += sRefFees;
        });
        const totalOrdSet = new Set(); validOrders.forEach(o => { if(o['訂單編號']) totalOrdSet.add(o['訂單編號'].split('_')[0]); });
        const grandAov = totalOrdSet.size > 0 ? Math.round(grandShowRev / totalOrdSet.size) : 0;
        const totalTr = document.createElement('tr');
        totalTr.style.cssText = 'background:rgba(255,215,0,0.08); border-top:2px solid rgba(255,215,0,0.4); font-weight:700;';
        totalTr.innerHTML = `
            <td style="color:var(--accent-color);">總計 (TOTAL)</td>
            <td class="text-right">$${grandShowRev.toLocaleString()}</td>
            <td class="text-right" style="font-weight:700;">${grandShowTix.toLocaleString()}</td>
            <td class="text-right" style="color:#ffd700;">$${grandAov.toLocaleString()}</td>
            <td class="text-right" style="color:var(--success);">$${grandShowNet.toLocaleString()}</td>
            <td class="text-right" style="color:var(--success);">${grandShowNetTix.toLocaleString()}</td>
            <td class="text-right" style="color:var(--danger);">$${grandShowRef.toLocaleString()}</td>
            <td class="text-right" style="color:var(--danger);">${grandShowRefTix.toLocaleString()}</td>
            <td class="text-right">$${Math.round(grandShowFees).toLocaleString()}</td>
        `;
        sbTbody.appendChild(totalTr);

        // 1. Daily Trend + Sessions
        const salesByDate = {};
        const viewsByDate = {};
        validOrders.forEach(o => {
            if(!o['交易時間']) return;
            const date = o['交易時間'].split(' ')[0];
            salesByDate[date] = (salesByDate[date] || 0) + 1;
        });
        // Use pageViews (Qware_A_Traffic_session_data) when available — has broader date coverage
        if (typeof pageViews !== 'undefined' && pageViews.length > 0) {
            pageViews.forEach(p => {
                if (!p['瀏覽日期']) return;
                const date = p['瀏覽日期'].substring(0, 10);
                viewsByDate[date] = (viewsByDate[date] || 0) + (p['瀏覽量'] || 0);
            });
        } else {
            gaSessions.forEach(s => {
                if (!s.SessionDate) return;
                const sd = String(s.SessionDate);
                const date = sd.slice(0,4) + '-' + sd.slice(4,6) + '-' + sd.slice(6,8);
                viewsByDate[date] = (viewsByDate[date] || 0) + (s.SessionCount || 0);
            });
        }
        const allDatesSet = new Set([...Object.keys(salesByDate), ...Object.keys(viewsByDate)]);
        const dates = Array.from(allDatesSet).sort();
        const dailyTickets = dates.map(d => salesByDate[d] || 0);
        const dailyViews = dates.map(d => viewsByDate[d] || 0);

        // 2. Price Distribution — grouped by show date × price
        // Map 場次代碼 → show date from dbData
        const showCodeToDate = {};
        dbData.forEach(o => {
            if (o['場次代碼'] && o['演出時間/規格']) {
                showCodeToDate[o['場次代碼']] = o['演出時間/規格'].substring(0, 10);
            }
        });

        // Build capacity per show per price (source: sectionData)
        const capacityByShowAndPrice = {};
        (sectionData || []).forEach(s => {
            const showDate = showCodeToDate[s['場次代碼']] || '未知';
            const nums = String(s['票區名稱'] || '').match(/\d{3,5}/g);
            if (!nums) return;
            const price = Math.max(...nums.map(Number).filter(n => n >= 100));
            if (price <= 0) return;
            if (!capacityByShowAndPrice[showDate]) capacityByShowAndPrice[showDate] = {};
            if (!capacityByShowAndPrice[showDate][price]) capacityByShowAndPrice[showDate][price] = { total: 0, reserved: 0, available: 0 };
            capacityByShowAndPrice[showDate][price].total    += (s['座位總數'] || 0);
            capacityByShowAndPrice[showDate][price].reserved += (s['保留數']   || 0);
            capacityByShowAndPrice[showDate][price].available+= (s['可售數']   || 0);
        });

        // Flat capacity (one show) for peak-table denominator
        const capacityByPrice = Object.values(capacityByShowAndPrice)[0] || {};

        // Group valid orders by show date, then by price — use per-show capacity
        const showPriceStats = {};
        validOrders.forEach(o => {
            const showDate = (o['演出時間/規格'] || '').substring(0, 10) || '未知';
            const p = o['售價'] || 0;
            if (!showPriceStats[showDate]) showPriceStats[showDate] = {};
            if (!showPriceStats[showDate][p]) {
                const cap = (capacityByShowAndPrice[showDate] || {})[p];
                showPriceStats[showDate][p] = {
                    total:     cap ? cap.total     : '-',
                    reserved:  cap ? cap.reserved  : '-',
                    available: cap ? cap.available : '-',
                    count: 0, revenue: 0, priceVal: p
                };
            }
            showPriceStats[showDate][p].count++;
            showPriceStats[showDate][p].revenue += p;
        });

        // Also build flat sectionArray for AOV/salesPoint usage
        const sectionStats = {};
        validOrders.forEach(o => {
            const p = o['售價'] || 0;
            const priceLabel = p > 0 ? p.toString() : '0';
            if(!sectionStats[priceLabel]) {
                const cap = capacityByPrice[p];
                sectionStats[priceLabel] = {
                    total:     cap ? cap.total     : '-',
                    reserved:  cap ? cap.reserved  : '-',
                    available: cap ? cap.available : '-',
                    count: 0, revenue: 0, priceVal: p
                };
            }
            sectionStats[priceLabel].count++;
            sectionStats[priceLabel].revenue += p;
        });
        const sectionArray = Object.keys(sectionStats).map(sec => ({
            name: '$' + sec, ...sectionStats[sec]
        })).sort((a,b) => b.priceVal - a.priceVal);

        // 3. Payment Methods
        const paymentStats = {};
        validOrders.forEach(o => {
            const m = o['付款方式'] || 'Other';
            paymentStats[m] = (paymentStats[m] || 0) + 1;
        });
        const paymentArray = Object.keys(paymentStats).map(k => ({ method: k, count: paymentStats[k] })).sort((a,b) => b.count - a.count);

        // 4. Age Distribution
        const ageStats = {};
        validOrders.forEach(o => {
            let age = o['年齡'];
            if (age && String(age).includes('不符')) return;
            let label = 'Unknown';
            const n = typeof age === 'number' ? age : parseInt(age);
            if (!isNaN(n) && n > 0) {
                if(n < 18) label = '<18';
                else if(n <= 24) label = '18-24';
                else if(n <= 34) label = '25-34';
                else if(n <= 44) label = '35-44';
                else if(n <= 54) label = '45-54';
                else label = '55+';
            }
            ageStats[label] = (ageStats[label] || 0) + 1;
        });
        const ageOrder = ['<18', '18-24', '25-34', '35-44', '45-54', '55+', 'Unknown'];
        const ageLabels = ageOrder.filter(a => ageStats[a] !== undefined);
        const ageData = ageLabels.map(a => ageStats[a]);

        // 5. Gender Distribution
        const genderStats = {};
        validOrders.forEach(o => {
            let g = o['性別'];
            if(g && g !== '-' && g !== '未知' && !String(g).includes('不符')) {
                genderStats[g] = (genderStats[g] || 0) + 1;
            }
        });

        // 6. Nationality
        const natStatsRaw = {};
        validOrders.forEach(o => {
            let n = o['國籍'];
            if (n === 'Taiwan, Province of China') n = 'Taiwan';
            if (n && n !== '-' && n !== '未知' && n !== 'null' && n !== 'undefined' && !String(n).includes('不符')) {
                if (!natStatsRaw[n]) natStatsRaw[n] = { tickets: 0, orders: new Set() };
                natStatsRaw[n].tickets++;
                const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : Math.random().toString();
                natStatsRaw[n].orders.add(orderId);
            }
        });
        const natArray = Object.keys(natStatsRaw).map(k => ({
            nat: k, tickets: natStatsRaw[k].tickets, ordersCount: natStatsRaw[k].orders.size
        })).sort((a,b) => b.ordersCount - a.ordersCount);
        let topNat = natArray.slice(0, 5);
        const otherNatTickets = natArray.slice(5).reduce((acc, cur) => acc + cur.tickets, 0);
        const otherNatOrders  = natArray.slice(5).reduce((acc, cur) => acc + cur.ordersCount, 0);
        if (otherNatOrders > 0 || otherNatTickets > 0) {
            topNat.push({ nat: '其他 (Other)', tickets: otherNatTickets, ordersCount: otherNatOrders });
        }

        // 7. City Distribution
        const cityStatsRaw = {};
        validOrders.forEach(o => {
            let n = o['縣市別'];
            if(n && n !== '-' && n !== '未知' && n !== 'null' && n !== 'undefined' && !String(n).includes('不符')) {
                if (!cityStatsRaw[n]) cityStatsRaw[n] = { orders: new Set() };
                const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : Math.random().toString();
                cityStatsRaw[n].orders.add(orderId);
            }
        });
        const cityArrayStr = Object.keys(cityStatsRaw).map(k => ({
            city: k, count: cityStatsRaw[k].orders.size
        })).sort((a,b) => b.count - a.count);
        const cityLabels = cityArrayStr.slice(0, 10).map(x => x.city);
        const cityData   = cityArrayStr.slice(0, 10).map(x => x.count);

        // ── Render Charts ──────────────────────────────────────────────────

        new Chart(document.getElementById('viewChart'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Session Count (Daily)',
                    data: dailyViews,
                    borderColor: '#42A5F5',
                    backgroundColor: 'rgba(66, 165, 245, 0.1)',
                    tension: 0.3, fill: true, pointRadius: 4, pointHoverRadius: 6
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#eee', align: 'top', font: { weight: 'bold', size: 10 },
                        formatter: v => v === 0 ? '' : (v >= 1000 ? (v/1000).toFixed(1) + 'k' : Math.round(v))
                    }
                },
                scales: {
                    x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                    y: { grid: { color: '#333' }, ticks: { color: '#42A5F5', callback: v => v >= 1000 ? v/1000+'k' : v }, afterFit: ax => { ax.width = 60; } }
                }
            }
        });

        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: '銷售張數 (Tickets)',
                    data: dailyTickets,
                    borderColor: '#ffd700',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    tension: 0.3, fill: true, pointRadius: 4, pointHoverRadius: 6
                }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { color: '#eee', align: 'top', font: { weight: 'bold', size: 10 }, formatter: v => v === 0 ? '' : Math.round(v) }
                },
                scales: {
                    x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                    y: { grid: { color: '#333' }, ticks: { color: '#ffd700' }, afterFit: ax => { ax.width = 60; } }
                }
            }
        });

        new Chart(document.getElementById('ageChart'), {
            type: 'pie',
            data: {
                labels: ageLabels,
                datasets: [{ data: ageData, backgroundColor: ['#42A5F5','#EC407A','#FFD700','#66BB6A','#AB47BC','#FFA726','#BDBDBD'], borderWidth: 0 }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#ccc' } },
                    datalabels: {
                        color: 'white', font: { weight: 'bold', size: 11 }, padding: 2,
                        formatter: function(value, context) {
                            if (value === 0) return '';
                            const total = context.chart.data.datasets[0].data.reduce((a,b) => a+b, 0);
                            const p = total > 0 ? ((value/total)*100).toFixed(1)+'%' : '0%';
                            return value < (total * 0.05) ? p : [value.toLocaleString(), '('+p+')'];
                        }
                    }
                }
            }
        });

        new Chart(document.getElementById('genderChart'), {
            type: 'pie',
            data: {
                labels: Object.keys(genderStats),
                datasets: [{ data: Object.values(genderStats), backgroundColor: ['#42A5F5','#EC407A','#BDBDBD'], borderWidth: 0 }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#ccc' } },
                    datalabels: {
                        color: 'white', font: { weight: 'bold', size: 14 },
                        formatter: function(value, context) {
                            const total = context.chart.data.datasets[0].data.reduce((a,b) => a+b, 0);
                            const p = total > 0 ? ((value/total)*100).toFixed(1)+'%' : '0%';
                            return [value.toLocaleString(), '('+p+')'];
                        }
                    }
                }
            }
        });

        new Chart(document.getElementById('cityChart'), {
            type: 'bar',
            data: {
                labels: cityLabels,
                datasets: [{ data: cityData, backgroundColor: '#66bb6a', borderRadius: 4 }]
            },
            plugins: [ChartDataLabels],
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { color: '#eee', anchor: 'end', align: 'top', font: { size: 12 }, formatter: v => v.toLocaleString() }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#ccc', maxRotation: 45, minRotation: 45 } },
                    y: { grid: { color: '#333' }, ticks: { color: '#888' } }
                }
            }
        });

        // Nationality Table
        const natTbody = document.querySelector('#natTable tbody');
        const totalValidNatOrders = natArray.reduce((acc, cur) => acc + cur.ordersCount, 0);
        topNat.forEach(n => {
            const tr = document.createElement('tr');
            const share = totalValidNatOrders ? ((n.ordersCount / totalValidNatOrders) * 100).toFixed(1) + '%' : '0%';
            tr.innerHTML = `
                <td>${n.nat}</td>
                <td class="text-right">${n.tickets.toLocaleString()}</td>
                <td class="text-right">${n.ordersCount.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:${share}; background:#66bb6a; height:6px;"></div>
                </div> ${share}</td>
            `;
            natTbody.appendChild(tr);
        });

        // Price Table — per-show grouped rows (only rows with valid 座位總數)
        const tbody = document.querySelector('#priceTable tbody');

        function mkSellRate(count, total) {
            if (typeof total === 'number' && total > 0)
                return Math.min(100, (count / total * 100)).toFixed(1) + '%';
            return '-';
        }
        function fmtCell(v, color) {
            const s = v === '-' ? '-' : Number(v).toLocaleString();
            return `<td class="text-right" style="color:${color};">${s}</td>`;
        }

        let grandCount = 0, grandRev = 0, grandCap = 0;

        Object.keys(showPriceStats).sort().forEach(showDate => {
            // Show header row
            const hRow = document.createElement('tr');
            hRow.style.cssText = 'background:rgba(56,189,248,0.12); border-top:2px solid var(--accent-color);';
            hRow.innerHTML = `<td colspan="7" style="font-weight:700; color:var(--accent-color); padding:10px 14px; font-size:1.05em;">&#127926; ${showDate} 場次</td>`;
            tbody.appendChild(hRow);

            const priceMap = showPriceStats[showDate];
            const priceRows = Object.keys(priceMap)
                .map(p => ({ name: '$' + p, ...priceMap[p] }))
                .filter(p => p.count > 0 && typeof p.total === 'number' && p.total > 0)
                .sort((a, b) => b.priceVal - a.priceVal);

            let showCount = 0, showRev = 0, showCap = 0;
            priceRows.forEach(p => {
                const rate = mkSellRate(p.count, p.total);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.name}</td>
                    ${fmtCell(p.total,    '#94a3b8')}
                    ${fmtCell(p.reserved, '#ef4444')}
                    ${fmtCell(p.available,'#4ade80')}
                    <td class="text-right" style="font-weight:bold; color:var(--accent-color);">${p.count.toLocaleString()}</td>
                    <td class="text-right">$${p.revenue.toLocaleString()}</td>
                    <td><div style="background:#333;width:100%;border-radius:4px;overflow:hidden;">
                        <div style="width:${rate === '-' ? '0%' : rate};background:var(--accent-color);height:6px;"></div>
                    </div> ${rate}</td>
                `;
                tbody.appendChild(tr);
                showCount += p.count;
                showRev   += p.revenue;
                showCap   += p.total;
            });

            // Show subtotal
            const subRate = mkSellRate(showCount, showCap);
            const subRow = document.createElement('tr');
            subRow.style.cssText = 'background:rgba(56,189,248,0.06); border-bottom:1px solid rgba(56,189,248,0.3);';
            subRow.innerHTML = `
                <td style="font-weight:600; color:#94a3b8; padding-left:20px;">小計</td>
                <td class="text-right" style="color:#94a3b8;">${showCap.toLocaleString()}</td>
                <td class="text-right" style="color:#666;">-</td>
                <td class="text-right" style="color:#666;">-</td>
                <td class="text-right" style="font-weight:600; color:var(--accent-color);">${showCount.toLocaleString()}</td>
                <td class="text-right" style="font-weight:600;">$${showRev.toLocaleString()}</td>
                <td style="color:var(--accent-color); font-weight:600;">${subRate}</td>
            `;
            tbody.appendChild(subRow);

            grandCount += showCount;
            grandRev   += showRev;
            grandCap   += showCap;
        });

        // Grand total row
        const grandRate = mkSellRate(grandCount, grandCap);
        const totalRow = document.createElement('tr');
        totalRow.style.backgroundColor = 'rgba(255,215,0,0.1)';
        totalRow.innerHTML = `
            <td style="font-weight:bold; color:var(--accent-color);">總計 (TOTAL)</td>
            <td class="text-right" style="font-weight:bold; color:#94a3b8;">${grandCap.toLocaleString()}</td>
            <td class="text-right" style="color:#666;">-</td>
            <td class="text-right" style="color:#666;">-</td>
            <td class="text-right" style="font-weight:bold; color:var(--accent-color); font-size:1.2em;">${grandCount.toLocaleString()}</td>
            <td class="text-right" style="font-weight:bold; color:var(--accent-color); font-size:1.2em;">$${grandRev.toLocaleString()}</td>
            <td style="font-weight:bold; color:var(--accent-color);">${grandRate}</td>
        `;
        tbody.appendChild(totalRow);

        // Payment Table
        const payBody = document.querySelector('#paymentTable tbody');
        const totalPay = paymentArray.reduce((acc, cur) => acc + cur.count, 0);
        paymentArray.forEach(p => {
            const tr = document.createElement('tr');
            const share = totalPay ? ((p.count / totalPay) * 100).toFixed(1) + '%' : '0%';
            tr.innerHTML = `
                <td>${p.method}</td>
                <td class="text-right">${p.count.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:${share}; background:#4DB6AC; height:6px;"></div>
                </div> ${share}</td>
            `;
            payBody.appendChild(tr);
        });
        const totalPayRow = document.createElement('tr');
        totalPayRow.style.backgroundColor = 'rgba(77,182,172,0.1)';
        totalPayRow.style.borderTop = '2px solid #4DB6AC';
        totalPayRow.innerHTML = `
            <td style="font-weight:bold; color:#4DB6AC;">總計 (TOTAL)</td>
            <td class="text-right" style="font-weight:bold; color:#4DB6AC;">${totalPay.toLocaleString()}</td>
            <td style="font-weight:bold; color:#4DB6AC;">100%</td>
        `;
        payBody.appendChild(totalPayRow);

        // Sales Point Analysis
        const salesPointStats = {};
        validOrders.forEach(o => {
            const point = o['銷售點'] || 'Unknown';
            const price = o['售價'] || 0;
            if(!salesPointStats[point]) salesPointStats[point] = { orders: new Set(), tickets: 0, revenue: 0 };
            const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : 'u';
            salesPointStats[point].orders.add(orderId);
            salesPointStats[point].tickets++;
            salesPointStats[point].revenue += price;
        });
        const salesPointArray = Object.keys(salesPointStats).map(k => ({
            point: k, orders: salesPointStats[k].orders.size,
            tickets: salesPointStats[k].tickets, revenue: salesPointStats[k].revenue
        })).sort((a,b) => b.revenue - a.revenue);
        const spTbody = document.querySelector('#salesPointTable tbody');
        salesPointArray.forEach(p => {
            const share = revenue ? ((p.revenue / revenue) * 100).toFixed(1) + '%' : '0%';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.point}</td>
                <td class="text-right">${p.orders.toLocaleString()}</td>
                <td class="text-right">${p.tickets.toLocaleString()}</td>
                <td class="text-right">$${p.revenue.toLocaleString()}</td>
                <td><div style="background:#333; width:100%; border-radius:4px; overflow:hidden;">
                    <div style="width:${share}; background:var(--accent-color); height:6px;"></div>
                </div> ${share}</td>
            `;
            spTbody.appendChild(tr);
        });
        const totalSpOrders  = salesPointArray.reduce((acc, cur) => acc + (cur.orders   || 0), 0);
        const totalSpTickets = salesPointArray.reduce((acc, cur) => acc + (cur.tickets  || 0), 0);
        const totalSpRev     = salesPointArray.reduce((acc, cur) => acc + (cur.revenue  || 0), 0);
        const totalSpRow = document.createElement('tr');
        totalSpRow.style.backgroundColor = 'rgba(255,215,0,0.1)';
        totalSpRow.innerHTML = `
            <td style="font-weight:bold; color:var(--accent-color);">總計 (TOTAL)</td>
            <td class="text-right" style="font-weight:bold;">${totalSpOrders.toLocaleString()}</td>
            <td class="text-right" style="font-weight:bold;">${totalSpTickets.toLocaleString()}</td>
            <td class="text-right" style="font-weight:bold; color:var(--accent-color); font-size:1.1em;">$${totalSpRev.toLocaleString()}</td>
            <td style="font-weight:bold; color:var(--accent-color);">100%</td>
        `;
        spTbody.appendChild(totalSpRow);

        // Peak Hour Analysis
        // 銷售率 = 累計張數 / 全部場次座位總數 (各場次容量各自計算後加總)
        const totalSeatCapacity = Object.values(capacityByShowAndPrice).reduce((acc, priceMap) => {
            return acc + Object.values(priceMap).reduce((s, c) => s + (c.total || 0), 0);
        }, 0);
        const totalValidTicketsForRate = totalSeatCapacity > 0 ? totalSeatCapacity : (tickets > 0 ? tickets : 1);

        // filterShow: '2026-05-30' or '2026-05-31' — only count tickets for that show
        function renderPeakTable(tableId, targetDate, startH, startM, endH, endM, filterShow) {
            const minuteStats = {};
            for(let h = startH; h <= endH; h++) {
                for(let m = 0; m < 60; m++) {
                    if(h === startH && m < startM) continue;
                    if(h === endH && m > endM) break;
                    const minStr = (h < 10 ? '0'+h : h) + ':' + (m < 10 ? '0'+m : m);
                    minuteStats[minStr] = {
                        bookings: new Set(), tickets: 0, creditTickets: 0, atmTickets: 0,
                        activeDMin: 0, activeAMin: 0, sessionCount: 0
                    };
                }
            }
            const targetDateNoHyphen = targetDate.replace(/-/g, '');

            // Capacity for this show only
            const showCap = Object.values((capacityByShowAndPrice[filterShow] || {}))
                                  .reduce((acc, c) => acc + (c.total || 0), 0) || 1;

            // All bookings (including refunds) for booking count
            dbData.forEach(o => {
                if(!o['交易時間']) return;
                const parts = o['交易時間'].split(' ');
                if(parts[0] !== targetDate) return;
                // Only count bookings for this show
                if(filterShow && (o['演出時間/規格'] || '').substring(0,10) !== filterShow) return;
                const hm = parts[1] ? parts[1].substring(0, 5) : null;
                if(hm && minuteStats[hm]) {
                    const orderId = o['訂單編號'] ? o['訂單編號'].split('_')[0] : Math.random().toString();
                    minuteStats[hm].bookings.add(orderId);
                }
            });

            // Valid orders — filtered to this show only
            validOrders.forEach(o => {
                if(!o['交易時間']) return;
                const parts = o['交易時間'].split(' ');
                if(parts[0] !== targetDate) return;
                if(filterShow && (o['演出時間/規格'] || '').substring(0,10) !== filterShow) return;
                const hm = parts[1] ? parts[1].substring(0, 5) : null;
                if(hm && minuteStats[hm]) {
                    const method = o['付款方式'] || '';
                    minuteStats[hm].tickets += 1;
                    if(method.includes('信用卡') || method.includes('Credit')) {
                        minuteStats[hm].creditTickets += 1;
                    } else if (method.includes('ATM')) {
                        minuteStats[hm].atmTickets += 1;
                    }
                }
            });

            // GA sessions (shared between shows — not filtered by show)
            gaSessions.forEach(s => {
                const sd = String(s.SessionDate || '');
                if (sd !== targetDateNoHyphen) return;
                const st = String(s.SessionTime || '');
                if (st.length >= 4) {
                    const hm = st.slice(0,2) + ':' + st.slice(2,4);
                    if (minuteStats[hm]) {
                        minuteStats[hm].sessionCount = Math.max(minuteStats[hm].sessionCount, s.SessionCount || 0);
                    }
                }
            });

            // GA Reads (shared — not filtered by show)
            gaReads.forEach(r => {
                if (!r.GADate || r.GADate !== targetDate) return;
                const timeStr = String(r.GATime || '');
                const hm = timeStr.substring(0, 5);
                if (minuteStats[hm]) {
                    const d = r.ActiveUsersDMinCount === 'NULL' ? 0 : Number(r.ActiveUsersDMinCount || 0);
                    const a = r.ActiveUsersAMinCount === 'NULL' ? 0 : Number(r.ActiveUsersAMinCount || 0);
                    minuteStats[hm].activeDMin  = Math.max(minuteStats[hm].activeDMin,  d);
                    minuteStats[hm].activeAMin  = Math.max(minuteStats[hm].activeAMin,  a);
                }
            });

            const minBody = document.querySelector('#' + tableId + ' tbody');
            let cumB = 0, cumT = 0, cumC = 0, cumA = 0;

            Object.keys(minuteStats).sort().forEach(hm => {
                const stat = minuteStats[hm];
                const b = stat.bookings.size;
                const t = stat.tickets;
                const c = stat.creditTickets;
                const a = stat.atmTickets;
                cumB += b; cumT += t; cumC += c; cumA += a;
                const rate = Math.round(cumT / showCap * 100) + '%';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-align:center; border-bottom:1px solid #444; border-right:1px solid #444; color:var(--text-primary);">${hm}</td>
                    <td style="text-align:right; border-bottom:1px solid #444; border-right:1px solid #444; color:#f59e0b; font-weight:600;">${stat.activeDMin.toLocaleString()}</td>
                    <td style="text-align:right; border-bottom:1px solid #444; border-right:1px solid #444; color:#10b981; font-weight:600;">${stat.activeAMin.toLocaleString()}</td>
                    <td style="text-align:right; border-bottom:1px solid #444; border-right:1px solid #444; color:#3b82f6; font-weight:600;">${stat.sessionCount.toLocaleString()}</td>
                    <td style="text-align:right; border-bottom:1px solid #444; border-right:1px solid #444; color:var(--text-primary);">${b.toLocaleString()}</td>
                    <td style="text-align:right; border-bottom:1px solid #444; border-right:1px solid #444; color:var(--text-primary); font-weight:600;">${cumB.toLocaleString()}</td>
                    <td style="text-align:right; border-bottom:1px solid #444; border-right:1px solid #444; color:var(--success);">${t.toLocaleString()}</td>
                    <td style="text-align:right; border-bottom:1px solid #444; border-right:1px solid #444; color:var(--success); font-weight:600;">${cumT.toLocaleString()}</td>
                    <td style="text-align:right; border-bottom:1px solid #444; border-right:1px solid #444; color:var(--text-primary);">${c.toLocaleString()}</td>
                    <td style="text-align:right; border-bottom:1px solid #444; border-right:1px solid #444; color:var(--text-primary); font-weight:600;">${cumC.toLocaleString()}</td>
                    <td style="text-align:right; border-bottom:1px solid #444; border-right:1px solid #444; color:var(--text-primary);">${a.toLocaleString()}</td>
                    <td style="text-align:right; border-bottom:1px solid #444; border-right:1px solid #444; color:var(--text-primary); font-weight:600;">${cumA.toLocaleString()}</td>
                    <td style="text-align:center; border-bottom:1px solid #444; color:#ffd700; font-weight:600;">${rate}</td>
                `;
                minBody.appendChild(tr);
            });
            // Hide container if no tickets were sold during this peak period for this show
            if (cumT === 0) {
                const container = document.querySelector('#' + tableId).closest('.chart-card');
                if (container) container.style.display = 'none';
            }
        }

        renderPeakTable('minuteTable1_530', '2026-03-14', 10, 50, 11, 30, '2026-05-30');
        renderPeakTable('minuteTable1_531', '2026-03-14', 10, 50, 11, 30, '2026-05-31');
        renderPeakTable('minuteTable2_530', '2026-03-21', 10, 50, 11, 30, '2026-05-30');
        renderPeakTable('minuteTable2_531', '2026-03-21', 10, 50, 11, 30, '2026-05-31');

        // Traffic Analysis
        const trafficContainer = document.getElementById('trafficAnalysisContainer');
        if (trafficContainer) {
            const totalViews = Object.values(viewsByDate).reduce((acc, val) => acc + val, 0);
            let peakDate = '', peakViews = 0;
            for (const [date, views] of Object.entries(viewsByDate)) {
                if (views > peakViews) { peakViews = views; peakDate = date; }
            }
            const totalTicketsSold = Object.values(salesByDate).reduce((acc, val) => acc + val, 0);
            const conversionRate = totalViews > 0 ? ((totalTicketsSold / totalViews) * 100).toFixed(2) : 0;
            const peakConcentration = totalViews > 0 ? ((peakViews / totalViews) * 100).toFixed(1) : 0;

            if (totalViews > 0) {
                trafficContainer.innerHTML = `
                    <p style="color:#ddd; font-size:1.1em; margin-bottom:20px;">本專案 gaSessions 數據顯示總計 <strong style="color:var(--text-primary); font-size:1.3em;">${totalViews.toLocaleString()}</strong> 次連線，整體轉換率 (銷售張數/總連線數) 為 <strong style="color:var(--accent-color); font-size:1.3em;">${conversionRate}%</strong>。</p>
                    <ul style="list-style:none; padding-left:0;">
                        <li style="margin-bottom:20px; display:flex; align-items:flex-start; gap:10px;">
                            <span style="color:#42A5F5; font-size:1.2em;">&#9679;</span>
                            <div>
                                <strong style="color:#eee;">開賣首日流量極度爆炸</strong><br>
                                <span style="color:#aaa;">最高連線量出現在 <span style="background-color:#42A5F5; color:white; border-radius:20px; padding:2px 8px;">${peakDate}</span>，單日湧入 <strong style="color:#42A5F5;">${peakViews.toLocaleString()}</strong> 次連線。</span><br>
                                <span style="color:#aaa;">開賣首日貢獻了全活動總連線的 <strong style="color:#42A5F5;">${peakConcentration}%</strong>，顯示品牌影響力驚人。</span>
                            </div>
                        </li>
                        <li style="margin-bottom:20px; display:flex; align-items:flex-start; gap:10px;">
                            <span style="color:#42A5F5; font-size:1.2em;">&#9679;</span>
                            <div>
                                <strong style="color:#eee;">轉換效能卓越 (High Conversion Performance)</strong><br>
                                <span style="color:#aaa;">在極短的尖峰時間內完成 <strong>${totalTicketsSold.toLocaleString()}</strong> 張票券銷售。</span><br>
                                <span style="color:#aaa;">此轉換率在大型演唱會開賣中表現極為強勁。</span>
                            </div>
                        </li>
                        <li style="margin-bottom:20px; display:flex; align-items:flex-start; gap:10px;">
                            <span style="color:#42A5F5; font-size:1.2em;">&#9679;</span>
                            <div>
                                <strong style="color:#eee;">長尾效應與行銷價值</strong><br>
                                <span style="color:#aaa;">&#128161; <strong>深度洞察</strong>：大量連線數據為品牌累積了 <strong>高價值訪客樣貌 (Audience Profile)</strong>。</span><br>
                                <span style="color:#aaa;">建議後續針對這些未購票訪客進行加場或未來活動的精準再行銷 (Retargeting)。</span>
                            </div>
                        </li>
                    </ul>
                `;
            } else {
                trafficContainer.innerHTML = '<p>尚無流量資料。</p>';
            }
        }

        // AOV Analysis
        const aovContainer = document.getElementById('aovAnalysisContainer');
        if (aovContainer) {
            const sortedPrices = [...sectionArray].sort((a,b) => b.count - a.count);
            const top3 = sortedPrices.slice(0, 3);
            const ordersMap = {};
            validOrders.forEach(o => {
                const id = o['訂單編號'] ? o['訂單編號'].split('_')[0] : Math.random();
                ordersMap[id] = (ordersMap[id] || 0) + 1;
            });
            const orderCounts = {};
            Object.values(ordersMap).forEach(c => { orderCounts[c] = (orderCounts[c] || 0) + 1; });
            const twoTicketsCount = orderCounts[2] || 0;
            const oneTicketCount  = orderCounts[1] || 0;
            const topPriceHtml = top3.map(p => `<span style="background:var(--accent-color); color:#000; border-radius:20px; padding:2px 8px; font-size:0.9em;">${p.name}</span> (${p.count.toLocaleString()}張)`).join('、');
            aovContainer.innerHTML = `
                <h3 style="color:var(--accent-color); border-bottom:1px solid #444; padding-bottom:10px; margin-bottom:15px;">&#128202; 客單價深度分析 (AOV Deep Dive)</h3>
                <div style="padding:10px; line-height:1.8; color:#ddd;">
                    <p>本專案平均客單價 (AOV) 高達 <strong style="color:var(--accent-color); font-size:1.4em;">$${aov.toLocaleString()}</strong>，主要原因分析如下：</p>
                    <ul style="list-style:none; padding-left:0;">
                        <li style="margin-bottom:15px; display:flex; align-items:flex-start; gap:10px;">
                            <span style="color:var(--accent-color); font-size:1.2em;">&#9679;</span>
                            <div>
                                <strong>高單價票券為銷售主力</strong><br>
                                <span style="color:#aaa;">熱銷票價依序為 ${topPriceHtml}。</span><br>
                                <span style="color:#aaa;">絕大多數售出的票券單價高昂，有效推升了整體 AOV。</span>
                            </div>
                        </li>
                        <li style="margin-bottom:15px; display:flex; align-items:flex-start; gap:10px;">
                            <span style="color:var(--accent-color); font-size:1.2em;">&#9679;</span>
                            <div>
                                <strong>單筆訂單購買多張票</strong><br>
                                <span style="color:#aaa;">購買 <strong style="color:var(--text-primary);">2張</strong> 的訂單量 (${twoTicketsCount.toLocaleString()}筆) ${twoTicketsCount >= oneTicketCount ? '超越了' : '與'} 只購買 1張 的訂單量 (${oneTicketCount.toLocaleString()}筆)${twoTicketsCount >= oneTicketCount ? '之表現' : '不相上下'}。</span><br>
                                <span style="color:#aaa;">眾多用戶傾向一次購買多張票券，大幅拉升了單筆訂單價值。</span>
                            </div>
                        </li>
                    </ul>
                    <p style="font-size:0.9em; color:#777; font-style:italic; margin-top:10px;">* 此外，部分大宗訂單 (單筆10張以上) 也對拉高平均值有顯著貢獻。</p>
                </div>
            `;
        }
    }

    init();
</script>


<!-- Fixed PDF Button -->
<button onclick="downloadPDF()" style="
    position: fixed;
    bottom: 90px;
    right: 30px;
    background: linear-gradient(135deg, #1e88e5, #1565c0);
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(30, 136, 229, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    z-index: 1000;
" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 20px rgba(30, 136, 229, 0.5)';"
   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(30, 136, 229, 0.4)';">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
    下載 PDF
</button>

<script>
    function downloadPDF() {
        window.print();
    }
</script>


<!-- Fixed Home Button -->
<a href="report_index.html" style="
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: linear-gradient(135deg, #ffd700, #bf953f);
    color: #121212;
    padding: 12px 24px;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    z-index: 1000;
" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 20px rgba(255, 215, 0, 0.5)';"
   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(255, 215, 0, 0.4)';">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
    </svg>
    回首頁
</a>

</body>
</html>
"""

new_lines.append(new_js)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Done. Total lines written: {len(new_lines)}")
