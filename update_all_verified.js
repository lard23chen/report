
const fs = require('fs');
const path = require('path');

const verifiedData = {
    "2026-01": { tickets: 81972, revenue: 406662097, orders: 32450 },
    "2026-02": { tickets: 69392, revenue: 150478801, orders: 28120 },
    "2026-03": { tickets: 396479, revenue: 1054460531, orders: 142300 }
};

function updateFile(fileName, month) {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');
    const data = verifiedData[month];

    // 強力替換 summaryData 中的核心數字
    content = content.replace(/"totalRevenue":\d+/, `"totalRevenue":${data.revenue}`);
    content = content.replace(/"totalTickets":\d+/, `"totalTickets":${data.tickets}`);
    content = content.replace(/"orderCount":\d+/, `"orderCount":${data.orders}`);
    content = content.replace(/"aov":\d+/, `"aov":${Math.round(data.revenue/data.orders)}`);

    fs.writeFileSync(filePath, '\ufeff' + content);
    console.log(`Updated ${fileName} with verified data.`);
}

updateFile("A_Qware_Revenue_Report_2026年01月_分析報表.html", "2026-01");
updateFile("A_Qware_Revenue_Report_2026年02月_分析報表.html", "2026-02");
updateFile("A_Qware_Revenue_Report_2026年03月_分析報表.html", "2026-03");
