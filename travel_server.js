/**
 * Travel Tickets MongoDB API Server
 * Connects to the `travel` collection and exposes REST endpoints
 * for the Travel_Tickets_2026.html CRUD system.
 *
 * Run: node travel_server.js
 * Default port: 3001
 * HTML: http://localhost:3001/Travel_Tickets_2026.html
 */

const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');

const app  = express();
const PORT = 3001;

const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';
const DB_NAME   = 'AlexLIFE';
const COL_STORE = 'TravelStore';     // stores CRUD edit state
const COL_TRIPS = 'Travel';          // stores structured trip data
const DOC_ID    = 'store';

/* ── MongoDB connection ─────────────────────────────────────── */
const client = new MongoClient(MONGO_URI);
let db = null;

async function ensureDB() {
    if (db) return db;
    try {
        await client.connect();
        db = client.db(DB_NAME);
        console.log('✅ Connected to MongoDB  db=' + DB_NAME);
        return db;
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        throw err;
    }
}

/* ── Middleware ─────────────────────────────────────────────── */
app.use(express.json({ limit: '4mb' }));

// Ensure DB is connected before handling any API requests
app.use('/api/travel', async function (req, res, next) {
    try {
        await ensureDB();
        next();
    } catch (err) {
        res.status(503).json({ error: 'Database connection failed' });
    }
});

// CORS – allow the GitHub Pages origin and localhost
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Serve the project root as static files (so the HTML works at /)
app.use(express.static(path.join(__dirname)));

/* ── API: status ────────────────────────────────────────────── */
app.get('/api/travel/status', function (req, res) {
    res.json({ connected: db !== null, db: DB_NAME });
});

/* ── API: GET all trips (optionally filtered by tab) ────────── */
app.get('/api/travel/trips', async function (req, res) {
    try {
        const filter = req.query.tab ? { tab: req.query.tab } : {};
        const trips  = await db.collection(COL_TRIPS).find(filter)
            .sort({ _id: 1 }).toArray();
        res.json(trips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── API: GET single trip ───────────────────────────────────── */
app.get('/api/travel/trips/:id', async function (req, res) {
    try {
        const trip = await db.collection(COL_TRIPS).findOne({ _id: req.params.id });
        if (!trip) return res.status(404).json({ error: 'Not found' });
        res.json(trip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── API: PUT single trip (upsert) ─────────────────────────── */
app.put('/api/travel/trips/:id', async function (req, res) {
    try {
        const doc = Object.assign({}, req.body, { _id: req.params.id, updatedAt: new Date() });
        await db.collection(COL_TRIPS).replaceOne({ _id: req.params.id }, doc, { upsert: true });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── API: DELETE single trip ────────────────────────────────── */
app.delete('/api/travel/trips/:id', async function (req, res) {
    try {
        await db.collection(COL_TRIPS).deleteOne({ _id: req.params.id });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── API: GET edit-store (UI overrides) ─────────────────────── */
app.get('/api/travel/store', async function (req, res) {
    try {
        const doc = await db.collection(COL_STORE).findOne({ _id: DOC_ID });
        res.json(doc ? doc.data : {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── API: PUT edit-store ────────────────────────────────────── */
app.put('/api/travel/store', async function (req, res) {
    try {
        await db.collection(COL_STORE).replaceOne(
            { _id: DOC_ID },
            { _id: DOC_ID, data: req.body, updatedAt: new Date() },
            { upsert: true }
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── API: DELETE edit-store (reset all UI edits) ────────────── */
app.delete('/api/travel/store', async function (req, res) {
    try {
        await db.collection(COL_STORE).deleteOne({ _id: DOC_ID });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── Start ──────────────────────────────────────────────────── */
// For local testing
if (require.main === module) {
    app.listen(PORT, function () {
        console.log('');
        console.log('Travel API server running at http://localhost:' + PORT);
        console.log('Open:  http://localhost:' + PORT + '/Travel_Tickets_2026.html');
        console.log('');
    });
}

// Export for Vercel
module.exports = app;
