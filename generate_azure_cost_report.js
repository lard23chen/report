require('dotenv').config({ path: __dirname + '/.env', quiet: true });
﻿const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function generateReport() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('AzureMonthlyCost');

        // Fetch all data sorted by YearMonth
        const allDocs = await collection.find({}).sort({ YearMonth: 1 }).toArray();

        // 距今一年內
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        const threshold = `${oneYearAgo.getFullYear()}/${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}`;

        const docs = allDocs.filter(d => d.YearMonth >= threshold);

        // Prepare chart data
        const labels = [];
        const costA = [];
        const costD = [];
        const costE = [];
        const costTotal = [];
        const costOther = [];

        docs.forEach(doc => {
            labels.push(doc.YearMonth);
            costA.push(doc.SystemA_Cost || 0);
            costD.push(doc.SystemD_Cost || 0);
            costE.push(doc.SystemE_Cost || 0);
            costTotal.push(doc.QWARE_Ticket_TotalCost || 0);

            // Calculate other costs
            const others = (doc.Common_Cost || 0);
            costOther.push(others);
        });

        // 取得最新一個月的資料作為 Highlight
        const latestDoc = docs.length > 0 ? docs[docs.length - 1] : null;
        const latestAllIndex = latestDoc ? allDocs.findIndex(d => d.YearMonth === latestDoc.YearMonth) : -1;
        const prevDoc = latestAllIndex > 0 ? allDocs[latestAllIndex - 1] : null;

        const reportTime = new Date().toLocaleString('zh-TW');

        // Build MoM analysis block (uses latestDoc & prevDoc already computed above)
        let momSection = '';
        if (latestDoc && prevDoc) {
            const pct = (c, p) => p ? ((c - p) / p * 100).toFixed(1) : null;
            const itemHtml = (label, color, cVal, pVal) => {
                const p = pct(cVal, pVal);
                if (p === null) return '';
                const v = parseFloat(p);
                const clr = v >= 0 ? '#ef5350' : '#66BB6A'; // cost: up=bad(red), down=good(green)
                const arrow = v >= 0 ? '▲' : '▼';
                const diff = Math.abs(cVal - pVal).toLocaleString();
                return `<b style="color:${color};">${label}</b> <span style="color:${clr};">${arrow} ${Math.abs(v)}%</span>（${v >= 0 ? '+' : '-'}${diff}）　`;
            };
            const totalPct = parseFloat(pct(latestDoc.QWARE_Ticket_TotalCost || 0, prevDoc.QWARE_Ticket_TotalCost || 0));
            const totalClr = totalPct >= 0 ? '#ef5350' : '#66BB6A';
            const totalArrow = totalPct >= 0 ? '▲' : '▼';
            const totalDiff = Math.abs((latestDoc.QWARE_Ticket_TotalCost || 0) - (prevDoc.QWARE_Ticket_TotalCost || 0)).toLocaleString();
            const huiwanRow = (prevDoc.SystemHuiwan_Cost !== undefined)
                ? itemHtml('會員', '#F06292', latestDoc.SystemHuiwan_Cost || 0, prevDoc.SystemHuiwan_Cost || 0)
                : '';

            // D系統平台費用比較（Azure→AWS，移轉分界 2025/11，同 §4.5 D系統 Azure vs AWS 費用比較圖）
            // Azure 期間起點對齊比較圖的資料範圍（2024/11 起），避免拉入更早期（2021~2024）規模完全不同的費用稀釋平均值
            // 用 allDocs（完整歷史）而非 docs（近12個月），避免 AWS 期間（隨時間拉長）被近12個月篩選截斷
            const migrationMonth = '2025/11';
            const dCompareStart = '2024/11';
            const azureDDocs = allDocs.filter(d => d.YearMonth >= dCompareStart && d.YearMonth < migrationMonth && d.SystemD_Cost != null);
            const awsDDocs = allDocs.filter(d => d.YearMonth >= migrationMonth && d.SystemD_Cost != null);
            let dPlatformRow = '';
            if (azureDDocs.length > 0 && awsDDocs.length > 0) {
                const azureAvg = azureDDocs.reduce((s, d) => s + (d.SystemD_Cost || 0), 0) / azureDDocs.length;
                const awsAvg = awsDDocs.reduce((s, d) => s + (d.SystemD_Cost || 0), 0) / awsDDocs.length;
                const platPct = ((awsAvg - azureAvg) / azureAvg * 100).toFixed(1);
                const platClr = parseFloat(platPct) >= 0 ? '#ef5350' : '#66BB6A';
                const platArrow = parseFloat(platPct) >= 0 ? '▲' : '▼';
                dPlatformRow = `<div style="color:var(--text-secondary);">🔄 <b style="color:var(--text-primary);">D系統平台（Azure→AWS）：</b>AWS 期間（${awsDDocs[0].YearMonth} 起，共 ${awsDDocs.length} 個月）月均 <b style="color:var(--color-d);">$${Math.round(awsAvg).toLocaleString()}</b>，較 Azure 期間（${azureDDocs[0].YearMonth}–${azureDDocs[azureDDocs.length - 1].YearMonth}）月均 $${Math.round(azureAvg).toLocaleString()} <span style="color:${platClr};">${platArrow} ${Math.abs(platPct)}%</span>。</div>`;
            }

            momSection = `<div style="margin-top:24px;">
        <h4 style="color:var(--accent-color);font-size:1rem;margin-bottom:10px;">最近月份趨勢分析 (MoM Analysis)</h4>
        <div style="background:#252525;border-radius:10px;padding:14px 18px;border-left:3px solid var(--accent-color);max-width:820px;line-height:1.9;font-size:0.92rem;">
            <div style="font-weight:700;margin-bottom:6px;color:var(--text-primary);">${latestDoc.YearMonth} 較上月(${prevDoc.YearMonth})</div>
            <div style="color:var(--text-secondary);">💰 <b style="color:var(--text-primary);">總費用：</b><span style="color:${totalClr};">${totalArrow} ${Math.abs(totalPct)}%</span>（${totalPct >= 0 ? '+' : '-'}${totalDiff}），達 $${(latestDoc.QWARE_Ticket_TotalCost || 0).toLocaleString()}。</div>
            <div style="color:var(--text-secondary);">🖥️ <b style="color:var(--text-primary);">各系統：</b>${itemHtml('A系統', 'var(--color-a)', latestDoc.SystemA_Cost || 0, prevDoc.SystemA_Cost || 0)}${itemHtml('D系統', 'var(--color-d)', latestDoc.SystemD_Cost || 0, prevDoc.SystemD_Cost || 0)}${itemHtml('E系統', 'var(--color-e)', latestDoc.SystemE_Cost || 0, prevDoc.SystemE_Cost || 0)}。</div>
            ${dPlatformRow}
            <div style="color:var(--text-secondary);">📦 <b style="color:var(--text-primary);">其他：</b>${itemHtml('共用', '#AB47BC', latestDoc.Common_Cost || 0, prevDoc.Common_Cost || 0)}${huiwanRow}。</div>
        </div>
    </div>`;
        }

        // 2026 機器等級統計 — 資料來源：機器監控排班表 (Google Sheets gid=1883089838)
        // 每次人工更新 Google Sheets 後請同步更新此陣列
        const monitoringStats2026 = [
            { month: '1月', total: 14, small: 7, medium: 1, large: 4, largeEvents: [
                { date: '01/19', name: '斯巴達台南三色周末', hasE: true },
                { date: '01/19', name: '斯巴達Kids小勇士賽', hasE: true },
                { date: '01/22', name: 'King＆Prince台北快閃店', hasE: true },
                { date: '01/23', name: 'Fujisaki Hikari簽名會', hasE: true }
            ]},
            { month: '2月', total: 27, small: 24, medium: 1, large: 2, largeEvents: [
                { date: '02/13', name: 'i-dle CITY of SENSE（一般票全面開賣）', hasE: true },
                { date: '02/23', name: 'i-dle CITY of SENSE（信用卡優先購）', hasE: true }
            ]},
            { month: '3月', total: 45, small: 25, medium: 14, large: 6, largeEvents: [
                { date: '03/06', name: 'i-dle CITY of SENSE（第二階段）', hasE: true },
                { date: '03/10', name: 'A.C.F 秋葉原動漫祭見面會', hasE: true },
                { date: '03/12', name: 'A.C.F Rollout 悸動祭', hasE: true },
                { date: '03/12', name: 'A.C.F Rollout 共鳴祭', hasE: true },
                { date: '03/12', name: 'A.C.F Rollout 傳奇祭', hasE: true },
                { date: '03/27', name: 'i-dle CITY of SENSE（加場全面開賣）', hasE: true }
            ]},
            { month: '4月', total: 36, small: 33, medium: 3, large: 0, largeEvents: [] },
            { month: '5月', total: 34, small: 23, medium: 8, large: 3, largeEvents: [
                { date: '05/13', name: '7-ELEVEN 高雄啤酒音樂節（中信卡優先購）', hasE: false },
                { date: '05/14', name: '7-ELEVEN 高雄啤酒音樂節', hasE: false },
                { date: '05/14', name: '角頭GATAO唱演會（員訓）', hasE: false }
            ]},
            { month: '6月', total: 36, small: 28, medium: 5, large: 3, largeEvents: [
                { date: '06/24', name: '《暗喻幻想》Metaphor 交響音樂會', hasE: false },
                { date: '06/24', name: '閻奕格 逃生出口巡迴演唱會（台北站）', hasE: false },
                { date: '06/24', name: '台灣精品中華職棒明星對抗賽', hasE: false }
            ]},
            { month: '7月', total: 24, small: 22, medium: 0, large: 2, largeEvents: [
                { date: '07/08', name: '《崩壞：星穹鐵道》歡愉信號—嗶波！', hasE: true },
                { date: '07/16', name: 'TOY STORY｜PEACEMINUSONE 臺北站', hasE: false }
            ]},
            { month: '8月', total: 3, small: 1, medium: 2, large: 0, largeEvents: [] }
        ];
        const monitoringTableRows = monitoringStats2026.map(m => {
            const notes = m.largeEvents.length > 0
                ? m.largeEvents.map(e => e.date + ' ' + e.name + (e.hasE ? '<span style="color:#66BB6A;font-weight:700;">(E)</span>' : '')).join('、')
                : '—';
            const largeColor = m.large > 0 ? '#ef5350' : 'var(--text-secondary)';
            const largeWeight = m.large > 0 ? '700' : '400';
            return '<tr>' +
                '<td>' + m.month + '</td>' +
                '<td style="text-align:center">' + m.total + '</td>' +
                '<td style="text-align:center">' + m.small + '</td>' +
                '<td style="text-align:center;color:#FBC02D;">' + m.medium + '</td>' +
                '<td style="text-align:center;color:' + largeColor + ';font-weight:' + largeWeight + '">' + m.large + '</td>' +
                '<td style="font-size:0.85em;line-height:1.8;">' + notes + '</td>' +
                '</tr>';
        }).join('');
        const monTotals = monitoringStats2026.reduce((a, m) => ({
            total: a.total + m.total, small: a.small + m.small,
            medium: a.medium + m.medium, large: a.large + m.large
        }), { total: 0, small: 0, medium: 0, large: 0 });
        const monitoringTableHtml =
            '<div class="main-content"><div class="chart-card full-width">' +
            '<h3 style="border-left-color:#50E6FF;">2026 機器等級統計 (Machine Level by Month)</h3>' +
            '<div style="font-size:0.82em;color:var(--text-secondary);margin-bottom:12px;">資料來源：機器監控排班表 (Google Sheets) ｜ 最後同步：' + reportTime + '</div>' +
            '<table><thead><tr>' +
            '<th>月份</th>' +
            '<th style="text-align:center">總場次</th>' +
            '<th style="text-align:center">機器-小</th>' +
            '<th style="text-align:center">機器-中</th>' +
            '<th style="text-align:center">機器-大</th>' +
            '<th>機器-大 節目備註</th>' +
            '</tr></thead>' +
            '<tbody>' + monitoringTableRows + '</tbody>' +
            '<tfoot><tr style="border-top:2px solid var(--accent-color);font-weight:700;">' +
            '<td>合計</td>' +
            '<td style="text-align:center">' + monTotals.total + '</td>' +
            '<td style="text-align:center">' + monTotals.small + '</td>' +
            '<td style="text-align:center;color:#FBC02D;">' + monTotals.medium + '</td>' +
            '<td style="text-align:center;color:#ef5350;">' + monTotals.large + '</td>' +
            '<td></td>' +
            '</tr></tfoot></table>' +
            '</div></div>';

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Azure 雲端費用分析報表</title>
    <!-- IP Allowlist: internal network only -->
    <style>html { visibility: hidden; }</style>
    <script>
        (function () {
            var ALLOWED = [
                '211.75.181.109', '211.75.181.110',
                '220.130.6.196',  '220.130.6.197',  '220.130.6.198',
                '220.130.134.238','220.130.134.239', '220.130.134.240',
                '133.149.194.24'
            ];
            function deny(ip) {
                document.documentElement.style.visibility = 'visible';
                document.body.style.cssText = 'margin:0;padding:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;';
                document.body.innerHTML =
                    '<div style="text-align:center;font-family:Outfit,sans-serif;padding:40px">' +
                    '<div style="font-size:5rem;margin-bottom:20px">🔒</div>' +
                    '<h1 style="color:#ef4444;font-size:2rem;margin:0 0 14px">存取被拒絕</h1>' +
                    '<p style="color:#94a3b8;margin:0 0 8px">您目前的 IP 位址：' +
                    '<code style="background:#1e293b;padding:2px 10px;border-radius:4px;color:#f472b6">' + ip + '</code></p>' +
                    '<p style="color:#64748b;font-size:0.88rem">此頁面僅限內部網路存取 &middot; Access restricted to internal network only</p>' +
                    '</div>';
            }
            var timer = setTimeout(function () { deny('timeout'); }, 6000);
            fetch('https://api.ipify.org?format=json')
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    clearTimeout(timer);
                    if (ALLOWED.indexOf(d.ip) !== -1) {
                        document.documentElement.style.visibility = 'visible';
                    } else {
                        deny(d.ip);
                    }
                })
                .catch(function () { clearTimeout(timer); deny('unknown'); });
        })();
    </script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #121212;
            --card-bg: #1e1e1e;
            --text-primary: #e0e0e0;
            --text-secondary: #a0a0a0;
            --accent-color: #0078D4; /* Azure Blue */
            --accent-secondary: #50E6FF;
            --shadow: 0 8px 16px rgba(0,0,0,0.3);
            
            --color-total: #FBC02D;
            --color-a: #FF7043;
            --color-d: #42A5F5;
            --color-e: #66BB6A;
            --color-other: #AB47BC;
        }

        body {
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            padding: 30px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        header {
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            background: linear-gradient(to right, #2c2c2c, #1e1e1e);
            padding: 30px;
            border-radius: 20px;
            box-shadow: var(--shadow);
            border-bottom: 2px solid var(--accent-color);
        }

        .logo-text {
            font-size: 2.2rem;
            font-weight: 800;
            background: linear-gradient(135deg, #0078D4, #50E6FF);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0;
            letter-spacing: -0.5px;
            text-transform: uppercase;
        }

        .logo-sub {
            font-size: 0.9rem;
            color: var(--accent-secondary);
            margin-top: 5px;
            font-weight: 600;
        }

        .meta {
            text-align: right;
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .card {
            background: var(--card-bg);
            border-radius: 16px;
            padding: 20px;
            box-shadow: var(--shadow);
            border: 1px solid #333;
            transition: transform 0.2s;
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 4px; height: 100%;
            background: var(--accent-color);
        }
        .card.card-a::before { background: var(--color-a); }
        .card.card-d::before { background: var(--color-d); }
        .card.card-e::before { background: var(--color-e); }
        .card.card-total::before { background: var(--color-total); }
        .card.card-huiwan::before { background: #F06292; }

        .card:hover { transform: translateY(-3px); }

        .card h3 { margin: 0 0 10px 0; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); }
        .card .value { font-size: 1.8em; font-weight: 700; color: var(--text-primary); }
        .card .sub { font-size: 0.8em; color: #888; margin-top: 5px; display: flex; justify-content: space-between; }

        .main-content {
            display: grid;
            grid-template-columns: 1fr;
            gap: 25px;
            margin-bottom: 40px;
        }
        
        @media(min-width: 1024px) {
            .main-content { grid-template-columns: 2fr 1fr; }
            .full-width { grid-column: 1 / -1; }
        }

        .chart-card {
            background: var(--card-bg);
            border-radius: 20px;
            padding: 25px;
            box-shadow: var(--shadow);
            position: relative;
        }

        .chart-card h3 {
            margin-top: 0;
            color: var(--text-primary);
            border-left: 4px solid var(--accent-color);
            padding-left: 10px;
            margin-bottom: 20px;
        }

        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9em; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #333; }
        th { color: var(--accent-color); font-weight: 600; text-transform: uppercase; }
        tr:hover { background-color: rgba(255, 255, 255, 0.02); }
        
        #goHomeBtn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #424242, #212121);
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.1);
            padding: 12px 24px;
            border-radius: 50px;
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
            z-index: 1000;
        }
        #goHomeBtn:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.6);
            border-color: rgba(255,255,255,0.2);
            background: linear-gradient(135deg, #4a4a4a, #2a2a2a);
        }
        .filter-container {
            background: var(--card-bg);
            padding: 15px 25px;
            border-radius: 12px;
            margin-bottom: 25px;
            display: flex;
            align-items: center;
            gap: 20px;
            box-shadow: var(--shadow);
            border: 1px solid #333;
        }
        .filter-container label {
            font-size: 0.9rem;
            color: var(--text-secondary);
            font-weight: 600;
        }
        .filter-container select {
            background: #2c2c2c;
            color: white;
            border: 1px solid #444;
            padding: 6px 12px;
            border-radius: 6px;
            font-family: 'Outfit', sans-serif;
            cursor: pointer;
        }
        .filter-container select:focus {
            outline: none;
            border-color: var(--accent-color);
        }
    </style>
</head>
<body>

<a href="report_index.html" id="goHomeBtn">
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
    </svg>
    回首頁
</a>

<div class="container">
    <header>
        <div>
            <div class="logo-text">Azure Cost Analytics</div>
            <div class="logo-sub">Azure 雲端費用分析報表</div>
            <!-- Data Source Header -->
            <div style="margin-top:8px; color: #888; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px;">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg> 
                Data Source: MongoDB (QwareAi / AzureMonthlyCost)
            </div>
        </div>
        <div class="meta">
            資料月份: <span id="rangeText"></span><br>
            產生時間: ${reportTime}
        </div>
    </header>

    <div class="main-content" style="margin-bottom:25px;">
        <div class="chart-card full-width" style="border-left:4px solid var(--color-d);">
            <h3 style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <span style="color:var(--color-d);">D 系統平台費用比較</span>
                <span style="font-size:0.7rem;font-weight:400;background:#252525;padding:4px 12px;border-radius:20px;color:#a0a0a0;">Azure → AWS 遷移分析 · 2024/11 起</span>
            </h3>
            <div style="display:flex;gap:20px;margin-bottom:14px;font-size:0.82rem;flex-wrap:wrap;align-items:center;">
                <span style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:24px;height:3px;background:#42A5F5;border-radius:2px;"></span> Azure D系統（2024/11 – 2025/10）</span>
                <span style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:24px;height:3px;background:#FF9800;border-radius:2px;"></span> AWS D系統（2025/11 起）</span>
                <span style="margin-left:auto;background:rgba(251,192,45,0.12);border:1px solid rgba(251,192,45,0.4);padding:3px 12px;border-radius:8px;color:#FBC02D;font-size:0.78rem;">⚡ 2025/11 正式移至 AWS</span>
            </div>
            <div style="height:400px;width:100%;">
                <canvas id="dSystemCompareChart"></canvas>
            </div>
        </div>
    </div>

    <div class="filter-container">
        <div>
            <label>開始月份 (From):</label>
            <select id="startMonthSelect"></select>
        </div>
        <div>
            <label>結束月份 (To):</label>
            <select id="endMonthSelect"></select>
        </div>
        <div style="margin-left: auto; color: #888; font-size: 0.85em;">
            * 篩選下方圖表與表格區間
        </div>
    </div>

    <div class="stats-grid">
        <div class="card card-total">
            <h3>最新月份總費用 (${latestDoc.YearMonth})</h3>
            <div class="value">$${(latestDoc.QWARE_Ticket_TotalCost || 0).toLocaleString()}</div>
            <div class="sub">
                ${prevDoc ? (() => {
                const diff = (latestDoc.QWARE_Ticket_TotalCost || 0) - (prevDoc.QWARE_Ticket_TotalCost || 0);
                const pct = ((diff / (prevDoc.QWARE_Ticket_TotalCost || 1)) * 100).toFixed(1);
                return diff >= 0 ?
                    '<span style="color:#ef5350">▲ ' + pct + '% (相較上月)</span>' :
                    '<span style="color:#66BB6A">▼ ' + Math.abs(pct) + '% (相較上月)</span>';
            })() : ''}
            </div>
        </div>
        <div class="card card-a">
            <h3>A系統費用</h3>
            <div class="value" style="color: var(--color-a);">$${(latestDoc.SystemA_Cost || 0).toLocaleString()}</div>
            <div class="sub">佔比: ${(((latestDoc.SystemA_Cost || 0) / (latestDoc.QWARE_Ticket_TotalCost || 1)) * 100).toFixed(1)}%</div>
        </div>
        <div class="card card-d">
            <h3>D系統費用</h3>
            <div class="value" style="color: var(--color-d);">$${(latestDoc.SystemD_Cost || 0).toLocaleString()}</div>
            <div class="sub">佔比: ${(((latestDoc.SystemD_Cost || 0) / (latestDoc.QWARE_Ticket_TotalCost || 1)) * 100).toFixed(1)}%</div>
        </div>
        <div class="card card-e">
            <h3>E系統費用</h3>
            <div class="value" style="color: var(--color-e);">$${(latestDoc.SystemE_Cost || 0).toLocaleString()}</div>
            <div class="sub">佔比: ${(((latestDoc.SystemE_Cost || 0) / (latestDoc.QWARE_Ticket_TotalCost || 1)) * 100).toFixed(1)}%</div>
        </div>
        <div class="card card-huiwan">
            <h3>會員系統費用</h3>
            <div class="value" style="color: #F06292;">$${(latestDoc.SystemHuiwan_Cost || 0).toLocaleString()}</div>
            <div class="sub">佔比: ${(((latestDoc.SystemHuiwan_Cost || 0) / (latestDoc.QWARE_Ticket_TotalCost || 1)) * 100).toFixed(1)}%</div>
        </div>
    </div>

    <div class="main-content">
        <div class="chart-card full-width">
            <h3>每月詳細數據 (Monthly Data)</h3>
            <table>
                <thead>
                    <tr>
                        <th>月份 (Month)</th>
                        <th>A系統</th>
                        <th>D系統</th>
                        <th>E系統</th>
                        <th>共用</th>
                        <th>會員</th>
                        <th>總費用 (Total)</th>
                    </tr>
                </thead>
                <tbody id="tableBody">
                    <!-- Data will be injected via JS -->
                </tbody>
                <tfoot id="tableFoot" style="border-top: 2px solid var(--accent-color);">
                    <!-- Total will be injected via JS -->
                </tfoot>
            </table>
            ${momSection}
        </div>
    </div>

    <div class="main-content">
        <div class="chart-card full-width">
            <h3>年度費用匯總 (Yearly Summary)</h3>
            <table>
                <thead>
                    <tr>
                        <th>年份 (Year)</th>
                        <th>月份數</th>
                        <th>A系統</th>
                        <th>D系統</th>
                        <th>E系統</th>
                        <th>共用</th>
                        <th>會員</th>
                        <th>年度總費用 (Total)</th>
                        <th>YoY 變化</th>
                    </tr>
                </thead>
                <tbody id="yearlyTableBody"></tbody>
                <tfoot id="yearlyTableFoot" style="border-top: 2px solid var(--accent-color);"></tfoot>
            </table>
        </div>
    </div>

    <div class="main-content">
        <div class="chart-card full-width">
            <h3>每月費用趨勢 (Monthly Cost Trend)</h3>
            <div style="height: 400px; width: 100%;">
                <canvas id="trendChart"></canvas>
            </div>
        </div>
    </div>

    <div class="main-content">
        <div class="chart-card full-width">
            <h3>系統費用堆疊圖 (Cost Breakdown)</h3>
            <div style="height: 400px; width: 100%;">
                <canvas id="stackedChart"></canvas>
            </div>
        </div>
    </div>

${monitoringTableHtml}

</div>

<script>
    const allData = ${JSON.stringify(allDocs)};

    // ── D系統 Azure vs AWS 比較圖 ─────────────────────────────────────────
    (function(){
        const MIGRATE='2025/11';
        const rows=allData.filter(d=>d.YearMonth>='2024/11');
        const labels=rows.map(d=>d.YearMonth);
        const migIdx=labels.indexOf(MIGRATE);
        const azureData=rows.map(d=>d.YearMonth<MIGRATE?(d.SystemD_Cost||0):null);
        const awsData=rows.map(d=>d.YearMonth>=MIGRATE?(d.SystemD_Cost||0):null);
        const fmtY=v=>v>=1000000?'+'+(v/1000000).toFixed(1)+'M':v>=1000?'+'+Math.round(v/1000)+'K':''+v;
        const migLinePlugin={
            id:'migLine',
            afterDraw(chart){
                if(migIdx<0)return;
                const{ctx,scales:{x,y}}=chart;
                const xPx=x.getPixelForValue(migIdx);
                ctx.save();
                ctx.beginPath();ctx.setLineDash([5,5]);
                ctx.strokeStyle='rgba(251,192,45,0.75)';ctx.lineWidth=2;
                ctx.moveTo(xPx,y.top);ctx.lineTo(xPx,y.bottom);ctx.stroke();
                ctx.setLineDash([]);
                const lbl='⚡ 移至 AWS';
                ctx.font='bold 11px Outfit,sans-serif';
                const tw=ctx.measureText(lbl).width;
                const bx=xPx-tw/2-8,by=y.top+6,bw=tw+16,bh=20;
                ctx.fillStyle='rgba(251,192,45,0.15)';
                ctx.beginPath();ctx.roundRect(bx,by,bw,bh,4);ctx.fill();
                ctx.strokeStyle='rgba(251,192,45,0.7)';ctx.lineWidth=1;ctx.stroke();
                ctx.fillStyle='#FBC02D';ctx.textAlign='center';
                ctx.fillText(lbl,xPx,by+14);
                ctx.restore();
            }
        };
        new Chart(document.getElementById('dSystemCompareChart'),{
            type:'line',
            data:{
                labels,
                datasets:[
                    {label:'Azure D系統',data:azureData,borderColor:'#42A5F5',backgroundColor:'rgba(66,165,245,0.08)',fill:true,borderWidth:2.5,pointRadius:4,pointHoverRadius:7,pointBackgroundColor:'#42A5F5',tension:0.3,spanGaps:false},
                    {label:'AWS D系統',data:awsData,borderColor:'#FF9800',backgroundColor:'rgba(255,152,0,0.08)',fill:true,borderWidth:2.5,pointRadius:4,pointHoverRadius:7,pointBackgroundColor:'#FF9800',tension:0.3,spanGaps:false}
                ]
            },
            options:{
                responsive:true,maintainAspectRatio:false,
                interaction:{mode:'index',intersect:false},
                plugins:{
                    legend:{labels:{color:'#e0e0e0',font:{family:'Outfit',size:13},boxWidth:20,boxHeight:3}},
                    datalabels:{
                        display: ctx => ctx.dataset.data[ctx.dataIndex] != null,
                        color: ctx => ctx.dataset.borderColor,
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        clamp: true,
                        backgroundColor: 'rgba(18,18,18,0.88)',
                        borderRadius: 4,
                        padding: { top: 3, bottom: 3, left: 6, right: 6 },
                        font: { size: 10, weight: 'bold', family: 'Outfit' },
                        formatter: v => v == null ? '' : '$' + Math.round(v).toLocaleString()
                    },
                    tooltip:{
                        backgroundColor:'rgba(20,20,20,0.9)',titleColor:'#e0e0e0',bodyColor:'#a0a0a0',borderColor:'#333',borderWidth:1,
                        callbacks:{label:c=>c.parsed.y!=null?\`\${c.dataset.label}: \${c.parsed.y.toLocaleString()}\`:null}
                    }
                },
                scales:{
                    x:{ticks:{color:'#a0a0a0',maxRotation:45,font:{size:11}},grid:{color:'rgba(255,255,255,0.04)'}},
                    y:{ticks:{color:'#a0a0a0',callback:fmtY,font:{size:11}},grid:{color:'rgba(255,255,255,0.04)'}}
                }
            },
            plugins:[migLinePlugin, ChartDataLabels]
        });
    })();

    let trendChart, stackedChart;
    const startSelect = document.getElementById('startMonthSelect');
    const endSelect = document.getElementById('endMonthSelect');
    const tableBody = document.getElementById('tableBody');
    const rangeText = document.getElementById('rangeText');

    function initFilters() {
        const months = allData.map(d => d.YearMonth);
        months.forEach(m => {
            const optStart = new Option(m, m);
            const optEnd = new Option(m, m);
            startSelect.add(optStart);
            endSelect.add(optEnd);
        });

        // Default: Last 12 months
        const defaultStartIndex = Math.max(0, allData.length - 12);
        startSelect.selectedIndex = defaultStartIndex;
        endSelect.selectedIndex = allData.length - 1;

        startSelect.addEventListener('change', updateView);
        endSelect.addEventListener('change', updateView);
    }

    function getOtherCost(d) {
        return (d.Common_Cost || 0);
    }

    function getChangeHTML(currVal, prevVal) {
        if (prevVal === undefined || prevVal === null) return '';
        const diff = currVal - prevVal;
        const pct = ((diff / (prevVal || 1)) * 100).toFixed(1);
        if (diff > 0) return '<span style="color: #ef5350; font-size: 0.9em; font-weight: bold; margin-left: 5px;">▲ ' + pct + '%</span>';
        if (diff < 0) return '<span style="color: #66BB6A; font-size: 0.9em; font-weight: bold; margin-left: 5px;">▼ ' + Math.abs(pct) + '%</span>';
        return '<span style="color: #888; font-size: 0.9em; font-weight: bold; margin-left: 5px;">- 0%</span>';
    }

    function updateView() {
        const start = startSelect.value;
        const end = endSelect.value;
        
        const filtered = allData.filter(d => d.YearMonth >= start && d.YearMonth <= end);
        const labels = filtered.map(d => d.YearMonth);
        
        // Update Meta
        document.getElementById('rangeText').textContent = labels[0] + ' ~ ' + labels[labels.length - 1];

        // Prepare Chart Data
        const costA = filtered.map(d => d.SystemA_Cost || 0);
        const costD = filtered.map(d => d.SystemD_Cost || 0);
        const costE = filtered.map(d => d.SystemE_Cost || 0);
        const costTotal = filtered.map(d => d.QWARE_Ticket_TotalCost || 0);
        const costOther = filtered.map(d => getOtherCost(d));

        // Update Charts
        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = costA;
        trendChart.data.datasets[1].data = costD;
        trendChart.data.datasets[2].data = costE;
        trendChart.update();

        stackedChart.data.labels = labels;
        stackedChart.data.datasets[0].data = costA;
        stackedChart.data.datasets[1].data = costD;
        stackedChart.data.datasets[2].data = costE;
        stackedChart.data.datasets[3].data = costOther;
        stackedChart.update();

        // Update Table
        let sumA = 0, sumD = 0, sumE = 0, sumOther = 0, sumHuiwan = 0, sumTotal = 0;

        tableBody.innerHTML = [...filtered].reverse().map(d => {
            const idx = allData.findIndex(a => a.YearMonth === d.YearMonth);
            const prev = idx > 0 ? allData[idx - 1] : null;
            const total = d.QWARE_Ticket_TotalCost || 0;
            const other = getOtherCost(d);
            const prevOther = prev ? getOtherCost(prev) : null;
            const huiwan = d.SystemHuiwan_Cost || 0;
            const prevHuiwan = (prev && prev.SystemHuiwan_Cost !== undefined) ? prev.SystemHuiwan_Cost : null;

            sumA += (d.SystemA_Cost || 0);
            sumD += (d.SystemD_Cost || 0);
            sumE += (d.SystemE_Cost || 0);
            sumOther += other;
            sumHuiwan += huiwan;
            sumTotal += total;

            return \`<tr>
                <td style="font-weight: bold; font-size: 1.1em;">\${d.YearMonth}</td>
                <td><span style="font-size: 1.1em; font-weight: bold;">\${(d.SystemA_Cost || 0).toLocaleString()}</span> \${getChangeHTML(d.SystemA_Cost, prev?.SystemA_Cost)}</td>
                <td><span style="font-size: 1.1em; font-weight: bold;">\${(d.SystemD_Cost || 0).toLocaleString()}</span> \${getChangeHTML(d.SystemD_Cost, prev?.SystemD_Cost)}</td>
                <td><span style="font-size: 1.1em; font-weight: bold;">\${(d.SystemE_Cost || 0).toLocaleString()}</span> \${getChangeHTML(d.SystemE_Cost, prev?.SystemE_Cost)}</td>
                <td><span style="font-size: 1.1em; font-weight: bold;">\${other.toLocaleString()}</span> \${getChangeHTML(other, prevOther)}</td>
                <td><span style="font-size: 1.1em; font-weight: bold; color: #F06292;">\${huiwan.toLocaleString()}</span> \${prevHuiwan !== null ? getChangeHTML(huiwan, prevHuiwan) : ''}</td>
                <td><span style="font-size: 1.3em; font-weight: bold; color: var(--accent-color);">\${total.toLocaleString()}</span> \${getChangeHTML(total, prev?.QWARE_Ticket_TotalCost)}</td>
            </tr>\`;
        }).join('');

        document.getElementById('tableFoot').innerHTML = \`<tr style="background: rgba(255, 255, 255, 0.05);">
            <td style="font-weight: bold; color: var(--accent-color); font-size: 1.1em;">區間總計 (Total)</td>
            <td style="font-weight: bold; font-size: 1.25em; color: #fff;">\${sumA.toLocaleString()}</td>
            <td style="font-weight: bold; font-size: 1.25em; color: #fff;">\${sumD.toLocaleString()}</td>
            <td style="font-weight: bold; font-size: 1.25em; color: #fff;">\${sumE.toLocaleString()}</td>
            <td style="font-weight: bold; font-size: 1.25em; color: #fff;">\${sumOther.toLocaleString()}</td>
            <td style="font-weight: bold; font-size: 1.25em; color: #F06292;">\${sumHuiwan.toLocaleString()}</td>
            <td style="font-weight: bold; font-size: 1.5em; color: var(--color-total);">\${sumTotal.toLocaleString()}</td>
        </tr>\`;
    }

    // 1. 每月總費用折線圖
    trendChart = new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'A系統',
                    data: [],
                    borderColor: '#FF7043',
                    backgroundColor: 'rgba(255, 112, 67, 0.1)',
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4,
                    borderWidth: 2
                },
                {
                    label: 'D系統',
                    data: [],
                    borderColor: '#42A5F5',
                    backgroundColor: 'rgba(66, 165, 245, 0.1)',
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4,
                    borderWidth: 2
                },
                {
                    label: 'E系統',
                    data: [],
                    borderColor: '#66BB6A',
                    backgroundColor: 'rgba(102, 187, 106, 0.1)',
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4,
                    borderWidth: 2
                }
            ]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#ccc' } },
                datalabels: {
                    color: '#fff',
                    align: 'top',
                    offset: 4,
                    font: { size: 10, weight: 'bold' },
                    formatter: (value) => {
                        return value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value;
                    }
                }
            },
            scales: {
                x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                y: { grid: { color: '#333' }, ticks: { color: '#888', callback: v => (v>=1000 ? (v/1000) + 'k' : v) } }
            }
        }
    });

    // 2. 系統費用堆疊長條圖
    stackedChart = new Chart(document.getElementById('stackedChart'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'A系統',
                    data: [],
                    backgroundColor: '#FF7043'
                },
                {
                    label: 'D系統',
                    data: [],
                    backgroundColor: '#42A5F5'
                },
                {
                    label: 'E系統',
                    data: [],
                    backgroundColor: '#66BB6A'
                },
                {
                    label: '其他費用',
                    data: [],
                    backgroundColor: '#AB47BC'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#ccc' } },
                datalabels: { display: false } // Disable datalabels for stacked to avoid clutter
            },
            scales: {
                x: { 
                    stacked: true,
                    grid: { color: '#333' }, 
                    ticks: { color: '#888' } 
                },
                y: { 
                    stacked: true,
                    grid: { color: '#333' }, 
                    ticks: { color: '#888', callback: v => (v>=1000 ? (v/1000) + 'k' : v) } 
                }
            }
        }
    });

    // Build yearly summary table
    function buildYearlyTable() {
        const yearMap = new Map();
        allData.forEach(d => {
            const year = d.YearMonth.slice(0, 4);
            if (!yearMap.has(year)) yearMap.set(year, { months: 0, a: 0, d: 0, e: 0, other: 0, huiwan: 0, total: 0 });
            const y = yearMap.get(year);
            y.months += 1;
            y.a += (d.SystemA_Cost || 0);
            y.d += (d.SystemD_Cost || 0);
            y.e += (d.SystemE_Cost || 0);
            y.other += getOtherCost(d);
            y.huiwan += (d.SystemHuiwan_Cost || 0);
            y.total += (d.QWARE_Ticket_TotalCost || 0);
        });

        const years = Array.from(yearMap.keys()).sort();
        let grandA = 0, grandD = 0, grandE = 0, grandOther = 0, grandHuiwan = 0, grandTotal = 0;

        document.getElementById('yearlyTableBody').innerHTML = [...years].reverse().map(year => {
            const cur = yearMap.get(year);
            const prevYear = String(Number(year) - 1);
            const prev = yearMap.get(prevYear);
            grandA += cur.a; grandD += cur.d; grandE += cur.e; grandOther += cur.other; grandHuiwan += cur.huiwan; grandTotal += cur.total;

            let yoyHtml = '';
            if (prev) {
                const diff = cur.total - prev.total;
                const pct = ((diff / (prev.total || 1)) * 100).toFixed(1);
                yoyHtml = diff >= 0
                    ? \`<span style="color:#ef5350;font-weight:bold;">▲ \${pct}%</span>\`
                    : \`<span style="color:#66BB6A;font-weight:bold;">▼ \${Math.abs(pct)}%</span>\`;
            } else {
                yoyHtml = '<span style="color:#888;">-</span>';
            }

            return \`<tr>
                <td style="font-weight:bold;font-size:1.2em;color:var(--accent-secondary);">\${year}</td>
                <td style="color:#888;">\${cur.months} 個月</td>
                <td style="color:var(--color-a);font-weight:bold;">\${Math.round(cur.a).toLocaleString()}</td>
                <td style="color:var(--color-d);font-weight:bold;">\${Math.round(cur.d).toLocaleString()}</td>
                <td style="color:var(--color-e);font-weight:bold;">\${Math.round(cur.e).toLocaleString()}</td>
                <td style="color:#AB47BC;font-weight:bold;">\${Math.round(cur.other).toLocaleString()}</td>
                <td style="color:#F06292;font-weight:bold;">\${Math.round(cur.huiwan).toLocaleString()}</td>
                <td style="font-size:1.3em;font-weight:bold;color:var(--color-total);">\${Math.round(cur.total).toLocaleString()}</td>
                <td>\${yoyHtml}</td>
            </tr>\`;
        }).join('');

        document.getElementById('yearlyTableFoot').innerHTML = \`<tr style="background:rgba(255,255,255,0.05);">
            <td style="font-weight:bold;color:var(--accent-color);font-size:1.1em;" colspan="2">全期總計</td>
            <td style="font-weight:bold;color:#fff;font-size:1.2em;">\${Math.round(grandA).toLocaleString()}</td>
            <td style="font-weight:bold;color:#fff;font-size:1.2em;">\${Math.round(grandD).toLocaleString()}</td>
            <td style="font-weight:bold;color:#fff;font-size:1.2em;">\${Math.round(grandE).toLocaleString()}</td>
            <td style="font-weight:bold;color:#fff;font-size:1.2em;">\${Math.round(grandOther).toLocaleString()}</td>
            <td style="font-weight:bold;color:#F06292;font-size:1.2em;">\${Math.round(grandHuiwan).toLocaleString()}</td>
            <td style="font-weight:bold;font-size:1.5em;color:var(--color-total);">\${Math.round(grandTotal).toLocaleString()}</td>
            <td></td>
        </tr>\`;
    }

    initFilters();
    updateView();
    buildYearlyTable();

</script>


</body>
</html>
        `;

        const outPath = path.join(__dirname, 'Azure_Cost_Analysis_Report.html');
        fs.writeFileSync(outPath, htmlContent, 'utf8');
        console.log(`Report generated successfully at ${outPath}`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

generateReport();
