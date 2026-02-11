const ExcelJS = require('exceljs');
const fs = require('fs');

async function generateAllTravel() {
    console.log('Starting All-Travel generation...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('d:/2025/AI/MongoDB/旅遊_1.xlsx');

    let allFlightLegs = [];
    let allHotels = [];

    function getVal(cell) {
        let val = cell.value;
        if (val && typeof val === 'object') {
            if (val.richText) val = val.richText.map(t => t.text).join('');
            else if (val.text) val = val.text;
        }
        return val ? String(val).trim() : '';
    }

    function fmtDate(d) {
        if (!d) return '';
        if (typeof d === 'string') d = new Date(d);
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    }

    // 1. Scan Sheets
    for (const sheet of workbook.worksheets) {
        const name = sheet.name.toUpperCase();
        if (name.includes('TICKET') || name.includes('TIKCET')) {
            sheet.eachRow((row) => {
                let date = null;
                row.eachCell((cell) => {
                    const val = cell.value;
                    if (val instanceof Date) date = val;
                    else if (typeof val === 'string' && val.match(/\d{4}\/\d{1,2}\/\d{1,2}/)) {
                        const d = new Date(val);
                        if (!isNaN(d.getTime())) date = d;
                    }
                });
                if (date) {
                    let dest = '', route = '', flightNo = '', price = 0;
                    row.eachCell((cell) => {
                        const v = getVal(cell);
                        if (!dest && v.length >= 2 && v.length <= 20 && !v.includes('20') && !v.includes(':') && !v.match(/^\d+$/)) dest = v;
                        if (['去', '回', 'ROUTE'].some(r => v.includes(r))) route = v;
                        if (v.match(/^[A-Z0-9]{2,}\s?\d{3,4}$/)) flightNo = v;
                        if (typeof cell.value === 'number' && cell.value > 1000) price = cell.value;
                    });
                    let strike = false;
                    row.eachCell(c => { if (c.font && c.font.strike) strike = true; });
                    if (!strike) allFlightLegs.push({ date, dest: dest || '未知地點', route, flightNo, price });
                }
            });
        }
        if (name.includes('HOTEL')) {
            let curCheckIn = null, curCheckOut = null;
            sheet.eachRow((row) => {
                let hName = null, hPrice = null;
                row.eachCell((cell) => {
                    const val = cell.value, vStr = getVal(cell);
                    let dateVal = null;
                    if (val instanceof Date) dateVal = val;
                    else if (typeof vStr === 'string' && vStr.match(/\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/)) {
                        const m = vStr.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
                        if (m) dateVal = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
                    }
                    if (dateVal) {
                        if (!curCheckIn || Math.abs(dateVal - curCheckIn) > 86400000 * 20) { curCheckIn = dateVal; curCheckOut = null; }
                        else if (dateVal > curCheckIn) curCheckOut = dateVal;
                    }
                    if (!hName && vStr.length > 4 && !vStr.includes('20') && !vStr.includes(':') && !vStr.includes('入住') && isNaN(Date.parse(vStr))) {
                        if (['HOTEL', '酒店', 'SUITES', 'RESORT', '曼谷', '東京', '日本'].some(k => vStr.toUpperCase().includes(k))) hName = vStr;
                    }
                    if (typeof val === 'number' && val > 500 && val < 500000) hPrice = val;
                });
                let strike = false;
                row.eachCell(c => { if (c.font && c.font.strike) strike = true; });
                if (curCheckIn && hName && !strike) {
                    const exists = allHotels.find(h => h.name === hName && h.checkIn.getTime() === curCheckIn.getTime());
                    if (!exists) allHotels.push({ name: hName, checkIn: curCheckIn, checkOut: curCheckOut || curCheckIn, price: hPrice });
                }
            });
        }
    }

    // 2. Group Trips
    allFlightLegs.sort((a, b) => a.date - b.date);
    const tripGroups = [];
    if (allFlightLegs.length > 0) {
        let current = [allFlightLegs[0]];
        for (let i = 1; i < allFlightLegs.length; i++) {
            if ((allFlightLegs[i].date - current[current.length - 1].date) > 86400000 * 14) {
                tripGroups.push(current); current = [allFlightLegs[i]];
            } else current.push(allFlightLegs[i]);
        }
        tripGroups.push(current);
    }

    const finalTrips = tripGroups.map(legs => {
        const start = legs[0].date, end = legs[legs.length - 1].date;
        const tripHotels = allHotels.filter(h => h.checkIn >= new Date(start.getTime() - 86400000 * 5) && h.checkIn <= new Date(end.getTime() + 86400000 * 2));
        let title = legs.find(l => !l.dest.includes('TPE'))?.dest || '未知行程';
        return { start, end, legs, hotels: tripHotels.sort((a, b) => a.checkIn - b.checkIn), title };
    });

    finalTrips.sort((a, b) => b.start - a.start);

    // 3. HTML
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>我的所有旅遊行程</title><link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap" rel="stylesheet"><style>body{font-family:'Zen Maru Gothic',sans-serif;background:#f0f4f8;padding:40px;color:#333}.container{max-width:800px;margin:0 auto}h1{text-align:center;color:#2c3e50;margin-bottom:40px}.trip-card{background:white;border-radius:15px;box-shadow:0 4px 15px rgba(0,0,0,0.05);margin-bottom:40px;overflow:hidden}.trip-header{background:linear-gradient(135deg,#3498db,#2980b9);color:white;padding:20px 30px;display:flex;justify-content:space-between;align-items:center}.trip-header h2{margin:0;font-size:1.5rem}.trip-date{opacity:.9;font-size:.9rem}.timeline{padding:30px}.event{display:flex;margin-bottom:20px;align-items:flex-start}.event-date{width:80px;font-weight:700;color:#7f8c8d;font-size:.9rem;padding-top:3px}.event-icon{width:40px;text-align:center;font-size:1.2rem;margin-right:15px}.event-content{flex:1;border-left:2px solid #ecf0f1;padding-left:20px;padding-bottom:10px}.event:last-child .event-content{border-left:none}.event-title{font-weight:700;color:#34495e}.event-desc{color:#7f8c8d;font-size:.9rem;margin-top:4px}.price{color:#e67e22;font-weight:700;font-size:.8rem;margin-top:5px}</style></head><body><div class="container"><h1>✈️ 我的所有旅遊行程</h1>${finalTrips.map(trip => `<div class="trip-card"><div class="trip-header"><h2>${trip.title}</h2><div class="trip-date">${fmtDate(trip.start)} - ${fmtDate(trip.end)}</div></div><div class="timeline">${[...trip.legs.map(l => ({ date: l.date, type: 'flight', title: `${l.route || ''} ${l.flightNo || ''}`, desc: l.dest, price: l.price })), ...trip.hotels.map(h => ({ date: h.checkIn, type: 'hotel', title: '入住飯店', desc: h.name, sub: `${fmtDate(h.checkIn)} - ${fmtDate(h.checkOut)}`, price: h.price }))].sort((a, b) => a.date - b.date).map(e => `<div class="event"><div class="event-date">${fmtDate(e.date).split('/').slice(1).join('/')}</div><div class="event-icon">${e.type === 'flight' ? '✈️' : '🏨'}</div><div class="event-content"><div class="event-title">${e.title}</div><div class="event-desc">${e.desc}${e.sub ? `<br><small>${e.sub}</small>` : ''}</div>${e.price ? `<div class="price">NT$ ${e.price.toLocaleString()}</div>` : ''}</div></div>`).join('')}</div></div>`).join('')}</div></body></html>`;

    fs.writeFileSync('d:/2025/AI/MongoDB/travel/travel_index.html', html);
    console.log(`F:${allFlightLegs.length}, H:${allHotels.length}, T:${finalTrips.length}`);
}
generateAllTravel().catch(console.error);
