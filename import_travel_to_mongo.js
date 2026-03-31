/**
 * import_travel_to_mongo.js
 * Parses Travel_Tickets_2026.html and imports all trip/flight/hotel data
 * into the MongoDB `travel` database, `trips` collection.
 *
 * Run: node import_travel_to_mongo.js
 */

const fs          = require('fs');
const path        = require('path');
const cheerio     = require('cheerio');
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';
const DB_NAME   = 'travel';
const COL_NAME  = 'trips';

/* ── helpers ──────────────────────────────────────────────── */
function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

function tdText($, td) {
    // return plain text of a cell, newline-joining <br>
    return $(td).find('br').replaceWith('\n').end()
        .text().replace(/\s*\n\s*/g, '\n').trim();
}

/* Detect whether a fare/price cell is pts, price, or dash */
function fareType($, td) {
    if ($(td).hasClass('price'))     return 'price';
    if ($(td).hasClass('price-pts')) return 'pts';
    if ($(td).hasClass('hotel-pts')) return 'pts';
    if ($(td).hasClass('dash'))      return 'dash';
    const t = clean($(td).text());
    if (!t || t === '—')             return 'dash';
    if (/[Pp]oint|積分|哩|里/i.test(t)) return 'pts';
    return 'price';
}

/* ── main parse ───────────────────────────────────────────── */
function parseHTML(html) {
    const $ = cheerio.load(html);
    const trips = [];

    // Iterate each tab  (tab-2026, tab-2025, tab-2024)
    $('#tab-2026, #tab-2025, #tab-2024').each(function () {
        const tab = $(this).attr('id').replace('tab-', '');

        $(this).children('.trip').each(function (ti) {
            const tripEl = $(this);
            const hdr    = tripEl.children('.trip-header');

            const tripNum  = clean(hdr.find('.trip-num').text());
            const dest     = clean(hdr.find('.trip-dest').text());
            const dates    = clean(hdr.find('.trip-dates').text());
            const tagEl    = hdr.find('.trip-tag');
            const tag      = clean(tagEl.text());
            const tagStyle = tagEl.attr('style') || '';

            const trip = {
                _id:         tab + ':t' + ti,
                tab,
                tripNum,
                destination: dest,
                dates,
                tag,
                tagStyle,
                passengers:  [],
                hotels:      []
            };

            /* ── Flights (passenger sections) ── */
            tripEl.find('.passenger-section').each(function () {
                const sec = $(this);

                // Each passenger label + its table
                sec.find('.passenger-label').each(function (pi) {
                    const labelEl = $(this);
                    const badge   = labelEl.find('.p-badge');
                    const name    = clean(badge.text());
                    const bClass  = (badge.attr('class') || '').match(/badge-(\w+)/);
                    const note    = clean(labelEl.find('.note').text());

                    // The table right after this label
                    const tableWrap = labelEl.next('.table-wrap');
                    const flights   = [];

                    tableWrap.find('tbody tr').each(function () {
                        const cells = $(this).find('td');
                        if (cells.length < 2) return;

                        const dirEl  = cells.eq(0);
                        const isGo   = dirEl.find('.badge-go').length > 0;
                        const isBack = dirEl.find('.badge-back').length > 0;

                        const depMain  = clean(cells.eq(1).find('.time-main').text());
                        const depFull  = clean(cells.eq(1).text());
                        const arrival  = clean(cells.eq(2).find('.time-arr').text()) || clean(cells.eq(2).text());
                        const flightNo = clean(cells.eq(3).text());
                        const pnr      = clean(cells.eq(4).text());
                        const aircraft = clean(cells.eq(5).text());

                        // ticket col (6) — LINK badge or —
                        const ticketEl = cells.eq(6);
                        const ticket   = ticketEl.find('.link-badge').length ? 'LINK' : clean(ticketEl.text());

                        // payment col (7)
                        const paymentRaw = tdText($, cells.eq(7));
                        const payment    = paymentRaw === '—' ? '' : paymentRaw;

                        // fare col (8)
                        const fareRaw  = clean(cells.eq(8).text());
                        const fare     = fareRaw === '—' ? '' : fareRaw;
                        const fType    = fareType($, cells.eq(8));

                        // notes col (9) — optional
                        let notes = '';
                        if (cells.length > 9) {
                            notes = clean(cells.eq(9).text());
                            if (notes === '—') notes = '';
                        }

                        flights.push({
                            direction: isGo ? 'go' : isBack ? 'back' : 'other',
                            departure: depMain || depFull,
                            arrival,
                            flightNo:  flightNo === '—' ? '' : flightNo,
                            pnr:       pnr       === '—' ? '' : pnr,
                            aircraft:  aircraft  === '—' ? '' : aircraft,
                            ticket:    ticket    === '—' ? '' : ticket,
                            payment,
                            fare,
                            fareType:  fType,
                            notes
                        });
                    });

                    trip.passengers.push({
                        name,
                        badge:  bClass ? bClass[1] : 'alex',
                        note,
                        flights
                    });
                });
            });

            /* ── Hotels ── */
            tripEl.find('.hotel-section tbody tr').each(function () {
                const cells = $(this).find('td');
                if (cells.length < 2) return;

                const name     = clean(cells.eq(0).text());
                const chain    = clean(cells.eq(1).text());
                const checkIn  = clean(cells.eq(2).text());
                const checkOut = clean(cells.eq(3).text());
                const nights   = clean(cells.eq(4).text());
                const payment  = clean(cells.eq(5).text());
                const priceRaw = clean(cells.eq(6).text());
                const pType    = fareType($, cells.eq(6));
                const notes    = cells.length > 7 ? clean(cells.eq(7).text()) : '';

                trip.hotels.push({
                    name,
                    chain:     chain    === '—' ? '' : chain,
                    checkIn:   checkIn  === '—' ? '' : checkIn,
                    checkOut:  checkOut === '—' ? '' : checkOut,
                    nights:    nights   === '—' ? '' : nights,
                    payment:   payment  === '—' ? '' : payment,
                    price:     priceRaw === '—' ? '' : priceRaw,
                    priceType: pType,
                    notes:     notes    === '—' ? '' : notes
                });
            });

            trips.push(trip);
        });
    });

    return trips;
}

/* ── insert to MongoDB ────────────────────────────────────── */
async function run() {
    const html   = fs.readFileSync(path.join(__dirname, 'Travel_Tickets_2026.html'), 'utf8');
    const trips  = parseHTML(html);

    console.log('解析到旅程數:', trips.length);
    trips.forEach(t =>
        console.log(' ', t._id, '|', t.tab, '|', t.tripNum, '-', t.destination,
            '| 乘客:', t.passengers.length,
            '| 飯店:', t.hotels.length)
    );

    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const col = client.db(DB_NAME).collection(COL_NAME);

    // Clear existing and re-import
    await col.deleteMany({});
    const result = await col.insertMany(trips);
    console.log('\n✅ 已匯入', result.insertedCount, '筆旅程到 MongoDB', DB_NAME + '.' + COL_NAME);

    await client.close();
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
