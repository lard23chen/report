const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// --- Helper Functions ---
function excelDateToJSDate(serial) {
    if (!serial) return null;
    if (serial instanceof Date) return serial;
    // Excel base date is 1899-12-30
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info;
}

function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

const destMap = {
    'NRT': '東京 (NRT)', 'HND': '東京 (HND)',
    'KIX': '大阪 (KIX)',
    'FUK': '福岡 (FUK)',
    'CTS': '札幌 (CTS)',
    'OKA': '沖繩 (OKA)',
    'TPE': '台北 (TPE)', 'TSA': '台北 (TSA)',
    'HKG': '香港 (HKG)',
    'BKK': '曼谷 (BKK)', 'DMK': '曼谷 (DMK)',
    'SIN': '新加坡 (SIN)',
    'ICN': '首爾 (ICN)', 'GMP': '首爾 (GMP)',
    'CDG': '巴黎 (CDG)',
    'LAX': '洛杉磯 (LAX)',
    'SFO': '舊金山 (SFO)',
    'JFK': '紐約 (JFK)',
    'LHR': '倫敦 (LHR)',
    'CNX': '清邁 (CNX)',
};

// --- Main Processing ---

try {
    const workbook = xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx', { cellDates: true });

    // 1. Identify Sheets Dynamically
    const allSheets = workbook.SheetNames;
    const flightSheets = allSheets.filter(s => /ticket|tikcet/i.test(s));
    const hotelSheets = allSheets.filter(s => /hotel/i.test(s));

    console.log('Found Flight Sheets:', flightSheets);
    console.log('Found Hotel Sheets:', hotelSheets);

    // 2. Process Flights
    const trips = {};

    flightSheets.forEach(sheetName => {
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

        data.forEach(row => {
            if (!row['訂位代號'] && !row['目的地']) return;
            if (row['目的地'] === '目的地') return;

            // Basic validation for date
            if (row['班機日期'] && new Date(row['班機日期']) < new Date('2000-01-01')) return;

            const pnr = row['訂位代號'] || `NO-PNR-${row['班機日期'] ? formatDate(row['班機日期']) : 'UNKNOWN'}`;

            if (!trips[pnr]) {
                trips[pnr] = {
                    id: pnr,
                    flights: [],
                    hotels: [],
                    price: 0
                };
            }

            if (row['票價'] && typeof row['票價'] === 'number') {
                trips[pnr].price = Math.max(trips[pnr].price, row['票價']);
            }

            trips[pnr].flights.push({
                dest: row['目的地'],
                route: row['ROUTE'],
                date: row['班機日期'],
                flightNo: row['班機號碼'],
                aircraft: row['機型']
            });
        });
    });

    // 3. Sort Flights & Define Dates
    Object.values(trips).forEach(t => {
        t.flights.sort((a, b) => new Date(a.date) - new Date(b.date));
        t.startDate = t.flights[0]?.date;
        t.endDate = t.flights[t.flights.length - 1]?.date;

        // Determine Destination
        const outbound = t.flights.find(f => f.route === '去');
        const mainCode = outbound ? outbound.dest : t.flights[0]?.dest;
        t.mainDestName = destMap[mainCode] || mainCode || (mainCode ? mainCode : 'Unknown Trip');
    });

    // 4. Process Hotels
    const hotels = [];

    hotelSheets.forEach(sheetName => {
        const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', cellDates: true });

        let currentHeaders = null;
        let headerRowIndex = -1;

        rawRows.forEach((row, idx) => {
            const rowStr = JSON.stringify(row);
            if (rowStr.includes('入住日期') || rowStr.includes('Check-in') || rowStr.includes('check-in')) {
                currentHeaders = row;
                headerRowIndex = idx;
                return;
            }

            if (currentHeaders && idx > headerRowIndex) {
                const hotelObj = {};
                let hasData = false;

                currentHeaders.forEach((key, colIdx) => {
                    if (key && typeof key === 'string') {
                        const val = row[colIdx];
                        hotelObj[key.trim()] = val;
                        if (val) hasData = true;
                    }
                });

                const hName = hotelObj['酒店'] || hotelObj['Hotel'] || hotelObj['hotel'];
                const hCheckIn = hotelObj['入住日期'] || hotelObj['Check-in'] || hotelObj['check-in'];
                const hCheckOut = hotelObj['退房'] || hotelObj['Check-out'] || hotelObj['check-out'];

                // Filter invalid dates
                if (hName && hCheckIn && new Date(hCheckIn) > new Date('2000-01-01')) {
                    hotels.push({
                        name: hName,
                        checkIn: hCheckIn,
                        checkOut: hCheckOut,
                        price: hotelObj['房價'] || hotelObj['Price'],
                        source: sheetName,
                        sheetIndex: idx // preserve order
                    });
                }
            }
        });
    });

    // 5. Link Hotels (and create phantom trips if orphan)
    hotels.forEach(h => {
        const hDate = new Date(h.checkIn);
        let bestTrip = null;

        // Search existing flight trips
        Object.values(trips).forEach(t => {
            if (!t.startDate) return;
            const tStart = new Date(t.startDate); tStart.setDate(tStart.getDate() - 3); // wider buffer
            const tEnd = new Date(t.endDate || t.startDate); tEnd.setDate(tEnd.getDate() + 3);

            if (hDate >= tStart && hDate <= tEnd) {
                bestTrip = t;
            }
        });

        if (bestTrip) {
            bestTrip.hotels.push(h);
            // Extend trip dates if hotel is outside flight range
            if (hDate < new Date(bestTrip.startDate)) bestTrip.startDate = hDate;
            const hOut = h.checkOut ? new Date(h.checkOut) : hDate;
            if (hOut > new Date(bestTrip.endDate)) bestTrip.endDate = hOut;
        } else {
            // Create ORPHAN TRIP (Phantom)
            // Check if we can group with another phantom trip nearby?
            let phantom = Object.values(trips).find(t => t.id.startsWith('HOTEL-ONLY') &&
                Math.abs(new Date(t.startDate) - hDate) < 86400000 * 5);

            if (phantom) {
                phantom.hotels.push(h);
                // Expand dates
                if (hDate < new Date(phantom.startDate)) phantom.startDate = h.checkIn;
                const hOut = h.checkOut ? new Date(h.checkOut) : hDate;
                if (hOut > new Date(phantom.endDate)) phantom.endDate = h.checkOut;
            } else {
                const pnr = `HOTEL-ONLY-${formatDate(h.checkIn)}`;
                trips[pnr] = {
                    id: pnr,
                    mainDestName: `🏨 ${h.name}`,
                    startDate: h.checkIn,
                    endDate: h.checkOut || h.checkIn,
                    flights: [],
                    hotels: [h],
                    price: 0
                };
            }
        }
    });

    // 6. Final Sort and Split
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedTrips = Object.values(trips).sort((a, b) => {
        const da = a.startDate ? new Date(a.startDate) : new Date(0);
        const db = b.startDate ? new Date(b.startDate) : new Date(0);
        return db - da; // Newest first
    });

    const futureTrips = sortedTrips.filter(t => new Date(t.endDate || t.startDate) >= today);
    const pastTrips = sortedTrips.filter(t => new Date(t.endDate || t.startDate) < today);

    // Sort Future trips ascending (nearest first)
    futureTrips.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    // --- Generate HTML ---
    const generateTripCard = (trip) => {
        const startDateStr = formatDate(trip.startDate);
        const endDateStr = formatDate(trip.endDate);
        const dateRangeStr = startDateStr === endDateStr ? startDateStr : `${startDateStr} ➜ ${endDateStr}`;

        // Merge and Sort Events
        let events = [];

        // Add Flights
        trip.flights.forEach(f => {
            events.push({
                type: 'flight',
                date: new Date(f.date),
                label: f.route === '去' ? '✈️ 出發 (Departure)' : (f.route === '回' ? '✈️ 返程 (Return)' : '✈️ 飛行 (Flight)'),
                detail: `${f.flightNo} (${f.aircraft || ''})`,
                subDetail: `${destMap[f.dest] || f.dest}`,
                icon: f.route === '去' ? '🛫' : (f.route === '回' ? '🛬' : '✈️')
            });
        });

        // Add Hotels (Check-in)
        trip.hotels.forEach(h => {
            // Check-in Event
            events.push({
                type: 'hotel',
                date: new Date(h.checkIn),
                label: '🏨 入住 (Check-in)',
                detail: h.name,
                subDetail: `${formatDate(h.checkIn)} - ${formatDate(h.checkOut)}`,
                icon: '🏨',
                price: h.price
            });
        });

        // Sort by Date
        events.sort((a, b) => a.date - b.date);

        return `
        <div class="trip-card">
            <div class="trip-header">
                <div class="trip-title-group">
                    <div class="trip-icon-large">🌏</div>
                    <div>
                        <h2>${trip.mainDestName}</h2> 
                        <span class="trip-dates">${dateRangeStr}</span>
                    </div>
                </div>
                <div class="trip-meta">
                    <span class="pnr-tag">PNR: ${trip.id}</span>
                </div>
            </div>
            
            <div class="trip-timeline">
                ${events.map(e => `
                <div class="timeline-item ${e.type}">
                    <div class="timeline-left">
                        <div class="timeline-date">${formatDate(e.date)}</div>
                        <div class="timeline-time">${e.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) !== '00:00' ? e.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    </div>
                    <div class="timeline-icon">${e.icon}</div>
                    <div class="timeline-content">
                        <div class="event-label">${e.label}</div>
                        <div class="event-detail">${e.detail}</div>
                        <div class="event-sub">${e.subDetail}</div>
                        ${e.price ? `<div class="event-price">💰 ${e.price}</div>` : ''}
                    </div>
                </div>
                `).join('')}
                
                ${events.length === 0 ? '<div style="padding:20px; text-align:center; color:#999;">暫無詳細行程資料</div>' : ''}
            </div>

            <div class="trip-total">
                <div class="total-item">
                     機票: ${trip.price ? 'TWD ' + trip.price.toLocaleString() : '---'}
                </div>
                <div class="total-item">
                     住宿數: ${trip.hotels.length} 間
                </div>
            </div>
        </div>
        `;
    };

    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>✈️ 我的旅遊日記</title>
    <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #FF8BA7;
            --secondary: #FFC6C7;
            --accent: #FAEEE7;
            --text-dark: #33272a;
            --text-gray: #594a4e;
            --bg-body: #fffffe;
            --flight-color: #3da9fc;
            --hotel-color: #ff9f1c;
        }
        
        body {
            font-family: 'Zen Maru Gothic', sans-serif;
            margin: 0;
            padding: 0;
            background: #FAFAFA;
            color: var(--text-dark);
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            text-align: center;
            padding: 60px 0 40px;
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
            margin-bottom: 50px;
            border-radius: 0 0 50px 50px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        }

        h1 {
            font-size: 2.8rem;
            color: white;
            text-shadow: 2px 2px 0 rgba(0,0,0,0.1);
            margin: 0;
        }

        .section-title {
            font-size: 1.5rem;
            color: var(--text-dark);
            margin: 50px 0 25px;
            padding-left: 15px;
            border-left: 5px solid var(--primary);
            font-weight: bold;
        }

        .trip-card {
            background: white;
            border-radius: 20px;
            box-shadow: 0 15px 35px rgba(100,100,111,0.1);
            margin-bottom: 40px;
            overflow: hidden;
            border: 1px solid #f0f0f0;
            position: relative;
        }

        .trip-header {
            padding: 25px 30px;
            border-bottom: 2px dashed #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #fffcfc;
        }

        .trip-title-group {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .trip-icon-large {
            font-size: 2.5rem;
        }

        .trip-header h2 {
            margin: 0;
            font-size: 1.8rem;
            color: var(--text-dark);
        }

        .trip-dates {
            color: #888;
            font-size: 0.95rem;
            margin-top: 5px;
            display: block;
        }

        .pnr-tag {
            background: #eee;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
            color: #666;
        }

        /* Timeline Styles */
        .trip-timeline {
            padding: 30px;
            position: relative;
        }

        /* Vertical Line */
        .trip-timeline::before {
            content: '';
            position: absolute;
            left: 108px; /* Adjust based on date width */
            top: 30px;
            bottom: 30px;
            width: 2px;
            background: #e0e0e0;
        }

        .timeline-item {
            display: flex;
            margin-bottom: 25px;
            position: relative;
        }

        .timeline-item:last-child {
            margin-bottom: 0;
        }

        .timeline-left {
            width: 85px;
            text-align: right;
            padding-right: 20px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .timeline-date {
            font-weight: bold;
            color: var(--text-dark);
        }
        
        .timeline-time {
            font-size: 0.8rem;
            color: #999;
        }

        .timeline-icon {
            width: 40px;
            height: 40px;
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            z-index: 2; /* Above line */
            margin-right: 20px;
            flex-shrink: 0;
        }

        /* Flight Type Specifics */
        .timeline-item.flight .timeline-icon {
            border-color: var(--flight-color);
            background: #e3f2fd;
            color: var(--flight-color);
        }

        /* Hotel Type Specifics */
        .timeline-item.hotel .timeline-icon {
            border-color: var(--hotel-color);
            background: #fff3e0;
            color: var(--hotel-color);
        }

        .timeline-content {
            background: #fdfdfd;
            border: 1px solid #eee;
            border-radius: 12px;
            padding: 15px;
            flex: 1;
            transition: transform 0.2s;
        }

        .timeline-content:hover {
            transform: translateX(5px);
            background: #fff;
            box-shadow: 0 5px 15px rgba(0,0,0,0.05);
        }

        .event-label {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .flight .event-label { color: var(--flight-color); }
        .hotel .event-label { color: var(--hotel-color); }

        .event-detail {
            font-size: 1.1rem;
            font-weight: bold;
            margin-bottom: 3px;
        }

        .event-sub {
            font-size: 0.9rem;
            color: #777;
        }

        .event-price {
            margin-top: 8px;
            font-size: 0.85rem;
            color: #aaa;
            background: #fafafa;
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
        }

        .trip-total {
            background: #f9f9f9;
            padding: 15px 30px;
            border-top: 1px solid #eee;
            display: flex;
            justify-content: flex-end;
            gap: 20px;
            font-weight: bold;
            color: #555;
            font-size: 0.9rem;
        }

        @media (max-width: 600px) {
            .trip-timeline::before { left: 24px; }
            .timeline-left { display: none; } /* Hide date on left on small screens */
            .timeline-content { position: relative; }
            .timeline-content::before { /* Add date inside content for mobile */
                content: attr(data-date);
                display: block;
                font-size: 0.8rem;
                color: #999;
                margin-bottom: 5px;
            }
            .timeline-icon { margin-right: 15px; }
        }
    </style>
</head>
<body>

<header>
    <h1>✈️ My Travel Diary</h1>
    <p>Every journey tells a story.</p>
</header>

<div class="container">

    <div class="section-title">🌟 即將出發 (Upcoming)</div>
    ${futureTrips.length > 0 ? futureTrips.map(generateTripCard).join('') : '<p style="text-align:center;color:#999;">目前沒有即將出發的行程</p>'}

    <div class="section-title">💭 精彩回憶 (Past)</div>
    ${pastTrips.length > 0 ? pastTrips.map(generateTripCard).join('') : '<p style="text-align:center;color:#999;">還沒有過去的旅程紀錄</p>'}

</div>

<div style="text-align:center; padding: 40px; color: #ccc; font-size: 0.8rem;">
    Generated by Travel AI Assistant
</div>

</body>
</html>
    `;

    fs.writeFileSync('d:/2025/AI/MongoDB/travel/index.html', htmlContent);
    console.log('Successfully generated Integrated Timeline Travel Diary!');

} catch (err) {
    console.error('Error:', err);
}
