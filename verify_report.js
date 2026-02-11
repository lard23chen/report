// Simulate the report's init() in Node.js to find runtime errors
const fs = require('fs');
const html = fs.readFileSync('A_Qware_Revenue_Report_2026年02月_分析報表.html', 'utf8');

// Extract the dbData
const dataStart = html.indexOf('const dbData = ') + 'const dbData = '.length;
// Find the end - next semicolon followed by newline
let depth = 0;
let dataEnd = dataStart;
for (let i = dataStart; i < html.length; i++) {
    if (html[i] === '[' || html[i] === '{') depth++;
    if (html[i] === ']' || html[i] === '}') depth--;
    if (depth === 0 && html[i] === ';') {
        dataEnd = i;
        break;
    }
}
const dataStr = html.substring(dataStart, dataEnd);
console.log('Data length:', dataStr.length);
console.log('First 100 chars:', dataStr.substring(0, 100));

try {
    const dbData = JSON.parse(dataStr);
    console.log('Records:', dbData.length);

    // Simulate analyzeEvent for "Team Taiwan高雄澄清湖自辦練習賽"
    const eventName = 'Team Taiwan高雄澄清湖自辦練習賽';
    const allEventData = dbData.filter(d => d['節目/商品名稱'] === eventName);
    console.log('\n--- analyzeEvent("' + eventName + '") ---');
    console.log('Total records found:', allEventData.length);

    const eventData = allEventData.filter(d => d['狀態'] === '正常');
    console.log('Valid (正常) records:', eventData.length);

    const revenue = eventData.reduce((acc, cur) => acc + (cur['售價'] || 0), 0);
    console.log('Revenue:', revenue);
    console.log('Tickets:', eventData.length);

    if (allEventData.length > 0) {
        console.log('\nSample record:');
        const sample = allEventData[0];
        console.log('  狀態:', sample['狀態']);
        console.log('  售價:', sample['售價']);
        console.log('  節目名稱:', sample['節目/商品名稱']);
    }

    // Check if this event appears in Top 5 by revenue
    const validOrders = dbData.filter(d => d['狀態'] === '正常');
    const eventStats = {};
    validOrders.forEach(item => {
        const name = item['節目/商品名稱'] || 'Unknown';
        const price = item['售價'] || 0;
        if (!eventStats[name]) eventStats[name] = { tickets: 0, revenue: 0 };
        eventStats[name].tickets += 1;
        eventStats[name].revenue += price;
    });

    const sorted = Object.entries(eventStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.revenue - a.revenue);

    console.log('\n--- Top 10 by Revenue ---');
    sorted.slice(0, 10).forEach((ev, i) => {
        const marker = ev.name === eventName ? ' <== TARGET' : '';
        console.log(`${i + 1}. ${ev.name} | tickets:${ev.tickets} | rev:${ev.revenue}${marker}`);
    });

    const sortedByTickets = [...sorted].sort((a, b) => b.tickets - a.tickets);
    console.log('\n--- Top 10 by Tickets ---');
    sortedByTickets.slice(0, 10).forEach((ev, i) => {
        const marker = ev.name === eventName ? ' <== TARGET' : '';
        console.log(`${i + 1}. ${ev.name} | tickets:${ev.tickets} | rev:${ev.revenue}${marker}`);
    });

} catch (e) {
    console.error('Parse error:', e.message);
}
