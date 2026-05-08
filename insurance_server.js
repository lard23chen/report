const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3001;

// Using the URI from stock_api.js but aiming at AlexLFE database
const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';
const DB_NAME = 'AlexLFE';
const COLLECTION_NAME = 'insurance';

let cachedDb = null;

async function getDb() {
    if (cachedDb) return cachedDb;
    const client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    cachedDb = db;
    return db;
}

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Root: Serve the management UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'A_Insurance_Report.html'));
});

// API: GET all records
app.get('/api/insurance', async (req, res) => {
    try {
        const db = await getDb();
        const data = await db.collection(COLLECTION_NAME).find({}).toArray();
        res.json({ ok: true, data });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// API: ADD record
app.post('/api/insurance/add', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.collection(COLLECTION_NAME).insertOne(req.body);
        res.json({ ok: true, id: result.insertedId });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// API: UPDATE record
app.post('/api/insurance/update', async (req, res) => {
    try {
        const db = await getDb();
        const { _id, ...updateData } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: "Missing _id" });
        await db.collection(COLLECTION_NAME).updateOne({ _id: new ObjectId(_id) }, { $set: updateData });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// API: DELETE record
app.post('/api/insurance/delete', async (req, res) => {
    try {
        const db = await getDb();
        const { _id } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: "Missing _id" });
        await db.collection(COLLECTION_NAME).deleteOne({ _id: new ObjectId(_id) });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Insurance API running at http://localhost:${port}`);
    console.log(`UI available at http://localhost:${port}/A_Insurance_Report.html`);
});
