const fs = require('fs');
let code = fs.readFileSync('generate_a_daily_report.js', 'utf-8');

const eventStatsLogic = `        // Top 5 events by revenue
        const eventStats = {};
        const eventSessions = {}; // Store dates for session analysis
        validOrders.forEach(item => {
            const name = item['節目/商品名稱'] || 'Unknown';
            const price = parsePrice(item['售價']);
            const orderId = item['訂單編號'] ? item['訂單編號'].split('_')[0] : 'unknown';
            if (!eventStats[name]) eventStats[name] = { orders: new Set(), tickets: 0, revenue: 0 };
            eventStats[name].orders.add(orderId);
            eventStats[name].tickets += 1;
            eventStats[name].revenue += price;

            // Session tracking
            if (!eventSessions[name]) eventSessions[name] = {};
            if (item['場次名稱']) {
               const sName = item['場次名稱'];
               if (!eventSessions[name][sName]) eventSessions[name][sName] = { orders: new Set(), tickets: 0, revenue: 0 };
               eventSessions[name][sName].orders.add(orderId);
               eventSessions[name][sName].tickets += 1;
               eventSessions[name][sName].revenue += price;
            }
        });
        const topByRevenue = Object.entries(eventStats)
            .map(([name, s]) => {
                let sessions = [];
                if (eventSessions[name] && Object.keys(eventSessions[name]).length > 0) {
                    sessions = Object.entries(eventSessions[name])
                        .map(([sName, ss]) => ({ name: sName, orders: ss.orders.size, tickets: ss.tickets, revenue: ss.revenue, shareName: s.revenue ? (ss.revenue / s.revenue * 100).toFixed(1) : '0' }))
                        .sort((a,b) => b.revenue - a.revenue);
                }
                return { name, orders: s.orders.size, tickets: s.tickets, revenue: s.revenue, share: totalRevenue ? (s.revenue / totalRevenue * 100).toFixed(1) : '0', sessions };
            })
            .sort((a, b) => b.revenue - a.revenue).slice(0, 5);`;

code = code.replace(/\/\/ Top 5 events by revenue[\s\S]*?\.sort\(\(a, b\) => b\.revenue - a\.revenue\)\.slice\(0, 5\);/, eventStatsLogic);


const htmlTableRender = `    <div class="table-container">
        <h3 style="color: var(--text-secondary); border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">🏆 銷售排行 Top 5 (By Revenue)</h3>
        <table id="topEventsTable"><thead><tr>
            <th style="width:50px;">Rank</th><th>節目名稱</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">佔比</th>
        </tr></thead><tbody></tbody></table>
        <div id="eventDetailModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:2000; justify-content:center; align-items:center;">
           <div style="background:white; margin:auto; margin-top:5%; padding:20px; border-radius:12px; max-width:800px; width:90%; max-height:80vh; overflow-y:auto; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
               <span onclick="document.getElementById('eventDetailModal').style.display='none'" style="position:absolute; right:20px; top:20px; font-size:24px; cursor:pointer; color:#888;">&times;</span>
               <h2 id="modalTitle" style="color:var(--text-primary); margin-top:0; border-bottom:2px solid var(--accent-color); padding-bottom:10px; font-size:1.2rem;">場次分析</h2>
               <table style="width:100%; margin-top:15px;">
                   <thead><tr><th style="text-align:left;">場次名稱</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">佔該節目比例</th></tr></thead>
                   <tbody id="modalBody"></tbody>
               </table>
           </div>
        </div>
    </div>`;

const searchTableCode = `<div class="table-container">
        <h3 style="color: var(--text-secondary); border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">🏆 銷售排行 Top 5 (By Revenue)</h3>
        <table id="topEventsTable"><thead><tr>
            <th style="width:50px;">Rank</th><th>節目名稱</th><th class="text-right">筆數</th><th class="text-right">張數</th><th class="text-right">金額</th><th class="text-right">佔比</th>
        </tr></thead><tbody></tbody></table>
    </div>`;

code = code.replace(searchTableCode, htmlTableRender);


const renderRankTableLogic = `function renderRankTable(sel, items, fields, color) {
    const tb = document.querySelector(sel+' tbody');
    if (!items.length) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;">無資料</td></tr>'; return; }
    items.forEach((ev,i) => {
        const tr = document.createElement('tr');
        let html = '<td><span style="background:'+color+'; color:white; border-radius:50%; width:24px; height:24px; display:inline-block; text-align:center; line-height:24px;">'+(i+1)+'</span></td>';
        
        let linkStyle = sel==='#topEventsTable' && ev.sessions && ev.sessions.length > 0 ? 'color:var(--accent-color); text-decoration:underline; cursor:pointer;' : 'color:inherit;';
        let onClickAttr = sel==='#topEventsTable' && ev.sessions && ev.sessions.length > 0 ? "onclick=\\"showEventDetail(" + i + ")\\"" : '';
        
        html += '<td><span style="'+linkStyle+'" '+onClickAttr+'>'+ev.name+'</span></td>';
        fields.forEach(f => {
            if (f==='revenue'||f==='amount') html += '<td class="text-right" style="color:'+color+'; font-weight:bold;">'+ntd(ev[f])+'</td>';
            else if (f==='share') html += '<td class="text-right" style="color:#888;">'+ev[f]+'%</td>';
            else html += '<td class="text-right">'+fmt(ev[f])+'</td>';
        });
        tr.innerHTML = html;
        tb.appendChild(tr);
    });
}

function showEventDetail(index) {
    const ev = D.topByRevenue[index];
    if(!ev || !ev.sessions) return;
    document.getElementById('modalTitle').innerText = '場次分析 - ' + ev.name;
    const mb = document.getElementById('modalBody');
    mb.innerHTML = '';
    ev.sessions.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = 
            '<td style="font-weight:500;">' + s.name + '</td>' +
            '<td class="text-right">' + fmt(s.orders) + '</td>' +
            '<td class="text-right">' + fmt(s.tickets) + '</td>' +
            '<td class="text-right" style="color:var(--accent-color); font-weight:bold;">' + ntd(s.revenue) + '</td>' +
            '<td class="text-right" style="color:#888;">' + s.shareName + '%</td>';
        mb.appendChild(tr);
    });
    document.getElementById('eventDetailModal').style.display = 'flex';
}`;

code = code.replace(/function renderRankTable[\s\S]*?\}\n/, renderRankTableLogic + '\n');

fs.writeFileSync('generate_a_daily_report.js', code);
console.log('Modified JS file successfully.');
