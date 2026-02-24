const fs = require('fs');

function parseCSV(content) {
    const result = [];
    let inQuotes = false;
    let currentString = '';
    let row = [];
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '"') {
            if (inQuotes && content[i + 1] === '"') {
                currentString += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(currentString);
            currentString = '';
        } else if ((char === '\n' || (char === '\r' && content[i + 1] === '\n')) && !inQuotes) {
            if (char === '\r') i++; // skip \n
            row.push(currentString);
            currentString = '';
            // Only push if row has data
            if (row.length > 1 || row[0] !== '') {
                result.push(row);
            }
            row = [];
        } else {
            currentString += char;
        }
    }
    if (currentString || row.length > 0) {
        row.push(currentString);
        if (row.length > 1 || row[0] !== '') result.push(row);
    }
    return result;
}

const flightData = parseCSV(fs.readFileSync('d:/2025/AI/MongoDB/travel/bkk_trip.csv', 'utf8'));
const hotelData = parseCSV(fs.readFileSync('d:/2025/AI/MongoDB/travel/hotels.csv', 'utf8'));

const trips = [];
let currentTrip = null;

// Parse Flights
for (let i = 0; i < flightData.length; i++) {
    const row = flightData[i];
    if (row[0] && typeof row[0] === 'string' && row[0].startsWith('2026') && row.filter(x => x).length === 1) {
        currentTrip = {
            title: row[0],
            flights: [],
            hotels: [],
            startDate: '',
            endDate: ''
        };
        trips.push(currentTrip);
    } else if (currentTrip && (row[1] === 'GO' || row[1] === 'BACK' || (row[0] && row[0] !== '目的地' && !row[0].startsWith('2026')) || (row[1] && row[1] !== 'ROUTE'))) {
        // Data row
        if (!row[1] && !row[0]) continue;
        const route = row[1];
        if (route === 'GO' || route === 'BACK') {
            currentTrip.flights.push({
                dest: row[0],
                route: route,
                date: row[2], // 班機日期
                time: row[3], // 抵達時間
                flightNo: row[4], // 班機號碼
                aircraft: row[6], // 機型
                payerInfo: row[8], // 支付方式
                price: row[9] // 實際票價
            });
        }
    }
}

// Ensure trips have nice titles and find dates
trips.forEach(t => {
    const m = t.title.match(/(20\d{6})-(20\d{6}|\d{7})/);
    if (m) {
        let sd = m[1];
        let ed = m[2];
        if (ed.length === 7 && ed.startsWith('20260')) ed = ed.replace('20260', '20260');
        t.dateRange = `${sd.substr(0, 4)}/${sd.substr(4, 2)}/${sd.substr(6, 2)} - ${ed.length === 8 ? ed.substr(0, 4) + '/' + ed.substr(4, 2) + '/' + ed.substr(6, 2) : ed}`;
    } else {
        t.dateRange = '2026';
    }
    t.displayTitle = t.title.split(' ').slice(1).join(' ').trim();
    if (!t.displayTitle) t.displayTitle = t.title;
});

// Parse Hotels
let currentHotelTrip = null;
for (let i = 0; i < hotelData.length; i++) {
    const row = hotelData[i];
    if (row[0] && row[0].startsWith('2026') && row[0].includes('BKK') && row.filter(x => x).length === 1) {
        const m = row[0].match(/2026\/(\d{2})/);
        if (m) {
            currentHotelTrip = trips.find(t => t.title.includes(`2026${m[1]}`));
        }
    } else if (currentHotelTrip && row[0] && row[0] !== '酒店') {
        currentHotelTrip.hotels.push({
            name: row[0],
            chain: row[1],
            checkIn: row[2],
            checkOut: row[3],
            payment: row[4],
            price: row[5],
            cancel: row[6],
            note: row[7]
        });
    }
}

// Convert to HTML
let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>我的所有旅遊行程 - 2026 Tikcet</title>
    <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Zen Maru Gothic', sans-serif; background: #f0f4f8; padding: 40px; color: #333; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { text-align: center; color: #2c3e50; margin-bottom: 40px; }
        .trip-card { background: white; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 40px; overflow: hidden; }
        .trip-header { background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
        .trip-header h2 { margin: 0; font-size: 1.5rem; }
        .trip-date { opacity: .9; font-size: .9rem; }
        .timeline { padding: 30px; }
        .event { display: flex; margin-bottom: 20px; align-items: flex-start; }
        .event-date { width: 120px; font-weight: 700; color: #7f8c8d; font-size: .9rem; padding-top: 3px; }
        .event-icon { width: 40px; text-align: center; font-size: 1.2rem; margin-right: 15px; }
        .event-content { flex: 1; border-left: 2px solid #ecf0f1; padding-left: 20px; padding-bottom: 10px; }
        .event:last-child .event-content { border-left: none; }
        .event-title { font-weight: 700; color: #34495e; }
        .event-desc { color: #7f8c8d; font-size: .9rem; margin-top: 4px; }
        .price { color: #e67e22; font-weight: 700; font-size: .8rem; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✈️ 我的所有旅遊行程 (2026 Ticket)</h1>`;

trips.forEach(trip => {
    html += `
        <div class="trip-card">
            <div class="trip-header">
                <h2>${trip.displayTitle}</h2>
                <div class="trip-date">${trip.dateRange}</div>
            </div>
            <div class="timeline">`;
    const allEvents = [];

    trip.flights.forEach(f => {
        const isGo = f.route === 'GO';
        const rawDate = f.date || '';
        let sortDateNum = isGo ? 1 : Number.MAX_SAFE_INTEGER;
        let dMatch = rawDate.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
        if (dMatch) {
            sortDateNum = new Date(dMatch[1], parseInt(dMatch[2]) - 1, dMatch[3], dMatch[4] || 0, dMatch[5] || 0).getTime();
        }

        allEvents.push({
            type: 'flight',
            sortDate: sortDateNum,
            html: `
                <div class="event">
                    <div class="event-date">${f.date || ''}</div>
                    <div class="event-icon">✈️</div>
                    <div class="event-content">
                        <div class="event-title">${f.route} ${f.flightNo || ''}</div>
                        <div class="event-desc">
                            機型: ${f.aircraft || ''}<br>
                            抵達時間: ${f.time || ''}<br>
                            ${f.payerInfo ? `支付: ${f.payerInfo.replace(/\n/g, '<br>')}` : ''}
                        </div>
                        ${f.price ? `<div class="price">${f.price}</div>` : ''}
                    </div>
                </div>`
        });
    });

    trip.hotels.forEach(h => {
        let rawDate = h.checkIn || '';
        let dMatch = rawDate.match(/(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})/);
        let year = 2026;
        let month = 1, day = 1;
        if (dMatch) {
            if (dMatch[1]) year = parseInt(dMatch[1]);
            else {
                let tyMatch = trip.title.match(/(20\d{2})/);
                if (tyMatch) year = parseInt(tyMatch[1]);
            }
            month = parseInt(dMatch[2]);
            day = parseInt(dMatch[3]);
        }
        let sortDateNum = new Date(year, month - 1, day, 14, 0).getTime(); // assuming 14:00 hotel check-in for sorting
        let displayDate = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;

        let outMatch = (h.checkOut || '').match(/(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})/);
        let outDisplay = h.checkOut;
        if (outMatch) outDisplay = `${outMatch[1] || year}/${String(outMatch[2]).padStart(2, '0')}/${String(outMatch[3]).padStart(2, '0')}`;

        allEvents.push({
            type: 'hotel',
            sortDate: sortDateNum,
            html: `
                <div class="event">
                    <div class="event-date">${displayDate}</div>
                    <div class="event-icon">🏨</div>
                    <div class="event-content">
                        <div class="event-title">入住飯店</div>
                        <div class="event-desc">
                            ${h.name}<br>
                            <small>${displayDate} - ${outDisplay}</small><br>
                            體系: ${h.chain} | 支付: ${h.payment}<br>
                            ${h.cancel ? `免費取消: ${h.cancel.replace(/\n/g, '<br>')}<br>` : ''}
                            ${h.note ? `備註: ${h.note.replace(/\n/g, '<br>')}` : ''}
                        </div>
                        ${h.price ? `<div class="price">${h.price}</div>` : ''}
                    </div>
                </div>`
        });
    });

    // Sort by ascending timestamp
    allEvents.sort((a, b) => a.sortDate - b.sortDate);

    allEvents.forEach(e => html += e.html);

    html += `
            </div>
        </div>`;
});

html += `
    </div>
</body>
</html>`;

fs.writeFileSync('d:/2025/AI/MongoDB/travel/travel_index.html', html, 'utf8');
console.log('Successfully generated travel_index.html with ALL trips from 2026 Ticket.');
