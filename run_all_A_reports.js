const { execSync } = require('child_process');
const path = require('path');

const scripts = [
    'generate_historical_reports.js',
    'generate_report_dec_2025_fixed.js',
    'generate_report_jan_2026.js',
    'generate_report_feb_2026.js',
    'generate_sam_lee_report.js',
    'generate_golden_disc_report.js',
    'generate_decajoins_report.js',
    'generate_ga_report.js',
    'generate_ga_events_report.js',
    'generate_feb_page_views.js',
    'generate_comparison_full.js',
    'analyze_member_data.js',
    'generate_azure_cost_report.js',
    'update_index_stats.js'
];

for (const s of scripts) {
    console.log("-----------------------------------------");
    console.log("Running " + s + "...");
    try {
        execSync("node " + s, { stdio: 'inherit', cwd: __dirname });
    } catch (e) {
        console.error("Failed to run " + s);
    }
}
console.log("All A system reports updated successfully.");
