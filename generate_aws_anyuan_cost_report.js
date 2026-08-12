const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const FILE_PATTERN = /^安源資訊_售票網_正式環境_(\d{4})_(\d{2})\.xlsx$/;
const SUMMARY_SHEET = '總表';

const SUMMARY_LABELS = {
    serviceUSD: '服務合計USD',
    exchangeRate: '結算匯率',
    serviceNTD: '服務合計USD-->NTD',
    supportFeeRate: 'AWS Enterprise Support費率',
    supportFee: 'AWS Enterprise Support費用',
    afterSupportNTD: '服務合計(含AWS Enterprise Support)',
    discountRate: '優惠費率',
    discount: '優惠折扣',
    afterDiscountNTD: '服務合計(扣除優惠折扣)',
    opsFeeRate: '基本型維運服務費率',
    opsFee: '基本型維運服務費',
    finalNTD: '應繳總金額NTD(未稅)',
};

// 找出最新一份「安源資訊_售票網_正式環境_YYYY_MM.xlsx」帳單（檔名的年月排序即帳單涵蓋範圍，總表分頁本身已是全年累計）
function findLatestSourceFile() {
    const candidates = fs.readdirSync(__dirname)
        .filter(f => FILE_PATTERN.test(f))
        .sort();
    if (candidates.length === 0) {
        throw new Error('找不到符合「安源資訊_售票網_正式環境_YYYY_MM.xlsx」命名規則的來源檔案');
    }
    return candidates[candidates.length - 1];
}

function toNumber(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function parseSummarySheet(workbook) {
    const ws = workbook.Sheets[SUMMARY_SHEET];
    if (!ws) throw new Error(`找不到「${SUMMARY_SHEET}」分頁`);
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const header = data[0];
    const months = [];
    header.forEach((h, idx) => {
        const m = String(h).match(/^(\d{1,2})月/);
        if (m) months.push({ colIdx: idx, monthNum: parseInt(m[1], 10) });
    });

    const rows = {};
    Object.entries(SUMMARY_LABELS).forEach(([key, label]) => {
        const row = data.find(r => String(r[0]).trim() === label);
        if (!row) throw new Error(`總表缺少「${label}」列，請確認 Excel 格式未變動`);
        rows[key] = row;
    });

    return { data, months, rows };
}

// 逐一 AWS 服務（如 Amazon Elastic Compute Cloud／Amazon CloudWatch）的每月 USD 費用。
// 每個服務在「總表」佔兩列：值列（英文服務名 + 各月數字）+ 中文說明列（值欄位皆空，部分服務無中文說明）。
// 用「該列任一月份欄位為 number」判斷是不是值列，藉此跳過空白列與中文說明列，不依賴固定 row index。
function parseServiceRows(data, months, year) {
    const stopIdx = data.findIndex(r => String(r[0]).trim() === SUMMARY_LABELS.serviceUSD);
    if (stopIdx === -1) throw new Error(`總表缺少「${SUMMARY_LABELS.serviceUSD}」列，無法定位服務明細範圍`);

    const services = [];
    for (let i = 1; i < stopIdx; i++) {
        const row = data[i];
        const name = String(row[0]).trim();
        if (!name) continue;
        const hasNum = months.some(({ colIdx }) => typeof row[colIdx] === 'number');
        if (!hasNum) continue;

        const nextRow = data[i + 1];
        const zhName = nextRow ? String(nextRow[0]).trim() : '';

        const monthlyUSD = {};
        months.forEach(({ colIdx, monthNum }) => {
            const v = toNumber(row[colIdx]);
            if (v !== null) monthlyUSD[`${year}/${String(monthNum).padStart(2, '0')}`] = v;
        });

        services.push({ name, zhName, monthlyUSD });
    }
    return services;
}

// 服務要出現在排行/趨勢圖的門檻：任一月費用 >= MIN_SERVICE_USD 才顯示，濾掉 $0.001~$4 等級的雜訊服務（KMS/Lambda/Athena 等）
const MIN_SERVICE_USD = 5;

function buildServiceRanking(services, yearMonths) {
    return services
        .map(s => {
            const data = yearMonths.map(ym => s.monthlyUSD[ym] || 0);
            const latestUSD = data[data.length - 1] || 0;
            const ytdUSD = data.reduce((sum, v) => sum + v, 0);
            const maxUSD = Math.max(...data, 0);
            return { name: s.name, zhName: s.zhName, data, latestUSD, ytdUSD, maxUSD };
        })
        .filter(s => s.maxUSD >= MIN_SERVICE_USD)
        .sort((a, b) => b.latestUSD - a.latestUSD || b.ytdUSD - a.ytdUSD);
}

function buildMonthlyTrend(year, months, rows) {
    return months
        .filter(({ colIdx }) => toNumber(rows.finalNTD[colIdx]) !== null)
        .map(({ colIdx, monthNum }) => ({
            yearMonth: `${year}/${String(monthNum).padStart(2, '0')}`,
            serviceUSD: toNumber(rows.serviceUSD[colIdx]) || 0,
            exchangeRate: toNumber(rows.exchangeRate[colIdx]) || 0,
            serviceNTD: toNumber(rows.serviceNTD[colIdx]) || 0,
            supportFee: toNumber(rows.supportFee[colIdx]) || 0,
            discount: toNumber(rows.discount[colIdx]) || 0,
            opsFee: toNumber(rows.opsFee[colIdx]) || 0,
            finalNTD: toNumber(rows.finalNTD[colIdx]) || 0,
        }));
}

function generateReport() {
    const sourceFile = findLatestSourceFile();
    console.log(`讀取來源檔案：${sourceFile}`);
    const match = sourceFile.match(FILE_PATTERN);
    const year = match[1];

    const workbook = XLSX.readFile(path.join(__dirname, sourceFile));
    const { data, months, rows } = parseSummarySheet(workbook);
    const monthlyTrend = buildMonthlyTrend(year, months, rows);

    if (monthlyTrend.length === 0) {
        throw new Error('總表未解析出任何月份資料');
    }

    const latest = monthlyTrend[monthlyTrend.length - 1];
    const prev = monthlyTrend.length > 1 ? monthlyTrend[monthlyTrend.length - 2] : null;
    const ytdTotal = monthlyTrend.reduce((s, d) => s + d.finalNTD, 0);
    const avgMonthly = ytdTotal / monthlyTrend.length;
    const reportTime = new Date().toLocaleString('zh-TW');

    const yearMonths = monthlyTrend.map(d => d.yearMonth);
    const services = parseServiceRows(data, months, year);
    const serviceRanking = buildServiceRanking(services, yearMonths);

    // MoM 分析文字（沿用 Azure Cost Report 的紅漲/綠跌語意：費用上升=壞=紅，下降=好=綠）
    let momSection = '';
    if (prev) {
        const pct = (c, p) => p ? ((c - p) / p * 100).toFixed(1) : null;
        const item = (label, color, cVal, pVal) => {
            const p = pct(cVal, pVal);
            if (p === null) return '';
            const v = parseFloat(p);
            const clr = v >= 0 ? '#ef5350' : '#66BB6A';
            const arrow = v >= 0 ? '▲' : '▼';
            const diff = Math.abs(cVal - pVal).toLocaleString();
            return `<b style="color:${color};">${label}</b> <span style="color:${clr};">${arrow} ${Math.abs(v)}%</span>（${v >= 0 ? '+' : '-'}${diff}）　`;
        };
        const finalPct = parseFloat(pct(latest.finalNTD, prev.finalNTD));
        const finalClr = finalPct >= 0 ? '#ef5350' : '#66BB6A';
        const finalArrow = finalPct >= 0 ? '▲' : '▼';
        const finalDiff = Math.abs(latest.finalNTD - prev.finalNTD).toLocaleString();

        momSection = `<div style="margin-top:24px;">
        <h4 style="color:var(--accent-color);font-size:1rem;margin-bottom:10px;">最近月份趨勢分析 (MoM Analysis)</h4>
        <div style="background:#252525;border-radius:10px;padding:14px 18px;border-left:3px solid var(--accent-color);max-width:820px;line-height:1.9;font-size:0.92rem;">
            <div style="font-weight:700;margin-bottom:6px;color:var(--text-primary);">${latest.yearMonth} 較上月(${prev.yearMonth})</div>
            <div style="color:var(--text-secondary);">💰 <b style="color:var(--text-primary);">應繳總金額(未稅)：</b><span style="color:${finalClr};">${finalArrow} ${Math.abs(finalPct)}%</span>（${finalPct >= 0 ? '+' : '-'}${finalDiff}），達 NT$${latest.finalNTD.toLocaleString()}。</div>
            <div style="color:var(--text-secondary);">☁️ <b style="color:var(--text-primary);">AWS 原始服務費：</b>${item('USD', '#42A5F5', latest.serviceUSD, prev.serviceUSD)}${item('折台幣 NTD', '#42A5F5', latest.serviceNTD, prev.serviceNTD)}（結算匯率 ${latest.exchangeRate}）。</div>
        </div>
    </div>`;
    }

    // 服務成本排行：依「最新月」USD 費用排序（費用最大的服務優先），只列任一月費用 >= $${MIN_SERVICE_USD} 的服務
    const top3 = serviceRanking.slice(0, 3).map(s => s.zhName || s.name).join('、');
    const fmtUSD = v => v === 0 ? '<span style="color:#555;">—</span>' : '$' + v.toLocaleString(undefined, { maximumFractionDigits: 1 });
    // 月費用漲跌幅：cost 上升=壞=紅、下降=好=綠（與其他表格語意一致）；prev 為 0 時無法算百分比，改標「新增」；兩者皆 0 或無上月資料則不顯示
    const changeBadge = (cur, prev) => {
        if (prev === undefined || (prev === 0 && cur === 0)) return '';
        if (prev === 0) return '<br><span style="color:#ef5350;font-size:0.72em;font-weight:bold;">新增</span>';
        const diff = cur - prev;
        if (diff === 0) return '<br><span style="color:#666;font-size:0.72em;">- 0%</span>';
        const pct = Math.abs(diff / prev * 100).toFixed(0);
        const clr = diff > 0 ? '#ef5350' : '#66BB6A';
        const arrow = diff > 0 ? '▲' : '▼';
        return `<br><span style="color:${clr};font-size:0.72em;font-weight:bold;">${arrow} ${pct}%</span>`;
    };
    const serviceRankingRows = serviceRanking.map((s, i) => {
        return `<tr>
                        <td style="color:var(--text-secondary);">${i + 1}</td>
                        <td><b>${s.name}</b>${s.zhName ? `<br><span style="color:var(--text-secondary);font-size:0.85em;">${s.zhName}</span>` : ''}</td>
                        ${s.data.map((v, m) => `<td>${fmtUSD(v)}${changeBadge(v, m > 0 ? s.data[m - 1] : undefined)}</td>`).join('')}
                        <td style="font-weight:bold;color:var(--accent-color);">${fmtUSD(s.ytdUSD)}</td>
                    </tr>`;
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[25-A] 安源資訊 AWS 費用分析報表</title>
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
            --accent-color: #FF9900; /* AWS Orange */
            --accent-secondary: #42A5F5;
            --shadow: 0 8px 16px rgba(0,0,0,0.3);

            --color-final: #FF9900;
            --color-raw: #42A5F5;
            --color-discount: #66BB6A;
            --color-support: #AB47BC;
        }

        body {
            font-family: 'Outfit', 'Noto Sans TC', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            padding: 30px;
        }

        .container { max-width: 1400px; margin: 0 auto; }

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
            background: linear-gradient(135deg, #FF9900, #FFC466);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0;
            letter-spacing: -0.5px;
        }

        .logo-sub { font-size: 0.9rem; color: var(--accent-secondary); margin-top: 5px; font-weight: 600; }
        .meta { text-align: right; font-size: 0.9rem; color: var(--text-secondary); }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
        .card::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--accent-color); }
        .card.card-raw::before { background: var(--color-raw); }
        .card.card-discount::before { background: var(--color-discount); }
        .card:hover { transform: translateY(-3px); }

        .card h3 { margin: 0 0 10px 0; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); }
        .card .value { font-size: 1.7em; font-weight: 700; color: var(--text-primary); }
        .card .sub { font-size: 0.8em; color: #888; margin-top: 5px; }

        .main-content { display: grid; grid-template-columns: 1fr; gap: 25px; margin-bottom: 40px; }
        .chart-card { background: var(--card-bg); border-radius: 20px; padding: 25px; box-shadow: var(--shadow); position: relative; }
        .chart-card h3 { margin-top: 0; color: var(--text-primary); border-left: 4px solid var(--accent-color); padding-left: 10px; margin-bottom: 20px; }

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
            <div class="logo-text">AWS Cost Analytics</div>
            <div class="logo-sub">安源資訊 AWS 費用分析報表（售票網_正式環境）</div>
            <div style="margin-top:8px; color: #888; font-size: 0.85em; font-family: sans-serif; display: flex; align-items: center; gap: 5px;">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
                Data Source: 安源資訊 AWS 帳單 Excel（客戶端手動提供，AccountId 822996750037）
            </div>
        </div>
        <div class="meta">
            資料月份: ${monthlyTrend[0].yearMonth} ~ ${latest.yearMonth}<br>
            產生時間: ${reportTime}
        </div>
    </header>

    <div class="stats-grid">
        <div class="card">
            <h3>最新月應繳總金額(未稅) (${latest.yearMonth})</h3>
            <div class="value">NT$${latest.finalNTD.toLocaleString()}</div>
            <div class="sub">
                ${prev ? (() => {
                const diff = latest.finalNTD - prev.finalNTD;
                const pct = ((diff / (prev.finalNTD || 1)) * 100).toFixed(1);
                return diff >= 0
                    ? '<span style="color:#ef5350">▲ ' + pct + '% (相較上月)</span>'
                    : '<span style="color:#66BB6A">▼ ' + Math.abs(pct) + '% (相較上月)</span>';
            })() : '—'}
            </div>
        </div>
        <div class="card">
            <h3>年度累計應繳總金額(未稅)</h3>
            <div class="value">NT$${Math.round(ytdTotal).toLocaleString()}</div>
            <div class="sub">${monthlyTrend[0].yearMonth.slice(0, 4)} 年 1～${latest.yearMonth.slice(5)} 月，共 ${monthlyTrend.length} 個月</div>
        </div>
        <div class="card">
            <h3>月均費用</h3>
            <div class="value">NT$${Math.round(avgMonthly).toLocaleString()}</div>
            <div class="sub">年度累計 ÷ ${monthlyTrend.length} 個月</div>
        </div>
        <div class="card card-raw">
            <h3>最新月 AWS 原始服務費</h3>
            <div class="value" style="color:var(--color-raw);">$${latest.serviceUSD.toLocaleString()}</div>
            <div class="sub">結算匯率 ${latest.exchangeRate} → NT$${latest.serviceNTD.toLocaleString()}</div>
        </div>
        <div class="card card-discount">
            <h3>最新月優惠折扣</h3>
            <div class="value" style="color:var(--color-discount);">NT$${Math.abs(latest.discount).toLocaleString()}</div>
            <div class="sub">已從帳單中扣除</div>
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
            <h3>各服務月費用趨勢 (Monthly Trend by AWS Service)</h3>
            <div style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:16px;">當月(${latest.yearMonth})前三大成本來源：<b style="color:var(--accent-color);">${top3}</b>　<span style="color:#666;">（僅列任一月費用 ≥ $${MIN_SERVICE_USD} 的服務）</span></div>
            <div style="height: 420px; width: 100%;">
                <canvas id="serviceChart"></canvas>
            </div>
            <table style="margin-top:20px;">
                <thead>
                    <tr>
                        <th>排名</th>
                        <th>AWS 服務</th>
                        ${yearMonths.map(ym => `<th>${ym}</th>`).join('')}
                        <th>年度累計</th>
                    </tr>
                </thead>
                <tbody>
                    ${serviceRankingRows}
                </tbody>
            </table>
        </div>
    </div>

    <div class="main-content">
        <div class="chart-card full-width">
            <h3>每月費用明細 (Monthly Detail)</h3>
            <table>
                <thead>
                    <tr>
                        <th>月份</th>
                        <th>AWS 服務費(USD)</th>
                        <th>結算匯率</th>
                        <th>AWS 服務費(NTD)</th>
                        <th>Enterprise Support費</th>
                        <th>優惠折扣</th>
                        <th>維運服務費</th>
                        <th>應繳總金額NTD(未稅)</th>
                    </tr>
                </thead>
                <tbody>
                    ${[...monthlyTrend].reverse().map((d, i, arr) => {
        const p = arr[i + 1] || null;
        const change = p ? (() => {
            const diff = d.finalNTD - p.finalNTD;
            const pct = ((diff / (p.finalNTD || 1)) * 100).toFixed(1);
            return diff >= 0
                ? '<span style="color:#ef5350;font-size:0.9em;font-weight:bold;margin-left:5px;">▲ ' + pct + '%</span>'
                : '<span style="color:#66BB6A;font-size:0.9em;font-weight:bold;margin-left:5px;">▼ ' + Math.abs(pct) + '%</span>';
        })() : '';
        return `<tr>
                        <td style="font-weight:bold;font-size:1.1em;">${d.yearMonth}</td>
                        <td>$${d.serviceUSD.toLocaleString()}</td>
                        <td>${d.exchangeRate}</td>
                        <td>NT$${d.serviceNTD.toLocaleString()}</td>
                        <td style="color:var(--color-support);">NT$${d.supportFee.toLocaleString()}</td>
                        <td style="color:var(--color-discount);">-NT$${Math.abs(d.discount).toLocaleString()}</td>
                        <td>NT$${d.opsFee.toLocaleString()}</td>
                        <td><span style="font-size:1.2em;font-weight:bold;color:var(--accent-color);">NT$${d.finalNTD.toLocaleString()}</span>${change}</td>
                    </tr>`;
    }).join('')}
                </tbody>
                <tfoot style="border-top: 2px solid var(--accent-color);">
                    <tr style="background: rgba(255, 255, 255, 0.05);">
                        <td style="font-weight:bold;color:var(--accent-color);">區間總計</td>
                        <td style="font-weight:bold;">$${Math.round(monthlyTrend.reduce((s, d) => s + d.serviceUSD, 0)).toLocaleString()}</td>
                        <td>—</td>
                        <td style="font-weight:bold;">NT$${Math.round(monthlyTrend.reduce((s, d) => s + d.serviceNTD, 0)).toLocaleString()}</td>
                        <td style="font-weight:bold;color:var(--color-support);">NT$${Math.round(monthlyTrend.reduce((s, d) => s + d.supportFee, 0)).toLocaleString()}</td>
                        <td style="font-weight:bold;color:var(--color-discount);">-NT$${Math.round(Math.abs(monthlyTrend.reduce((s, d) => s + d.discount, 0))).toLocaleString()}</td>
                        <td style="font-weight:bold;">NT$${Math.round(monthlyTrend.reduce((s, d) => s + d.opsFee, 0)).toLocaleString()}</td>
                        <td style="font-size:1.3em;font-weight:bold;color:var(--color-final);">NT$${Math.round(ytdTotal).toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
            ${momSection}
        </div>
    </div>

</div>

<script>
    const monthlyTrend = ${JSON.stringify(monthlyTrend)};
    const serviceRanking = ${JSON.stringify(serviceRanking)};
    const serviceMonthLabels = ${JSON.stringify(yearMonths)};

    const labels = monthlyTrend.map(d => d.yearMonth);
    const finalData = monthlyTrend.map(d => d.finalNTD);
    const rawData = monthlyTrend.map(d => d.serviceNTD);

    // 各服務月費用趨勢：多線圖，一服務一線，用 HSL 依序旋轉色相產生可分辨的顏色（服務數量不固定，不寫死色票）
    function serviceColor(i, total) {
        const hue = Math.round((360 / Math.max(total, 1)) * i);
        return 'hsl(' + hue + ', 70%, 60%)';
    }
    new Chart(document.getElementById('serviceChart'), {
        type: 'line',
        data: {
            labels: serviceMonthLabels,
            datasets: serviceRanking.map((s, i) => {
                const color = serviceColor(i, serviceRanking.length);
                return {
                    label: s.zhName || s.name,
                    data: s.data,
                    borderColor: color,
                    backgroundColor: color,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    borderWidth: 2
                };
            })
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#ccc', boxWidth: 14, font: { size: 11 } } },
                tooltip: {
                    backgroundColor: 'rgba(20,20,20,0.9)', titleColor: '#e0e0e0', bodyColor: '#a0a0a0', borderColor: '#333', borderWidth: 1,
                    callbacks: { label: c => c.dataset.label + ': $' + c.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 1 }) }
                }
            },
            scales: {
                x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                y: { grid: { color: '#333' }, ticks: { color: '#888', callback: v => '$' + v.toLocaleString() } }
            }
        }
    });

    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '應繳總金額NTD(未稅)',
                    data: finalData,
                    borderColor: '#FF9900',
                    backgroundColor: 'rgba(255,153,0,0.12)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    borderWidth: 2.5
                },
                {
                    label: 'AWS 服務原始費用(NTD，折扣前)',
                    data: rawData,
                    borderColor: '#42A5F5',
                    backgroundColor: 'rgba(66,165,245,0.08)',
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    borderWidth: 2,
                    borderDash: [5, 4]
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
                    display: ctx => ctx.dataset.data[ctx.dataIndex] != null,
                    color: ctx => ctx.dataset.borderColor,
                    align: 'top',
                    offset: 6,
                    backgroundColor: 'rgba(18,18,18,0.88)',
                    borderRadius: 4,
                    padding: { top: 3, bottom: 3, left: 6, right: 6 },
                    font: { size: 10, weight: 'bold' },
                    formatter: v => 'NT$' + Math.round(v).toLocaleString()
                },
                tooltip: {
                    backgroundColor: 'rgba(20,20,20,0.9)', titleColor: '#e0e0e0', bodyColor: '#a0a0a0', borderColor: '#333', borderWidth: 1
                }
            },
            scales: {
                x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                y: { grid: { color: '#333' }, ticks: { color: '#888', callback: v => 'NT$' + (v >= 10000 ? (v / 10000) + '萬' : v) } }
            }
        }
    });
</script>

</body>
</html>
    `;

    const outPath = path.join(__dirname, 'AWS_Anyuan_Cost_Analysis_Report.html');
    fs.writeFileSync(outPath, htmlContent, 'utf8');
    console.log(`Report generated successfully at ${outPath}`);
    console.log(`最新月份：${latest.yearMonth}，應繳總金額(未稅)：NT$${latest.finalNTD.toLocaleString()}`);
}

generateReport();
