/**
 * inject_ip_guard.js
 * Injects IP allowlist guard into catalog #1-25 HTML files and their generators.
 * Safe to re-run: skips files already containing the guard.
 */
const fs = require('fs');
const path = require('path');

const BASE = 'D:\\2025\\AI\\MongoDB';

const GUARD = `
    <!-- IP Allowlist: internal network only -->
    <style>html { visibility: hidden; }</style>
    <script>
        (function () {
            var ALLOWED = [
                '211.75.181.109', '211.75.181.110',
                '220.130.6.196',  '220.130.6.197',  '220.130.6.198',
                '220.130.134.238','220.130.134.239', '220.130.134.240'
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
    </script>`;

// Catalog items 1–25 HTML files + their corresponding generators (null = no generator / manual)
const TARGETS = [
    { html: 'report_index.html',                                       gen: null },
    { html: 'E_report_index.html',                                     gen: null },
    { html: 'A_Qware_Revenue_Report_Daily.html',                       gen: 'generate_a_daily_report.js' },
    { html: 'A_Qware_Revenue_Report_2026年03月_分析報表.html', gen: 'generate_report_mar_2026.js' },
    { html: 'A_Qware_Revenue_Report_2026年02月_分析報表.html', gen: 'generate_report_feb_2026.js' },
    { html: 'A_Qware_Revenue_Report_2026年01月_分析報表.html', gen: 'generate_report_jan_2026.js' },
    { html: 'A_Qware_Revenue_Report_2025年12月_分析報表.html', gen: 'generate_report_dec_2025_final.js' },
    { html: 'A_Qware_Sales_Refund_Comparison_2025-12_vs_2026-01.html', gen: 'generate_comparison_report.js' },
    { html: 'A_GoldenDisc_Report_2026-02-06.html',                     gen: 'generate_golden_disc_report.js' },
    { html: 'A_SamLee_Report_2025_Taipei.html',                        gen: 'generate_sam_lee_report.js' },
    { html: 'A_UniformLions_Order_Analysis_20260309.html',             gen: 'generate_lions_order_report.js' },
    { html: 'A_WeiBird_Report_2026.html',                              gen: 'generate_weibird_report.js' },
    { html: 'A_BeerFestival_Index.html',                               gen: null },
    { html: 'A_KaohsiungSakuraFestival_2025.html',                     gen: 'generate_kaohsiung_sakura_festival_2025_report.js' },
    { html: 'A_DecaJoins_Traffic_Analysis.html',                       gen: 'generate_deca_traffic_report.js' },
    { html: 'A_DMP_PageView_Report_AllTime_Top10.html',                gen: 'generate_alltime_top10_v3.js' },
    { html: 'A_GA_Traffic_Analysis_Report.html',                       gen: 'generate_ga_report.js' },
    { html: 'A_UniformLions_GA_Analysis_20260309.html',                gen: 'generate_lions_ga_report.js' },
    { html: 'A_GA_Events_Traffic_Report.html',                         gen: 'generate_ga_events_report.js' },
    { html: 'A_IP_Geo_Analysis_Report.html',                           gen: 'generate_ip_geo_report.js' },
    { html: 'A_IP_Geo_Analysis_Report_Historical.html',                gen: 'generate_ip_geo_report_historical.js' },
    { html: 'E_Qware_Revenue_Report_2026年04月_分析報表.html', gen: 'generate_e_report_apr_2026.js' },
    { html: 'E_Qware_Revenue_Report_2026年02月_分析報表.html', gen: 'generate_e_report_feb_2026.js' },
    { html: 'Azure_Cost_Analysis_Report.html',                         gen: 'generate_azure_cost_report.js' },
    { html: 'daily_expense_report.html',                               gen: 'generate_expense_report.js' },
];

function inject(filepath, label) {
    if (!fs.existsSync(filepath)) {
        console.log(`  SKIP (not found)   : ${label}`);
        return false;
    }
    let content = fs.readFileSync(filepath, 'utf8');
    if (content.includes('api.ipify.org')) {
        console.log(`  SKIP (already has) : ${label}`);
        return false;
    }
    const idx = content.indexOf('</title>');
    if (idx === -1) {
        console.log(`  SKIP (no </title>) : ${label}`);
        return false;
    }
    content = content.slice(0, idx + '</title>'.length) + GUARD + content.slice(idx + '</title>'.length);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`  OK                 : ${label}`);
    return true;
}

let modified = 0;
TARGETS.forEach(({ html, gen }) => {
    console.log(`\n[${html}]`);
    if (inject(path.join(BASE, html), html)) modified++;
    if (gen) {
        if (inject(path.join(BASE, gen), gen)) modified++;
    }
});

console.log(`\n===== Done: ${modified} files modified =====`);
