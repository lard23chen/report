require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGODB_URI_PERSONAL || process.env.MONGO_URI; // Vercel 上沿用既有 MONGO_URI 變數
const DB_NAME   = 'AlexLIFE';
const COLLECTION = 'USA_Stock';

let cachedClient = null;
let cachedDb     = null;

async function getDb() {
    if (cachedDb) return cachedDb;
    console.log('=> connecting to AlexLIFE/USA_Stock');
    const client = await MongoClient.connect(MONGO_URI);
    cachedClient = client;
    cachedDb     = client.db(DB_NAME);
    return cachedDb;
}

// GET /api/usa-stock — 讀取所有交易記錄
app.get('/api/usa-stock', async (req, res) => {
    try {
        const db   = await getDb();
        const data = await db.collection(COLLECTION)
            .find({}, { projection: { _id: 0 } })
            .sort({ dateObj: 1 })
            .toArray();
        res.json({ ok: true, count: data.length, data });
    } catch (e) {
        console.error('USA Stock API Error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

module.exports = app;
