const fs = require('fs');

let content = fs.readFileSync('generate_jan_page_views.js', 'utf8');

function generate(monthObj) {
    let replaced = content
        .replace(/"2025-12-31T16:00:00\.000Z"/g, `"${monthObj.startUtc}"`)
        .replace(/2026-01-01 00:00/g, monthObj.startTw)
        .replace(/"2026-01-31T16:00:00\.000Z"/g, `"${monthObj.endUtc}"`)
        .replace(/2026-02-01 00:00/g, monthObj.endTw)
        .replace(/dmp_details_jan/g, `dmp_details_${monthObj.short}`)
        .replace(/"2026-01-01T00:00:00\.000Z"/g, `"${monthObj.loopStart}"`)
        .replace(/"2026-01-31T00:00:00\.000Z"/g, `"${monthObj.loopEnd}"`)
        .replace(/Jan_Detail_/g, `${monthObj.capShort}_Detail_`)
        .replace(/2026年01月/g, `2025年${monthObj.num}月`)
        .replace(/2026-01\.csv/g, `2025-${monthObj.num}.csv`)
        .replace(/2026-01\.html/g, `2025-${monthObj.num}.html`)
        .replace(/DMP 1月份/g, `DMP ${parseInt(monthObj.num)}月份`)
        .replace(/2026-01/g, `2025-${monthObj.num}`);
        
    fs.writeFileSync(`generate_${monthObj.short}_page_views.js`, replaced);
    console.log(`Generated generate_${monthObj.short}_page_views.js`);
}

// 12月
generate({
    startUtc: "2025-11-30T16:00:00.000Z", startTw: "2025-12-01 00:00",
    endUtc: "2025-12-31T16:00:00.000Z", endTw: "2026-01-01 00:00",
    short: "dec", loopStart: "2025-12-01T00:00:00.000Z", loopEnd: "2025-12-31T00:00:00.000Z",
    capShort: "Dec", num: "12"
});
// 11月
generate({
    startUtc: "2025-10-31T16:00:00.000Z", startTw: "2025-11-01 00:00",
    endUtc: "2025-11-30T16:00:00.000Z", endTw: "2025-12-01 00:00",
    short: "nov", loopStart: "2025-11-01T00:00:00.000Z", loopEnd: "2025-11-30T00:00:00.000Z",
    capShort: "Nov", num: "11"
});
// 10月
generate({
    startUtc: "2025-09-30T16:00:00.000Z", startTw: "2025-10-01 00:00",
    endUtc: "2025-10-31T16:00:00.000Z", endTw: "2025-11-01 00:00",
    short: "oct", loopStart: "2025-10-01T00:00:00.000Z", loopEnd: "2025-10-31T00:00:00.000Z",
    capShort: "Oct", num: "10"
});
