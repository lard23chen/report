const ExcelJS = require('exceljs');
const fs = require('fs');

async function generateFeb2026() {
    console.log('Starting Feb 2026 generation...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx');

    const trips = [];
    const hotels = [];

    // --- Helper for Cell Values ---
    function getVal(cell) {
        let val = cell.value;
        if (val && typeof val === 'object') {
            if (val.richText) {
                val = val.richText.map(t => t.text).join('');
            } else if (val.text) {
                // Sometimes hyperlink objects have 'text' property
                val = val.text;
            }
        }
        return val ? String(val).trim() : '';
    }

    // --- 1. Process Flights (2026 Tikcet) ---
    const tSheet = workbook.worksheets.find(s => s.name.includes('2026'));
    if (tSheet) {
        console.log(`Processing Flight Sheet: ${tSheet.name}`);

        // Manual Map for this specific sheet based on debug
        // Row 1 is header: 目的地, ROUTE, 班機日期...
        // But let's scan rows for data in Feb 2026

        tSheet.eachRow((row, rowNumber) => {
            // Check if this row has a date in Feb 2026
            let date = null;
            let dest = null;
            let flightNo = null;
            let route = null;
            let price = 0;

            row.eachCell((cell, col) => {
                const val = cell.value;
                if (val instanceof Date) {
                    if (val.getFullYear() === 2026 && val.getMonth() === 1) { // Month is 0-indexed, 1 = Feb
                        date = val;
                    }
                } else if (typeof val === 'string') {
                    // Try to PARSE string dates if Excel didn't parse them
                    if (val.includes('2026') && (val.includes('/02/') || val.includes('-02-'))) {
                        const d = new Date(val);
                        if (!isNaN(d.getTime()) && d.getMonth() === 1) date = d;
                    }
                }
            });

            if (date) {
                // We found a row with Feb 2026 date. Let's extract other info.
                // Based on previous debug:
                // Col 1 or 2 is Dest
                // Col 2 or 3 is Route
                // Col 5 or 6 is FlightNo

                row.eachCell((cell, col) => {
                    const v = getVal(cell);
                    if (['BKK', 'TPE', 'NRT', 'KIX'].some(c => v.includes(c))) dest = v;
                    if (['去', '回', 'ROUTE'].some(r => v.includes(r))) route = v;
                    if (v.match(/^[A-Z0-9]{2,}\s?\d{3,4}$/) || v.includes('JX') || v.includes('CI') || v.includes('BR')) flightNo = v;

                    // Price is usually a number
                    if (typeof cell.value === 'number' && cell.value > 1000) price = cell.value;
                });

                // Ignore if struck through
                let isStrike = false;
                row.eachCell(c => { if (c.font && c.font.strike) isStrike = true; });

                if (!isStrike && dest) {
                    trips.push({
                        date: date,
                        dest: dest,
                        route: route,
                        flightNo: flightNo,
                        price: price,
                        raw: row.values
                    });
                }
            }
        });
    }

    console.log(`Found ${trips.length} flight legs for Feb 2026.`);

    // --- 2. Process Hotels (2026 HOTEL) ---
    const hSheet = workbook.worksheets.find(s => s.name.includes('2026 HOTEL'));
    if (hSheet) {
        console.log(`Processing Hotel Sheet: ${hSheet.name}`);

        // Persist date context across rows
        let currentCheckIn = null;
        let currentCheckOut = null;

        hSheet.eachRow((row, i) => {
            let hName = null;
            let hCheckIn = null;
            let hCheckOut = null;
            let hPrice = null;

            // Simplified Scan: Check every cell in the row
            row.eachCell((cell, col) => {
                const val = cell.value;
                const vStr = getVal(cell);

                // 1. Detect Check-In Date (Feb 2026)
                let dateVal = null;
                if (val instanceof Date) dateVal = val;
                else if (typeof vStr === 'string' && (vStr.includes('2026/02') || vStr.includes('2026-02'))) {
                    const match = vStr.match(/2026[\/-]0?2[\/-](\d{1,2})/);
                    if (match) {
                        dateVal = new Date(2026, 1, parseInt(match[1]));
                    }
                }

                if (dateVal && dateVal.getFullYear() === 2026 && dateVal.getMonth() === 1) {
                    // Update global context
                    if (!currentCheckIn || dateVal < currentCheckIn || (dateVal - currentCheckIn > 86400000 * 20)) {
                        currentCheckIn = dateVal;
                        currentCheckOut = null;
                    } else if (dateVal > currentCheckIn) {
                        currentCheckOut = dateVal;
                    }
                }

                // 2. Detect Hotel Name (Long string, not date, has Hotel keyword or just long text in specific col range)
                // Based on previous debug, looks like Hotel name is often first or second non-empty string
                if (!hName && vStr.length > 5 && !vStr.match(/2026/) && !vStr.includes('入住') && !vStr.includes(':') && isNaN(Date.parse(vStr))) {
                    console.log(`Checking string: ${vStr}`);
                    // Check if it looks like a hotel name?
                    if (vStr.includes('Hotel') || vStr.includes('酒店') || vStr.includes('Suites') || vStr.includes('曼谷')) {
                        hName = vStr;
                        console.log(' Matched Name:', hName);
                    }
                }

                // 3. Price
                if (typeof val === 'number' && val > 500 && val < 1000000) hPrice = val;
            });

            // Check Strikethrough
            let isStrike = false;
            row.eachCell(c => { if (c.font && c.font.strike) isStrike = true; });

            // Use persist context
            if (currentCheckIn && hName && !isStrike) {
                const checkOut = currentCheckOut || currentCheckIn;

                const exists = hotels.find(h => h.name === hName && h.checkIn.getTime() === currentCheckIn.getTime());

                if (!exists) {
                    hotels.push({
                        name: hName,
                        checkIn: currentCheckIn,
                        checkOut: checkOut,
                        price: hPrice
                    });
                }
            }
        });
    }

    console.log(`Found ${hotels.length} hotels for Feb 2026.`);
    hotels.forEach(h => console.log(` - ${h.name} (${fmtDate(h.checkIn)})`));

    // --- 3. Construct Single Trip Object (First Round Trip Only) ---
    if (trips.length === 0) {
        console.log('No trips found for Feb 2026.');
        return;
    }

    // Sort flights by date
    trips.sort((a, b) => a.date - b.date);

    console.log('--- All Flights ---');
    trips.forEach(t => console.log(`${fmtDate(t.date)} ${t.route} ${t.dest}`));
    console.log('-------------------');

    // Find first '去' (Outbound)
    // Simplified Round Trip Logic: Earliest is Out, Latest is Back (if dates differ)
    // Avoid relying on unicode string matching if console shows ???
    const firstOutbound = trips[0];
    let firstReturn = null;

    // Find last flight with different date
    if (trips.length > 1) {
        const lastFlight = trips[trips.length - 1];
        if (lastFlight.date > firstOutbound.date) {
            firstReturn = lastFlight;
        }
    }

    const finalFlights = [firstOutbound];
    if (firstReturn) {
        finalFlights.push(firstReturn);
    }

    // Set proper labels manually for the UI
    firstOutbound.overrideTitle = '去程 (Outbound)';
    if (firstReturn) firstReturn.overrideTitle = '回程 (Return)';

    const startDate = firstOutbound.date;
    const endDate = firstReturn ? firstReturn.date : startDate; // Fallback if no return

    // (Redundant logic removed)

    console.log(`Selected Trip: ${fmtDate(startDate)} to ${fmtDate(endDate)}`);

    // Filter hotels to strictly within this range (plus buffer)
    const finalHotels = hotels.filter(h => {
        // Buffer: checkIn >= start - 5 days AND checkIn <= end + 2 days
        // Sometimes hotel booked earlier or later?
        const s = new Date(startDate); s.setDate(s.getDate() - 5);
        const e = new Date(endDate); e.setDate(e.getDate() + 2);
        return h.checkIn >= s && h.checkIn <= e;
    });

    // Group into a Trip object
    const mainTrip = {
        title: `🇹🇭 曼谷 (Bangkok) - Feb 2026`,
        startDate: startDate,
        endDate: endDate,
        flights: finalFlights,
        hotels: finalHotels,
        totalPrice: finalFlights.reduce((acc, t) => acc + (t.price || 0), 0) + finalHotels.reduce((acc, h) => acc + (typeof h.price === 'number' ? h.price : 0), 0)
    };

    // Derive destination name from first flight
    if (mainTrip.flights[0].dest.includes('BKK')) mainTrip.title = '🇹🇭 曼谷 (Bangkok)';
    else if (mainTrip.flights[0].dest.includes('NRT')) mainTrip.title = '🇯🇵 東京 (Tokyo)';

    // --- 4. Generate HTML ---
    function fmtDate(d) {
        if (!d) return '';
        if (typeof d === 'string') d = new Date(d);
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    }

    function fmtTime(d) {
        if (!d) return '';
        if (typeof d === 'string') d = new Date(d);
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
    }

    // Combine events
    const events = [];
    mainTrip.flights.forEach(f => {
        events.push({
            date: f.date,
            type: 'flight',
            icon: (f.overrideTitle && f.overrideTitle.includes('去')) || (f.route && f.route.includes('去')) ? '🛫' : '🛬',
            title: f.overrideTitle || (f.route.includes('去') ? '出發 (Departure)' : '返程 (Return)'),
            desc: `${f.flightNo} ➔ ${f.dest}`,
            price: f.price
        });
    });
    mainTrip.hotels.forEach(h => {
        events.push({
            date: h.checkIn,
            type: 'hotel',
            icon: '🏨',
            title: '入住 (Check-in)',
            desc: h.name,
            sub: `${fmtDate(h.checkIn)} - ${fmtDate(h.checkOut)}`,
            price: h.price
        });
    });

    events.sort((a, b) => a.date - b.date);

    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>2026 Feb Travel</title>
    <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Zen Maru Gothic', sans-serif; background: #e0f7fa; padding: 40px; }
        .card { background: white; max-width: 600px; margin: 0 auto; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #4dd0e1, #80deea); padding: 30px; color: white; text-align: center; }
        .header h1 { margin: 0; font-size: 2rem; }
        .period { opacity: 0.9; margin-top: 5px; }
        .timeline { padding: 30px; }
        .item { display: flex; margin-bottom: 25px; align-items: flex-start; }
        .date-col { width: 60px; text-align: right; padding-right: 15px; color: #555; font-weight: bold; }
        .time { font-size: 0.8rem; color: #888; font-weight: normal; }
        .icon-col { font-size: 1.5rem; width: 40px; text-align: center; margin-top: -5px; }
        .info-col { flex: 1; border-left: 2px solid #eee; padding-left: 15px; padding-bottom: 10px; }
        .title { font-weight: bold; color: #37474f; }
        .desc { color: #00838f; font-size: 1.1rem; margin: 2px 0; }
        .sub { font-size: 0.85rem; color: #78909c; }
        .item:last-child .info-col { border-left: none; }
        .footer { background: #f5f5f5; padding: 15px; text-align: center; color: #888; font-size: 0.9rem; }
    </style>
</head>
<body>

    <div class="card">
        <div class="header">
            <h1>${mainTrip.title}</h1>
            <div class="period">${fmtDate(mainTrip.startDate)} ➔ ${fmtDate(mainTrip.endDate)}</div>
        </div>

        <div class="timeline">
            ${events.map(e => `
            <div class="item">
                <div class="date-col">
                    <div>${e.date.getDate()} <span style="font-size:0.7rem">Feb</span></div>
                    <div class="time">${fmtTime(e.date)}</div>
                </div>
                <div class="icon-col">${e.icon}</div>
                <div class="info-col">
                    <div class="title">${e.title}</div>
                    <div class="desc">${e.desc}</div>
                    ${e.sub ? `<div class="sub">${e.sub}</div>` : ''}
                </div>
            </div>
            `).join('')}
        </div>

        <div class="footer">
            2026 Lunar New Year Trip 🧧
        </div>
    </div>

</body>
</html>
    `;

    fs.writeFileSync('d:/2025/AI/MongoDB/travel/travel_index.html', html);
    console.log('Successfully created travel_index.html for Feb 2026!');
}

generateFeb2026().catch(console.error);
