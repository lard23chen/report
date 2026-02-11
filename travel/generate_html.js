const xlsx = require('xlsx');
const fs = require('fs');

// Read the workbook
const workbook = xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx', { cellDates: true });
const sheetName = workbook.SheetNames[0];
const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

// Clean and Group Data
const trips = {};

// Helper to format date
function formatDate(date) {
    if (!date) return '';
    if (!(date instanceof Date)) return date;
    return date.toISOString().split('T')[0];
}

// Destination mapping (simple)
const destMap = {
    'NRT': '東京 (NRT)',
    'KIX': '大阪 (KIX)',
    'FUK': '福岡 (FUK)',
    'CTS': '札幌 (CTS)',
    'OKA': '沖繩 (OKA)',
    'TPE': '台北 (TPE)',
    'HKG': '香港 (HKG)',
    'BKK': '曼谷 (BKK)',
    'SIN': '新加坡 (SIN)',
    'ICN': '首爾 (ICN)',
    'CDG': '巴黎 (CDG)',
    'LAX': '洛杉磯 (LAX)',
    'SFO': '舊金山 (SFO)',
    'JFK': '紐約 (JFK)',
    'LHR': '倫敦 (LHR)',
    // Add known codes from data context if needed, otherwise fallback to code
};

rawData.forEach(row => {
    // Skip header rows if present in data body
    if (row['目的地'] === '目的地' || !row['訂位代號']) return;

    const code = row['訂位代號'];
    if (!trips[code]) {
        trips[code] = {
            id: code,
            flights: [],
            price: 0,
            payment: row['支付方式'] || '-',
            ticket: row['電子機票'] || '#'
        };
    }

    // Check if price is for the whole trip (often listed on one row)
    // If multiple rows list price, we assume it's per passenger or per leg?
    // Usually booking ref implies one payment. Let's take the max price found or sum if unique?
    // Given the structure, let's just take the first non-zero price we see for the group, 
    // or sum if it seems like split legs. 
    // Let's assume price is per ticket/pnr. 
    if (row['票價'] && (!trips[code].price || trips[code].price < row['票價'])) {
        trips[code].price = row['票價'];
    }

    trips[code].flights.push({
        dest: row['目的地'],
        route: row['ROUTE'],
        date: row['班機日期'],
        flightNo: row['班機號碼'],
        aircraft: row['機型']
    });
});

// Post-process trips: sort flights by date, determine main destination
const tripList = Object.values(trips).map(trip => {
    trip.flights.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Determine main destination (usually the '去' destination)
    const outbound = trip.flights.find(f => f.route === '去');
    const mainDestCode = outbound ? outbound.dest : trip.flights[0]?.dest;
    trip.mainDest = destMap[mainDestCode] || mainDestCode;

    // Date range
    const startDate = trip.flights[0]?.date;
    const endDate = trip.flights[trip.flights.length - 1]?.date;
    trip.dateRange = `${formatDate(startDate)} ${startDate !== endDate ? ' ➜ ' + formatDate(endDate) : ''}`;

    return trip;
});

// Sort trips by date (descending)
tripList.sort((a, b) => {
    const da = a.flights[0]?.date ? new Date(a.flights[0].date) : 0;
    const db = b.flights[0]?.date ? new Date(b.flights[0].date) : 0;
    return db - da; // Newest first
});

// HTML Generation
const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>✈️ 我的旅遊日記</title>
    <link href="https://fonts.googleapis.com/css2?family=Mali:wght@400;700&family=Zen+Maru+Gothic:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #FFF9F0;
            --card-bg: #FFFFFF;
            --primary: #FF9AA2;
            --secondary: #B5EAD7;
            --accent: #FFDAC1;
            --text: #5D576B;
            --shadow: 0 8px 20px rgba(149, 157, 165, 0.1);
        }
        
        body {
            font-family: 'Zen Maru Gothic', 'Mali', sans-serif;
            background-color: var(--bg-color);
            color: var(--text);
            margin: 0;
            padding: 20px;
            background-image: radial-gradient(#FFB7B2 1px, transparent 1px), radial-gradient(#B5EAD7 1px, transparent 1px);
            background-size: 40px 40px;
            background-position: 0 0, 20px 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        h1 {
            text-align: center;
            font-size: 3rem;
            color: #FF6F61;
            margin-bottom: 40px;
            text-shadow: 2px 2px 0px #FFF, 4px 4px 0px #FFDAC1;
            letter-spacing: 2px;
        }

        .trip-card {
            background: var(--card-bg);
            border-radius: 25px;
            padding: 25px;
            margin-bottom: 30px;
            box-shadow: var(--shadow);
            position: relative;
            overflow: hidden;
            border: 3px solid #FFF;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .trip-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 30px rgba(149, 157, 165, 0.2);
        }

        .trip-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px dashed var(--accent);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }

        .trip-dest {
            font-size: 1.8rem;
            font-weight: 700;
            color: #FF6F61;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .trip-date {
            font-size: 1rem;
            color: #888;
            background: #E2F0CB;
            padding: 5px 15px;
            border-radius: 15px;
        }

        .flight-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .flight-item {
            display: flex;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #F0F0F0;
        }

        .flight-item:last-child {
            border-bottom: none;
        }

        .flight-icon {
            font-size: 1.5rem;
            margin-right: 15px;
            width: 40px;
            text-align: center;
        }

        .flight-details {
            flex: 1;
        }

        .flight-route {
            font-weight: bold;
            font-size: 1.1rem;
            color: #555;
            margin-bottom: 4px;
        }

        .flight-meta {
            font-size: 0.9rem;
            color: #999;
            display: flex;
            gap: 15px;
        }

        .trip-footer {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 2px solid #F7F7F7;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9rem;
        }

        .tag {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            margin-right: 8px;
        }

        .tag-pnr { background: #FFDAC1; color: #D2691E; }
        .tag-price { background: #E2F0CB; color: #556B2F; font-weight: bold; }
        .tag-pay { background: #C7CEEA; color: #483D8B; }

        .sticker {
            position: absolute;
            opacity: 0.15;
            pointer-events: none;
            z-index: 0;
            font-size: 8rem;
            bottom: -20px;
            right: -20px;
            transform: rotate(-10deg);
        }

        @media (max-width: 600px) {
            .trip-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }
            .trip-footer {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }
        }
    </style>
</head>
<body>

<div class="container">
    <h1>✈️ My Travel Diary 🌍</h1>

    ${tripList.map(trip => `
    <div class="trip-card">
        <div class="sticker">✈️</div>
        
        <div class="trip-header">
            <div class="trip-dest">
                <span>📍</span> ${trip.mainDest}
            </div>
            <div class="trip-date">📅 ${trip.dateRange}</div>
        </div>

        <ul class="flight-list">
            ${trip.flights.map(f => `
            <li class="flight-item">
                <div class="flight-icon">${f.route === '去' ? '🛫' : (f.route === '回' ? '🛬' : '✈️')}</div>
                <div class="flight-details">
                    <div class="flight-route">
                        ${f.route} : ${new Date(f.date).toLocaleDateString()}
                    </div>
                    <div class="flight-meta">
                        <span>✈️ ${f.flightNo}</span>
                        <span>💺 ${f.aircraft || 'Unknown'}</span>
                        <span>🚩 ${f.dest}</span>
                    </div>
                </div>
            </li>
            `).join('')}
        </ul>

        <div class="trip-footer">
            <div class="tags">
                <span class="tag tag-pnr">PNR: ${trip.id}</span>
                <span class="tag tag-pay">💳 ${trip.payment}</span>
            </div>
            ${trip.price ? `<span class="tag tag-price">💰 TWD ${trip.price.toLocaleString()}</span>` : ''}
        </div>
    </div>
    `).join('')}

    <div style="text-align: center; margin-top: 50px; color: #AAA; font-size: 0.9rem;">
        Made with ❤️ for Travel Memories
    </div>
</div>

</body>
</html>
`;

fs.writeFileSync('d:/2025/AI/MongoDB/travel/travel_diary.html', htmlContent);
console.log('HTML generated successfully!');
