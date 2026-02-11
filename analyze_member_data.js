
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB Connection Setup
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function generateMemberReport() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Member_data');

        console.log("Analyzing Member Data using Aggregation...");

        // 1. Gender Stats
        console.log("Aggregating Gender...");
        const genderAgg = await collection.aggregate([
            { $group: { _id: "$性別", count: { $sum: 1 } } }
        ]).toArray();
        const genderStats = {};
        genderAgg.forEach(g => {
            const key = g._id || 'Unknown';
            genderStats[key] = g.count;
        });

        // 2. Social Stats
        console.log("Aggregating Social Media...");
        const socialAgg = await collection.aggregate([
            { $group: { _id: "$社群類別", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        const socialArray = socialAgg.map(s => ({ name: s._id || 'Unknown', count: s.count }));

        // 3. Country Stats
        console.log("Aggregating Country...");
        const countryAgg = await collection.aggregate([
            { $group: { _id: "$國家", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        const countryArray = countryAgg.map(c => ({ name: c._id || 'Unknown', count: c.count }));

        // 4. Age Stats (Birthday is string 'YYYY/MM/DD'. Need to handle.)
        console.log("Processing Age...");
        // Since we can't easily parse string date in legacy mongo versions or without knowing exact format consistency,
        // we'll fetch just the birthdays and process in Node. streaming would be ideal but pagination is simpler if needed.
        // Actually, for age groupings, we can try to extract substring of year if format is consistent YYYY/MM/DD.
        // Or just stream the birthdays. Let's try to fetch only birthdays.
        const ageStats = {
            '<18': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55-64': 0, '65+': 0, 'Unknown': 0
        };
        const zodiacStats = {
            '牡羊座 (Aries)': { '男': 0, '女': 0 }, '金牛座 (Taurus)': { '男': 0, '女': 0 },
            '雙子座 (Gemini)': { '男': 0, '女': 0 }, '巨蟹座 (Cancer)': { '男': 0, '女': 0 },
            '獅子座 (Leo)': { '男': 0, '女': 0 }, '處女座 (Virgo)': { '男': 0, '女': 0 },
            '天秤座 (Libra)': { '男': 0, '女': 0 }, '天蠍座 (Scorpio)': { '男': 0, '女': 0 },
            '射手座 (Sagittarius)': { '男': 0, '女': 0 }, '摩羯座 (Capricorn)': { '男': 0, '女': 0 },
            '水瓶座 (Aquarius)': { '男': 0, '女': 0 }, '雙魚座 (Pisces)': { '男': 0, '女': 0 }
        };
        const chineseZodiacStats = {
            '鼠 (Rat)': { '男': 0, '女': 0 }, '牛 (Ox)': { '男': 0, '女': 0 },
            '虎 (Tiger)': { '男': 0, '女': 0 }, '兔 (Rabbit)': { '男': 0, '女': 0 },
            '龍 (Dragon)': { '男': 0, '女': 0 }, '蛇 (Snake)': { '男': 0, '女': 0 },
            '馬 (Horse)': { '男': 0, '女': 0 }, '羊 (Goat)': { '男': 0, '女': 0 },
            '猴 (Monkey)': { '男': 0, '女': 0 }, '雞 (Rooster)': { '男': 0, '女': 0 },
            '狗 (Dog)': { '男': 0, '女': 0 }, '豬 (Pig)': { '男': 0, '女': 0 }
        };
        const currentYear = new Date().getFullYear();

        // Cursor for streaming birthdays (Add Gender to projection)
        const cursor = collection.find({}, { projection: { '生日': 1, '性別': 1, '_id': 0 } });
        let processedCount = 0;

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            processedCount++;
            if (processedCount % 500000 === 0) console.log(`Processed ${processedCount} ages...`);

            const dobStr = doc['生日'];
            if (!dobStr) {
                ageStats['Unknown']++;
                continue;
            }

            // Simplistic Year extraction (assuming YYYY at start)
            // If format is YYYY/MM/DD or YYYY-MM-DD
            let birthYear = parseInt(dobStr.substring(0, 4));

            if (isNaN(birthYear) || birthYear < 1900 || birthYear > currentYear) {
                // Fallback attempt date parse
                const d = new Date(dobStr);
                if (!isNaN(d.getFullYear())) {
                    birthYear = d.getFullYear();
                } else {
                    ageStats['Unknown']++;
                    continue;
                }
            }

            const age = currentYear - birthYear;

            if (age < 18) ageStats['<18']++;
            else if (age <= 24) ageStats['18-24']++;
            else if (age <= 34) ageStats['25-34']++;
            else if (age <= 44) ageStats['35-44']++;
            else if (age <= 54) ageStats['45-54']++;
            else if (age <= 64) ageStats['55-64']++;
            else ageStats['65+']++;

            // --- Zodiac Analysis ---
            // Parse Month and Day
            // Format likely YYYY/MM/DD or YYYY-MM-DD
            let month, day;
            const parts = dobStr.split(/[-/]/);
            if (parts.length >= 3) {
                month = parseInt(parts[1]);
                day = parseInt(parts[2]);
            } else {
                continue; // Skip if format invalid for zodiac
            }

            if (!isNaN(month) && !isNaN(day)) {

                let gKey = (doc['性別'] === '男') ? '男' : '女';

                // Western Zodiac
                let zodiac = '';
                if ((month == 1 && day >= 20) || (month == 2 && day <= 18)) zodiac = '水瓶座 (Aquarius)';
                else if ((month == 2 && day >= 19) || (month == 3 && day <= 20)) zodiac = '雙魚座 (Pisces)';
                else if ((month == 3 && day >= 21) || (month == 4 && day <= 19)) zodiac = '牡羊座 (Aries)';
                else if ((month == 4 && day >= 20) || (month == 5 && day <= 20)) zodiac = '金牛座 (Taurus)';
                else if ((month == 5 && day >= 21) || (month == 6 && day <= 20)) zodiac = '雙子座 (Gemini)';
                else if ((month == 6 && day >= 21) || (month == 7 && day <= 22)) zodiac = '巨蟹座 (Cancer)';
                else if ((month == 7 && day >= 23) || (month == 8 && day <= 22)) zodiac = '獅子座 (Leo)';
                else if ((month == 8 && day >= 23) || (month == 9 && day <= 22)) zodiac = '處女座 (Virgo)';
                else if ((month == 9 && day >= 23) || (month == 10 && day <= 22)) zodiac = '天秤座 (Libra)';
                else if ((month == 10 && day >= 23) || (month == 11 && day <= 21)) zodiac = '天蠍座 (Scorpio)';
                else if ((month == 11 && day >= 22) || (month == 12 && day <= 21)) zodiac = '射手座 (Sagittarius)';
                else if ((month == 12 && day >= 22) || (month == 1 && day <= 19)) zodiac = '摩羯座 (Capricorn)';

                if (zodiac) {
                    if (zodiacStats[zodiac]) zodiacStats[zodiac][gKey]++;
                }

                // Chinese Zodiac (Based on Year)
                // 1900 was Rat (Target: Year % 12)
                // Rat: 4, Ox: 5, Tiger: 6, Rabbit: 7, Dragon: 8, Snake: 9, Horse: 10, Goat: 11, Monkey: 0, Rooster: 1, Dog: 2, Pig: 3
                const chineseZodiacs = [
                    '猴 (Monkey)', '雞 (Rooster)', '狗 (Dog)', '豬 (Pig)',
                    '鼠 (Rat)', '牛 (Ox)', '虎 (Tiger)', '兔 (Rabbit)',
                    '龍 (Dragon)', '蛇 (Snake)', '馬 (Horse)', '羊 (Goat)'
                ];
                const czIndex = birthYear % 12;
                if (czIndex >= 0 && czIndex < 12) {
                    const czName = chineseZodiacs[czIndex];
                    if (chineseZodiacStats[czName]) chineseZodiacStats[czName][gKey]++;
                }
            }
        }

        const totalMembers = processedCount;
        console.log(`Total Processed: ${totalMembers}`);

        // 5. Taiwan City Analysis
        console.log("Aggregating Taiwan Cities...");
        const cityAgg = await collection.aggregate([
            { $match: { "國家": "台灣" } },
            { $group: { _id: "$縣市別", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        const cityArray = cityAgg.map(c => ({ name: c._id || 'Unknown', count: c.count }));

        // Count Taiwan Total for percentage
        const taiwanTotal = cityArray.reduce((acc, cur) => acc + cur.count, 0);
        console.log(`Total Taiwan Members: ${taiwanTotal}`);

        // 6. Growth Trend (Yearly)
        console.log("Aggregating Yearly Growth...");
        const yearAgg = await collection.aggregate([
            {
                $project: {
                    year: { $substr: ["$建立時間", 0, 4] }
                }
            },
            { $group: { _id: "$year", count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();

        const yearlyData = yearAgg
            .filter(y => y._id && /^\d{4}$/.test(y._id) && parseInt(y._id) > 2000) // Basic filter for valid years
            .filter(y => y._id && /^\d{4}$/.test(y._id) && parseInt(y._id) > 2000) // Basic filter for valid years
            .map(y => ({ year: y._id, count: y.count }));

        // 7. Blacklist Stats
        console.log("Aggregating Blacklist...");
        const blacklistAgg = await collection.aggregate([
            { $group: { _id: "$黑名單", count: { $sum: 1 } } }
        ]).toArray();
        // Assume 'Y' is Yes, 'N' is No, 'Unknown' others
        const blacklistStats = { 'Yes': 0, 'No': 0 };
        blacklistAgg.forEach(b => {
            if (b._id === 'Y' || b._id === 'Yes' || b._id === 'true') blacklistStats['Yes'] += b.count;
            else blacklistStats['No'] += b.count;
        });

        // 8. Disability Stats
        console.log("Aggregating Disability...");
        const disabilityAgg = await collection.aggregate([
            { $group: { _id: "$身障資格", count: { $sum: 1 } } }
        ]).toArray();
        const disabilityStats = { 'Yes': 0, 'No': 0 };
        disabilityAgg.forEach(d => {
            if (d._id === 'Y' || d._id === 'Yes' || d._id === 'true') disabilityStats['Yes'] += d.count;
            else disabilityStats['No'] += d.count;
        });


        // --- HTML Generation ---
        const reportTime = new Date().toLocaleString('zh-TW');

        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Qware Member Analysis Report - 會員資料分析</title>
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #121212;
            --card-bg: #1e1e1e;
            --text-primary: #e0e0e0;
            --text-secondary: #a0a0a0;
            --accent-color: #00bcd4; /* Cyan */
            --accent-secondary: #00838f;
            --shadow: 0 8px 16px rgba(0,0,0,0.3);
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
            margin-bottom: 40px;
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
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #00bcd4, #80deea);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0;
            letter-spacing: -1px;
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
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }

        .card {
            background: var(--card-bg);
            border-radius: 16px;
            padding: 25px;
            box-shadow: var(--shadow);
            border: 1px solid #333;
            transition: transform 0.2s;
        }
        .card:hover { border-color: var(--accent-color); transform: translateY(-3px); }

        .card h3 { margin: 0 0 15px 0; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); }
        .card .value { font-size: 2.2em; font-weight: 700; color: var(--accent-color); }
        .card .sub { font-size: 0.85em; color: #666; margin-top: 8px; }

        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-bottom: 40px;
        }
        
        .full-width { grid-column: span 2; }

        .chart-card {
            background: var(--card-bg);
            border-radius: 20px;
            padding: 25px;
            box-shadow: var(--shadow);
            min-height: 400px;
            position: relative;
        }
        
        .chart-card h3 { 
            margin-top: 0;
            color: var(--text-primary);
            border-left: 4px solid var(--accent-color);
            padding-left: 10px;
        }

        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.95em; }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid #333; }
        th { color: var(--accent-color); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        tr:hover { background-color: rgba(0, 188, 212, 0.05); } /* Cyan hover */
        
        .badge {
            padding: 5px 10px;
            border-radius: 4px;
            background: #333;
            color: #fff;
            font-size: 0.8em;
        }
        
        /* PDF Button */
        .pdf-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #00bcd4, #0097a7);
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.95rem;
            box-shadow: 0 4px 15px rgba(0, 188, 212, 0.4);
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            z-index: 1000;
        }
        .pdf-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(0, 188, 212, 0.5);
        }
        
        /* Home Button */
        .home-btn {
            position: fixed;
            bottom: 90px;
            right: 30px;
            background: linear-gradient(135deg, #757575, #424242);
            color: white;
            padding: 12px 24px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.95rem;
            box-shadow: 0 4px 15px rgba(117, 117, 117, 0.4);
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            z-index: 1000;
        }
        .home-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(117, 117, 117, 0.5);
        }

        @media screen and (max-width: 900px) {
            .main-content { grid-template-columns: 1fr; }
            .full-width { grid-column: span 1; }
        }

        /* Print Styles */
        @media print {
            @page { size: landscape; margin: 5mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: var(--bg-color); color: var(--text-primary); }
            .container { width: 100%; max-width: none; margin: 0; padding: 0; }
            .card, .chart-card { 
                break-inside: avoid; 
                page-break-inside: avoid; 
                box-shadow: none; 
                border: 1px solid #333;
                background-color: var(--card-bg);
            }
            header { box-shadow: none; border-bottom: 2px solid var(--accent-color); background: none; }
            /* Hide Buttons */
            .pdf-btn, .home-btn { display: none !important; }
            
            /* Adjust colors for print if needed, but dark mode print might be tricky. */
            /* Force dark background print if possible, otherwise invert? */
            /* Let's keep it simple, browsers usually remove background colors. */
            /* But we added -webkit-print-color-adjust: exact, so it SHOULD print dark mode if user allows background graphics. */
        }
    </style>
</head>
<body>

<div class="container">
    <header>
        <div>
            <div class="logo-text">Qware Member Analysis</div>
            <div class="logo-sub">會員資料庫深度分析</div>
        </div>
        <div class="meta">
            Generated: ${reportTime}<br>
            Total Members: ${totalMembers.toLocaleString()}
        </div>
    </header>

    <div class="stats-grid">
        <div class="card">
            <h3>總會員數 (Total Members)</h3>
            <div class="value">${totalMembers.toLocaleString()}</div>
        </div>
        <div class="card">
            <h3>最大來源 (Top Source)</h3>
            <div class="value" style="font-size: 1.8em;">${socialArray[0] ? socialArray[0].name : 'N/A'}</div>
            <div class="sub">${socialArray[0] ? socialArray[0].count.toLocaleString() : 0} members</div>
        </div>
        <div class="card">
            <h3>主要國家 (Top Country)</h3>
            <div class="value" style="font-size: 1.8em;">${countryArray[0] ? countryArray[0].name : 'N/A'}</div>
            <div class="sub">${countryArray[0] ? countryArray[0].count.toLocaleString() : 0} members</div>
        </div>
        <div class="card">
            <h3>女性佔比 (Female %)</h3>
            <div class="value">${((genderStats['女'] || 0) / totalMembers * 100).toFixed(1)}%</div>
        </div>
    </div>

    <div class="main-content">
        <!-- Gender Chart -->
        <div class="chart-card">
            <h3>性別分佈 (Gender Distribution)</h3>
            <div style="height: 350px;">
                <canvas id="genderChart"></canvas>
            </div>
            <table>
                <thead><tr><th>性別</th><th>人數</th><th>佔比</th></tr></thead>
                <tbody>
                    ${Object.entries(genderStats).map(([g, count]) => `
                        <tr>
                            <td>${g}</td>
                            <td>${count.toLocaleString()}</td>
                            <td>${(count / totalMembers * 100).toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Age Chart -->
        <div class="chart-card">
            <h3>年齡分佈 (Age Distribution)</h3>
             <div style="height: 350px;">
                <canvas id="ageChart"></canvas>
            </div>
        </div>
    </div>
    
    <div class="main-content">
        <!-- Zodiac Chart -->
        <div class="chart-card full-width">
            <h3>12星座分佈 (Zodiac Distribution)</h3>
             <div style="height: 350px;">
                <canvas id="zodiacChart"></canvas>
            </div>
        </div>
    </div>

    <div class="main-content">
        <!-- Chinese Zodiac Chart -->
        <div class="chart-card full-width">
            <h3>12生肖分佈 (Chinese Zodiac Distribution)</h3>
             <div style="height: 350px;">
                <canvas id="chineseZodiacChart"></canvas>
            </div>
        </div>
    </div>

    <div class="main-content">
        <!-- Blacklist Chart -->
        <div class="chart-card" style="border-left: 4px solid #F44336;">
            <h3>黑名單狀態 (Blacklist Status)</h3>
            <div style="height: 300px;">
                <canvas id="blacklistChart"></canvas>
            </div>
            <div style="text-align: center; margin-top: 15px; font-weight: bold; color: #F44336;">
                黑名單人數: ${blacklistStats['Yes'].toLocaleString()} (${((blacklistStats['Yes'] / totalMembers) * 100).toFixed(2)}%)
            </div>
        </div>

        <!-- Disability Chart -->
        <div class="chart-card" style="border-left: 4px solid #FF9800;">
            <h3>身障資格 (Disability Status)</h3>
             <div style="height: 300px;">
                <canvas id="disabilityChart"></canvas>
            </div>
            <div style="text-align: center; margin-top: 15px; font-weight: bold; color: #FF9800;">
                身障人數: ${disabilityStats['Yes'].toLocaleString()} (${((disabilityStats['Yes'] / totalMembers) * 100).toFixed(2)}%)
            </div>
        </div>
    </div>

    <div class="main-content">
        <!-- Social Media Chart -->
        <div class="chart-card full-width">
            <h3>社群/註冊來源分佈 (Social/Source)</h3>
             <div style="height: 300px;">
                <canvas id="socialChart"></canvas>
            </div>
        </div>
    </div>

    <div class="main-content">
        <!-- Country Chart -->
        <div class="chart-card full-width">
            <h3>國家/地區分佈 (Country Distribution)</h3>
             <div style="height: 300px;">
                <canvas id="countryChart"></canvas>
            </div>
        </div>
    </div>

    <!-- Yearly Growth Trend -->
    <div class="main-content">
        <div class="chart-card full-width">
            <h3>會員增長趨勢 (Yearly Growth Trend)</h3>
            <div style="height: 350px;">
                <canvas id="growthChart"></canvas>
            </div>
        </div>
    </div>

    <!-- Taiwan City Analysis -->
    <div class="main-content">
        <div class="chart-card full-width" style="border-left: 5px solid #00E676;">
            <h3>台灣縣市分佈 (Taiwan City Distribution)</h3>
            <div style="margin-bottom: 10px; font-size: 0.9em; color: #888;">
                * 僅統計國家為「台灣」之會員 (共 ${taiwanTotal.toLocaleString()} 人)
            </div>
             <div style="height: 400px;">
                <canvas id="cityChart"></canvas>
            </div>
        </div>
    </div>

</div>

<script>
    // Data Preparation
    const genderData = ${JSON.stringify(genderStats)};
    const ageData = ${JSON.stringify(ageStats)};
    const socialData = ${JSON.stringify(socialArray)};
    const countryData = ${JSON.stringify(countryArray.slice(0, 15))}; // Top 15
    const cityData = ${JSON.stringify(cityArray)};
    const taiwanTotal = ${taiwanTotal};
    const yearlyData = ${JSON.stringify(yearlyData)};
    const blacklistData = ${JSON.stringify(blacklistStats)};
    const disabilityData = ${JSON.stringify(disabilityStats)};
    const zodiacData = ${JSON.stringify(zodiacStats)};
    const chineseZodiacData = ${JSON.stringify(chineseZodiacStats)};

    // 9. Zodiac Chart (Stacked Bar)
    new Chart(document.getElementById('zodiacChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(zodiacData),
            datasets: [
                {
                    label: '男',
                    data: Object.values(zodiacData).map(d => d['男']),
                    backgroundColor: '#42A5F5', // Blue
                },
                {
                    label: '女',
                    data: Object.values(zodiacData).map(d => d['女']),
                    backgroundColor: '#EC407A', // Pink
                }
            ]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: '#ccc' } },
                y: { stacked: true, grid: { color: '#333' }, ticks: { color: '#888' } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#ccc' } },
                datalabels: {
                    color: 'white',
                    font: { size: 10 },
                    formatter: (value, ctx) => {
                         if (value === 0) return '';
                         const dataset = ctx.chart.data.datasets[ctx.datasetIndex];
                         const total = dataset.data.reduce((a, b) => a + b, 0); // Total for this gender? No, we probably want % of column or just number.
                         // Let's just show number for now to avoid clutter, or maybe small %
                         // If stacked, showing % of total bar height is complex in simple label.
                         // Just show value.
                         return value.toLocaleString();
                    }
                }
            }
        }
    });

    // 10. Chinese Zodiac Chart (Stacked Bar)
    new Chart(document.getElementById('chineseZodiacChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(chineseZodiacData),
            datasets: [
                {
                    label: '男',
                    data: Object.values(chineseZodiacData).map(d => d['男']),
                    backgroundColor: '#42A5F5',
                },
                {
                    label: '女',
                    data: Object.values(chineseZodiacData).map(d => d['女']),
                    backgroundColor: '#EC407A',
                }
            ]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: '#ccc' } },
                y: { stacked: true, grid: { color: '#333' }, ticks: { color: '#888' } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#ccc' } },
                datalabels: {
                    color: 'white',
                    font: { size: 10 },
                    formatter: (value) => value > 0 ? value.toLocaleString() : ''
                }
            }
        }
    });

    // 7. Blacklist Chart (Pie/Doughnut)
    new Chart(document.getElementById('blacklistChart'), {
        type: 'doughnut',
        data: {
            labels: ['正常 (Normal)', '黑名單 (Blacklisted)'],
            datasets: [{
                data: [blacklistData['No'], blacklistData['Yes']],
                backgroundColor: ['#4CAF50', '#F44336'], // Green, Red
                borderWidth: 0
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#ccc' } },
                datalabels: {
                    color: 'white',
                    font: { weight: 'bold' },
                    formatter: (value, ctx) => {
                        let sum = 0;
                        let dataArr = ctx.chart.data.datasets[0].data;
                        dataArr.map(data => { sum += data; });
                        let percentage = (value*100 / sum).toFixed(1)+"%";
                        // Only show if > 0
                        if (value === 0) return '';
                        return percentage;
                    }
                }
            }
        }
    });

    // 8. Disability Chart (Pie/Doughnut)
    new Chart(document.getElementById('disabilityChart'), {
        type: 'doughnut',
        data: {
            labels: ['無 (None)', '有 (Yes)'],
            datasets: [{
                data: [disabilityData['No'], disabilityData['Yes']],
                backgroundColor: ['#2196F3', '#FF9800'], // Blue, Orange
                borderWidth: 0
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#ccc' } },
                datalabels: {
                    color: 'white',
                    font: { weight: 'bold' },
                    formatter: (value, ctx) => {
                        let sum = 0;
                        let dataArr = ctx.chart.data.datasets[0].data;
                        dataArr.map(data => { sum += data; });
                        let percentage = (value*100 / sum).toFixed(1)+"%";
                        if (value === 0) return '';
                        return percentage;
                    }
                }
            }
        }
    });

    // 6. Growth Chart (Line)
    new Chart(document.getElementById('growthChart'), {
        type: 'line',
        data: {
            labels: yearlyData.map(d => d.year),
            datasets: [{
                label: '新增會員數',
                data: yearlyData.map(d => d.count),
                borderColor: '#FFD700', // Gold
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: 'white',
                    align: 'top',
                    anchor: 'end',
                    font: { weight: 'bold' },
                    formatter: (value) => value.toLocaleString()
                }
            },
            scales: {
                x: { grid: { color: '#333' }, ticks: { color: '#ccc' } },
                y: { grid: { color: '#333' }, ticks: { color: '#888' } }
            }
        }
    });

    // 1. Gender Chart (Pie)
    new Chart(document.getElementById('genderChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(genderData),
            datasets: [{
                data: Object.values(genderData),
                backgroundColor: ['#EC407A', '#42A5F5', '#BDBDBD'], // Pink, Blue, Grey
                borderWidth: 0
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#ccc' } },
                datalabels: {
                    color: 'white',
                    font: { weight: 'bold', size: 14 },
                    formatter: (value, ctx) => {
                        let sum = 0;
                        let dataArr = ctx.chart.data.datasets[0].data;
                        dataArr.map(data => { sum += data; });
                        let percentage = (value*100 / sum).toFixed(1)+"%";
                        return percentage;
                    }
                }
            }
        }
    });

    // 2. Age Chart (Bar)
    new Chart(document.getElementById('ageChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(ageData),
            datasets: [{
                label: '人數',
                data: Object.values(ageData),
                backgroundColor: '#00bcd4',
                borderRadius: 4
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: '#eee',
                    anchor: 'end',
                    align: 'top',
                    font: { size: 11 },
                    formatter: (value, ctx) => {
                        const total = ${totalMembers};
                        const percentage = ((value / total) * 100).toFixed(1) + '%';
                        return value.toLocaleString() + ' (' + percentage + ')';
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#ccc' } },
                y: { grid: { color: '#333' }, ticks: { color: '#888' } }
            }
        }
    });

    // 3. Social Chart (Bar - Horizontal)
    new Chart(document.getElementById('socialChart'), {
        type: 'bar',
        data: {
            labels: socialData.map(d => d.name),
            datasets: [{
                label: '人數',
                data: socialData.map(d => d.count),
                backgroundColor: '#26a69a',
                borderRadius: 4
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                datalabels: {
                    color: 'white',
                    anchor: 'end',
                    align: 'end',
                    offset: 4,
                    font: { weight: 'bold', size: 11 },
                    formatter: (value, ctx) => {
                         const total = ${totalMembers};
                         const percentage = ((value / total) * 100).toFixed(1) + '%';
                         return value.toLocaleString() + ' / ' + percentage;
                    }
                }
            },
            scales: {
                x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                y: { grid: { display: false }, ticks: { color: '#ccc' } }
            }
        }
    });

    // 4. Country Chart (Bar - Horizontal)
    new Chart(document.getElementById('countryChart'), {
        type: 'bar',
        data: {
            labels: countryData.map(d => d.name),
            datasets: [{
                label: '人數',
                data: countryData.map(d => d.count),
                backgroundColor: '#7e57c2',
                borderRadius: 4
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                datalabels: {
                    color: 'white',
                    anchor: 'end',
                    align: 'end',
                    offset: 4,
                    font: { weight: 'bold', size: 11 },
                    formatter: (value, ctx) => {
                         const total = ${totalMembers};
                         const percentage = ((value / total) * 100).toFixed(1) + '%';
                         return value.toLocaleString() + ' / ' + percentage;
                    }
                }
            },
            scales: {
                x: { grid: { color: '#333' }, ticks: { color: '#888' } },
                y: { grid: { display: false }, ticks: { color: '#ccc' } }
            }
        }
    });

    // 5. City Chart (Bar)
    new Chart(document.getElementById('cityChart'), {
        type: 'bar',
        data: {
            labels: cityData.map(d => d.name),
            datasets: [{
                label: '人數',
                data: cityData.map(d => d.count),
                backgroundColor: '#00E676',
                borderRadius: 4
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                datalabels: {
                    color: 'white',
                    anchor: 'end',
                    align: 'top',
                    offset: 4,
                    font: { size: 10 },
                    // If too many bars, rotation might be needed or hide labels for small values
                    formatter: (value, ctx) => {
                         const percentage = ((value / taiwanTotal) * 100).toFixed(1) + '%';
                         if (value < 1000) return ''; // Hide small labels to avoid clutter
                         return value.toLocaleString() + ' (' + percentage + ')';
                    },
                    rotation: -45,
                    align: 'top'
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#ccc', autoSkip: false, maxRotation: 45, minRotation: 45 } },
                y: { grid: { color: '#333' }, ticks: { color: '#888' } }
            }
        }
    });

    // PDF Download Function
    function downloadPDF() {
        window.print();
    }
</script>

<!-- PDF Button -->
<button class="pdf-btn" onclick="downloadPDF()">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
    下載 PDF
</button>

<!-- Home Button -->
<a href="report_index.html" class="home-btn">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
    </svg>
    回首頁
</a>

</body>
</html>
        `;

        const fileName = 'A_Qware_Member_Analysis_Report.html';
        const reportDir = path.join(__dirname, 'report');
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir);
        }

        fs.writeFileSync(path.join(reportDir, fileName), htmlContent);
        console.log(`Report generated: ${fileName}`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

generateMemberReport();
