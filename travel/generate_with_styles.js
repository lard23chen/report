const ExcelJS = require('exceljs');
const fs = require('fs');

async function processData() {
    const workbook = new ExcelJS.Workbook();
    // Read the file (exceljs uses async read)
    await workbook.xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx');

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

    const trips = {};
    const hotels = [];

    // --- Helper to check strikethrough ---
    function isStruckThrough(cell) {
        if (!cell || !cell.font) return false;
        return !!cell.font.strike;
    }

    // --- 1. Process Flights (Tickets) ---
    workbook.eachSheet((sheet, id) => {
        if (/ticket|tikcet/i.test(sheet.name)) {
            console.log(`Processing Flight Sheet: ${sheet.name}`);

            // Scan for header row
            let headerRowIndex = -1;
            let headers = {};

            sheet.eachRow((row, rowNumber) => {
                if (headerRowIndex !== -1) return; // Already found

                let hasDate = false;
                let hasRoute = false;

                row.eachCell((cell, colNumber) => {
                    const val = String(cell.value).trim();
                    if (val.includes('班機日期') || val.includes('Date')) hasDate = true;
                    if (val.includes('ROUTE') || val.includes('Route')) hasRoute = true;
                });

                if (hasDate || hasRoute) {
                    headerRowIndex = rowNumber;
                    row.eachCell((cell, colNumber) => {
                        headers[colNumber] = String(cell.value).trim();
                    });
                    console.log(`Found Headers on Row ${rowNumber}:`, JSON.stringify(headers));
                }
            });

            if (headerRowIndex === -1) {
                // Fallback to row 1 if detection fails
                headerRowIndex = 1;
                sheet.getRow(1).eachCell((cell, colNumber) => {
                    headers[colNumber] = String(cell.value).trim();
                });
            }

            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header

                // Check critical cell (e.g. Flight Num or PNR) for strikethrough
                // Usually if PNR is struck, the whole booking is cancelled.
                // Let's check '訂位代號' column if we can map it.
                // Or just check if ANY of the main cells are struck?
                // Or check the first cell? Let's assume row-level or key cell level.

                let pnr = null;
                let dest = null;
                let date = null;
                let route = null;
                let price = null;
                let flightNo = null;

                let isCancelled = false;

                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber];

                    // Fallback for destination logic if header is weird (e.g. 2026 sheet)
                    if (!header && colNumber === 1 && headers[2] && headers[2].includes('ROUTE')) {
                        // Assuming col 1 is Dest if Col 2 is Route, even if Header 1 is weird title
                        dest = cell.value;
                    }

                    if (!header) return;

                    // Check for strikethrough on important fields
                    if (['訂位代號', '班機號碼', '目的地'].some(k => header.includes(k)) && isStruckThrough(cell)) {
                        isCancelled = true;
                    }

                    if (header.includes('訂位代號')) pnr = cell.value;
                    if (header.includes('目的地') || header.includes('Destination')) dest = cell.value;
                    if (header.includes('班機日期') || header.includes('Date')) date = cell.value;
                    if (header.includes('ROUTE') || header.includes('Route')) route = cell.value;
                    if (header.includes('票價') || header.includes('Price')) price = cell.value;
                    if (header.includes('班機號碼') || header.includes('Flight')) flightNo = cell.value;
                });

                // Extra fallback if dest is still null but we have ROUTE at col 2
                if (!dest && route && row.getCell(1).value && typeof row.getCell(1).value === 'string') {
                    // Check if looks like a code?
                    const possibleDest = String(row.getCell(1).value).trim();
                    if (possibleDest.length === 3) dest = possibleDest;
                }

                if (isCancelled) return; // Skip struck rows
                if (!pnr && !dest) return;

                // Format date if needed
                if (typeof date === 'string') date = new Date(date);
                if (!date || !(date instanceof Date) || isNaN(date.getTime()) || date < new Date('2000-01-01')) return;

                const pnrKey = pnr || `NO-PNR-${date.toISOString().split('T')[0]}`;

                if (!trips[pnrKey]) {
                    trips[pnrKey] = {
                        id: pnrKey,
                        flights: [],
                        hotels: [],
                        price: 0
                    };
                }

                if (price && typeof price === 'number') {
                    if (price > trips[pnrKey].price) trips[pnrKey].price = price;
                }

                trips[pnrKey].flights.push({
                    dest: dest,
                    route: route,
                    date: date,
                    flightNo: flightNo
                });
            });
        }
    });

    // Sort flights and determine dates
    Object.values(trips).forEach(t => {
        t.flights.sort((a, b) => a.date - b.date);
        t.startDate = t.flights[0]?.date;
        t.endDate = t.flights[t.flights.length - 1]?.date;

        const outbound = t.flights.find(f => f.route === '去');
        const mainCode = outbound ? outbound.dest : t.flights[0]?.dest;
        t.mainDestName = destMap[mainCode] || mainCode || (mainCode ? mainCode : 'Unknown Trip');
    });

    // --- 2. Process Hotels ---
    workbook.eachSheet((sheet, id) => {
        if (/hotel/i.test(sheet.name)) {
            console.log(`Processing Hotel Sheet: ${sheet.name}`);

            // Hotels often have complex headers (row 2 or 3). Let's scan for header row.
            // Simplified: Iterate until we find "入住日期" or "Check-in"
            let headerRowIndex = -1;
            const headers = {};

            sheet.eachRow((row, rowNumber) => {
                if (headerRowIndex !== -1 && rowNumber > headerRowIndex) {
                    // Data Row
                    let hName = null;
                    let hCheckIn = null;
                    let hCheckOut = null;
                    let hPrice = null;
                    let isCancelled = false;

                    row.eachCell((cell, colNumber) => {
                        const header = headers[colNumber];
                        if (['酒店', 'Hotel', '入住日期', 'Check-in'].includes(header) && isStruckThrough(cell)) {
                            isCancelled = true;
                        }

                        if (header === '酒店' || header === 'Hotel') hName = cell.value;
                        if (header === '入住日期' || header === 'Check-in') hCheckIn = cell.value;
                        if (header === '退房' || header === 'Check-out') hCheckOut = cell.value;
                        if (header === '房價' || header === 'Price') hPrice = cell.value;
                    });

                    if (!isCancelled && hName && hCheckIn) {
                        // Date parsing if needed
                        if (typeof hCheckIn === 'string') hCheckIn = new Date(hCheckIn);
                        if (hCheckIn > new Date('2000-01-01')) {
                            hotels.push({
                                name: hName,
                                checkIn: hCheckIn,
                                checkOut: hCheckOut,
                                price: hPrice
                            });
                        }
                    }
                    return;
                }

                // Header Detection
                let isHeader = false;
                row.eachCell((cell, colNumber) => {
                    let val = cell.value;
                    if (val && val.richText) {
                        val = val.richText.map(t => t.text).join('');
                    }
                    val = String(val).trim();
                    if (val.includes('入住日期') || val.includes('Check-in')) {
                        isHeader = true;
                    }
                });

                if (isHeader) {
                    headerRowIndex = rowNumber;
                    row.eachCell((cell, colNumber) => {
                        let val = cell.value;
                        if (val && val.richText) val = val.richText.map(t => t.text).join('');
                        headers[colNumber] = String(val).trim();
                    });
                }
            });
        }
    });

    console.log(`Total Hotels Found (Active): ${hotels.length}`);

    // --- 3. Link Hotels to Trips (Strict Range) ---
    hotels.forEach(h => {
        const hDate = new Date(h.checkIn);
        let assigned = false;

        Object.values(trips).forEach(t => {
            if (!t.startDate || assigned) return;

            // Allow 3 days buffer
            const tStart = new Date(t.startDate); tStart.setDate(tStart.getDate() - 3);
            const tEnd = new Date(t.endDate || t.startDate); tEnd.setDate(tEnd.getDate() + 3);

            if (hDate >= tStart && hDate <= tEnd) {
                t.hotels.push(h);
                assigned = true;
            }
        });

        // If unassigned, we ignore it as per user request to "focus on tickets"
        if (!assigned) {
            console.log(`Orphan Hotel (Ignored): ${h.name} on ${formatDate(h.checkIn)}`);
        }
    });

    // --- 4. Generate HTML ---
    // (Similar HTML generation logic)
    const sortedTrips = Object.values(trips).sort((a, b) => new Date(b.startDate) - new Date(a.startDate)); // Newest first
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureTrips = sortedTrips.filter(t => new Date(t.endDate || t.startDate) >= today);
    const pastTrips = sortedTrips.filter(t => new Date(t.endDate || t.startDate) < today);
    futureTrips.sort((a, b) => new Date(a.startDate) - new Date(b.startDate)); // Future: Ascending

    function formatDate(d) {
        if (!d) return '';
        if (typeof d === 'string') d = new Date(d);
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    }

    // HTML Template
    const html = `
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
            --flight-color: #3da9fc;
            --hotel-color: #ff9f1c;
        }
        body { font-family: 'Zen Maru Gothic', sans-serif; background: #FAFAFA; color: var(--text-dark); margin:0; padding:20px; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { text-align: center; color: #ff8a65; margin: 40px 0; }
        .section-title { font-size: 1.5rem; border-left: 5px solid var(--primary); padding-left: 15px; margin: 40px 0 20px; }
        
        .trip-card { background: white; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.05); margin-bottom: 30px; overflow: hidden; border: 1px solid #eee; }
        .trip-header { background: #fffcfc; padding: 20px; border-bottom: 2px dashed #eee; display: flex; justify-content: space-between; align-items: center; }
        .trip-header h2 { margin: 0; font-size: 1.4rem; }
        .trip-dates { color: #888; font-size: 0.9rem; }
        
        /* Timeline */
        .timeline { padding: 20px; position: relative; }
        .timeline::before { content: ''; position: absolute; left: 90px; top: 20px; bottom: 20px; width: 2px; background: #eee; }
        .t-item { display: flex; margin-bottom: 20px; position: relative; }
        .t-date { width: 70px; text-align: right; padding-right: 20px; font-weight: bold; font-size: 0.9rem; color: #555; }
        .t-icon { width: 30px; height: 30px; background: white; border: 2px solid #ccc; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 2; margin-right: 15px; flex-shrink: 0; }
        .t-content { flex: 1; background: #fdfdfd; padding: 10px 15px; border-radius: 10px; border: 1px solid #eee; }
        
        .type-flight .t-icon { border-color: var(--flight-color); color: var(--flight-color); background: #e3f2fd; }
        .type-hotel .t-icon { border-color: var(--hotel-color); color: var(--hotel-color); background: #fff3e0; }
        
        .t-title { font-weight: bold; margin-bottom: 4px; }
        .t-sub { font-size: 0.85rem; color: #777; }
        
        .trip-footer { padding: 15px 20px; background: #fafafa; border-top: 1px solid #eee; text-align: right; font-size: 0.9rem; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✈️ My Travel Diary</h1>
        
        <div class="section-title">🌟 即將出發 (Upcoming)</div>
        ${futureTrips.length ? futureTrips.map(renderTrip).join('') : '<p style="text-align:center;color:#999">No upcoming trips.</p>'}
        
        <div class="section-title">💭 精彩回憶 (Past)</div>
        ${pastTrips.length ? pastTrips.map(renderTrip).join('') : '<p style="text-align:center;color:#999">No past trips.</p>'}
    </div>
</body>
</html>
    `;

    function renderTrip(trip) {
        const events = [];
        trip.flights.forEach(f => events.push({
            date: new Date(f.date),
            type: 'flight',
            icon: f.route === '去' ? '🛫' : (f.route === '回' ? '🛬' : '✈️'),
            title: `${f.route === '去' ? '出發' : '返程'} - ${f.flightNo}`,
            desc: `${destMap[f.dest] || f.dest} (${f.aircraft || ''})`
        }));
        trip.hotels.forEach(h => events.push({
            date: new Date(h.checkIn),
            type: 'hotel',
            icon: '🏨',
            title: `入住: ${h.name}`,
            desc: `${formatDate(h.checkIn)} - ${formatDate(h.checkOut)}`
        }));

        events.sort((a, b) => a.date - b.date);

        return `
        <div class="trip-card">
            <div class="trip-header">
                <div>
                    <h2>${trip.mainDestName}</h2>
                    <div class="trip-dates">${formatDate(trip.startDate)} ➜ ${formatDate(trip.endDate)}</div>
                </div>
                <span style="background:#eee; padding:4px 10px; border-radius:10px; font-size:0.8rem;">${trip.id.split('-').slice(0, 2).join('-')}</span>
            </div>
            <div class="timeline">
                ${events.map(e => `
                <div class="t-item type-${e.type}">
                    <div class="t-date">${formatDate(e.date)}</div>
                    <div class="t-icon">${e.icon}</div>
                    <div class="t-content">
                        <div class="t-title">${e.title}</div>
                        <div class="t-sub">${e.desc}</div>
                    </div>
                </div>
                `).join('')}
            </div>
            <div class="trip-footer">
                ${trip.price ? `機票: $${trip.price.toLocaleString()} ` : ''}
                ${trip.hotels.length ? `• 住宿: ${trip.hotels.length} 間` : ''}
            </div>
        </div>
        `;
    }

    fs.writeFileSync('d:/2025/AI/MongoDB/travel/index.html', html);
    console.log('Done!');
}

processData().catch(err => console.error(err));
