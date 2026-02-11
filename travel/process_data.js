const xlsx = require('xlsx');

// Read workbook with cellDates to handle date conversion
const workbook = xlsx.readFile('d:/2025/AI/MongoDB/旅遊.xlsx', { cellDates: true });

function getRawData(sheetName) {
    if (!workbook.Sheets[sheetName]) return [];
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
}

const flightSheets = ['Ticket', '2025 Tikcet'];
const hotelSheets = ['2025 HOTEL', '2026 HOTEL'];

// 1. Process Flights
// Map PNR -> Trip
const trips = {};

flightSheets.forEach(sheetName => {
    const data = getRawData(sheetName);
    console.log(`Processing Flights from: ${sheetName}, rows: ${data.length}`);

    data.forEach(row => {
        // Skip if empty or header-like row inside data
        if (!row['訂位代號'] && !row['目的地']) return;
        if (row['目的地'] === '目的地') return;

        const pnr = row['訂位代號'] || `NO-PNR-${row['班機日期']}-${row['目的地']}`; // Fallback ID

        if (!trips[pnr]) {
            trips[pnr] = {
                id: pnr,
                type: 'flight',
                flights: [],
                hotels: [], // Will fill later
                price: 0 // Will accumulate max/sum
            };
        }

        // Price logic: if pnr is real, usually per ticket. Let's just store it and deciding display later.
        // Assuming price column is '票價'
        if (row['票價'] && typeof row['票價'] === 'number') {
            // Store the max found price for now (simple heuristic for "per person total" if repeated)
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

console.log(`Total Trips found from Flights: ${Object.keys(trips).length}`);

// 2. Process Hotels
const hotels = [];
hotelSheets.forEach(sheetName => {
    // For Hotel sheets, we need row-by-row because of the weird structure
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    // Get raw as array of arrays to handle custom structures
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', cellDates: true });
    console.log(`Processing Hotels from: ${sheetName}, total raw rows: ${rawRows.length}`);

    let currentHeaders = null;
    let headerRowIndex = -1;

    rawRows.forEach((row, idx) => {
        // Simple heuristic to detect header row: contains "入住日期" or "Check-in"
        const rowStr = JSON.stringify(row);
        if (rowStr.includes('入住日期') || rowStr.includes('Check-in')) {
            currentHeaders = row;
            headerRowIndex = idx;
            // console.log(`Found Hotel Headers at row ${idx}:`, currentHeaders);
            return; // Skip header row itself
        }

        if (currentHeaders && idx > headerRowIndex) {
            // Make object based on currentHeaders
            const hotelObj = {};
            let hasData = false;

            currentHeaders.forEach((key, colIdx) => {
                if (key && typeof key === 'string') {
                    const val = row[colIdx];
                    hotelObj[key.trim()] = val;
                    if (val) hasData = true;
                }
            });

            // Use the hotel object if valid
            if (hasData && (hotelObj['酒店'] || hotelObj['Hotel'])) {
                // Check if it has a date
                const checkIn = hotelObj['入住日期'] || hotelObj['Check-in'];
                if (checkIn) {
                    hotels.push({
                        name: hotelObj['酒店'] || hotelObj['Hotel'],
                        checkIn: checkIn,
                        checkOut: hotelObj['退房'] || hotelObj['Check-out'],
                        price: hotelObj['房價'] || hotelObj['Price'],
                        source: sheetName
                    });
                }
            }
        }
    });
});

console.log(`Total Hotels found: ${hotels.length}`);

// 3. Link Hotels to Trips
// Sort trips by date first
const tripList = Object.values(trips);
tripList.forEach(t => {
    t.flights.sort((a, b) => new Date(a.date) - new Date(b.date));
    t.startDate = t.flights[0]?.date;
    t.endDate = t.flights[t.flights.length - 1]?.date;
});

// For each hotel, try to find a trip it belongs to
hotels.forEach(h => {
    if (!h.checkIn) return;
    const hDate = new Date(h.checkIn);

    // Find trip where hDate is between startDate-2days and endDate+2days (buffer)
    // or just closest?
    let bestTrip = null;
    let minDiff = Infinity;

    tripList.forEach(t => {
        if (!t.startDate) return;
        const tStart = new Date(t.startDate);
        const tEnd = new Date(t.endDate || t.startDate);

        // Check overlap or proximity
        // A simple check: starts within the trip range?
        if (hDate >= new Date(tStart.getTime() - 86400000 * 2) &&
            hDate <= new Date(tEnd.getTime() + 86400000 * 2)) {
            bestTrip = t;
        }
    });

    if (bestTrip) {
        bestTrip.hotels.push(h);
    } else {
        // Maybe create a "Hotel Only" trip? Or just ignore for now?
        // User asked to include hotels. Let's create a dummy trip if it's significant.
        // For now, let's just log orphan hotels.
        // console.log('Orphan Hotel:', h.name, h.checkIn);
        // Create an "Accommodation Trip"
        const pnr = `HOTEL-TRIP-${h.checkIn}`;
        const newTrip = {
            id: pnr,
            type: 'hotel_only',
            mainDest: h.name, // Temporary
            startDate: h.checkIn,
            endDate: h.checkOut || h.checkIn,
            flights: [],
            hotels: [h],
            price: 0
        };
        // trips[pnr] = newTrip; // Optional: Enable to show hotel-only trips
    }
});

// Final Polish of Trips
const refinedTrips = tripList.map(t => {
    // Determine Destination
    if (t.flights.length > 0) {
        // Logic: Main dest is usually the '去' (outbound) flight's dest
        const outbound = t.flights.find(f => f.route === '去');
        t.mainDest = outbound ? outbound.dest : t.flights[0].dest;
    } else if (t.hotels.length > 0) {
        t.mainDest = t.hotels[0].name;
    }

    // Sort hotels by date
    t.hotels.sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
    return t;
});

// Output sample for verification
console.log('Sample Trip:', JSON.stringify(refinedTrips.find(t => t.hotels.length > 0) || refinedTrips[0], null, 2));

module.exports = { refinedTrips };
