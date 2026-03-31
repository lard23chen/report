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
const DB_NAME   = 'travel';
const COL_NAME  = 'travel';
const DOC_ID    = 'store';           // single document that holds all CRUD state

/* ── MongoDB connection ─────────────────────────────────────── */
const client = new MongoClient(MONGO_URI);
let col = null;

async function connectDB() {
    try {
        await client.connect();
        col = client.db(DB_NAME).collection(COL_NAME);
        console.log('✅ Connected to MongoDB  db=' + DB_NAME + '  col=' + COL_NAME);
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
    }
}
connectDB();

/* ── Middleware ─────────────────────────────────────────────── */
app.use(express.json({ limit: '4mb' }));

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
    res.json({ connected: col !== null, db: DB_NAME, collection: COL_NAME });
});

/* ── API: GET store ─────────────────────────────────────────── */
app.get('/api/travel/store', async function (req, res) {
    if (!col) return res.status(503).json({ error: 'DB not ready' });
    try {
        const doc = await col.findOne({ _id: DOC_ID });
        res.json(doc ? doc.data : {});
    } catch (err) {
        console.error('GET /store error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/* ── API: PUT store (upsert) ────────────────────────────────── */
app.put('/api/travel/store', async function (req, res) {
    if (!col) return res.status(503).json({ error: 'DB not ready' });
    try {
        await col.replaceOne(
            { _id: DOC_ID },
            { _id: DOC_ID, data: req.body, updatedAt: new Date() },
            { upsert: true }
        );
        res.json({ ok: true });
    } catch (err) {
        console.error('PUT /store error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/* ── API: DELETE store (reset all edits) ───────────────────── */
app.delete('/api/travel/store', async function (req, res) {
    if (!col) return res.status(503).json({ error: 'DB not ready' });
    try {
        await col.deleteOne({ _id: DOC_ID });
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /store error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/* ── Start ──────────────────────────────────────────────────── */
app.listen(PORT, function () {
    console.log('');
    console.log('Travel API server running at http://localhost:' + PORT);
    console.log('Open:  http://localhost:' + PORT + '/Travel_Tickets_2026.html');
    console.log('');
});
