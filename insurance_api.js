require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGODB_URI_PERSONAL || process.env.MONGO_URI; // Vercel 上沿用既有 MONGO_URI 變數
const DB_NAME = 'AlexLIFE';
const COLLECTION_NAME = 'Insurance';

let cachedClient = null;
let cachedDb = null;

async function getDb() {
    if (cachedDb) return cachedDb;
    const client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    cachedClient = client;
    cachedDb = db;
    return db;
}

app.get('/api/insurance', async (req, res) => {
    try {
        const db = await getDb();
        const data = await db.collection(COLLECTION_NAME).find({}).toArray();
        res.json({ ok: true, data });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post('/api/insurance/add', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.collection(COLLECTION_NAME).insertOne(req.body);
        res.json({ ok: true, id: result.insertedId });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post('/api/insurance/update', async (req, res) => {
    try {
        const db = await getDb();
        const { _id, ...updateData } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: 'Missing _id' });
        await db.collection(COLLECTION_NAME).updateOne(
            { _id: new ObjectId(_id) },
            { $set: updateData }
        );
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post('/api/insurance/delete', async (req, res) => {
    try {
        const db = await getDb();
        const { _id } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: 'Missing _id' });
        await db.collection(COLLECTION_NAME).deleteOne({ _id: new ObjectId(_id) });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const port = 3002;
    app.listen(port, () => console.log(`Insurance API running at http://localhost:${port}`));
}

module.exports = app;
