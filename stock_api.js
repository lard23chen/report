require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGODB_URI_PERSONAL;
const DB_NAME = 'AlexLIFE';
const COLLECTION_NAME = 'Stock_Portfolio';

// Global connection cache
let cachedClient = null;
let cachedDb = null;

async function getDb() {
    if (cachedDb) return cachedDb;
    console.log('=> connecting to database: ' + DB_NAME);
    const client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    cachedClient = client;
    cachedDb = db;
    return db;
}

// GET: 取得所有資料
app.get('/api/stock', async (req, res) => {
    try {
        const db = await getDb();
        const data = await db.collection(COLLECTION_NAME).find({}).sort({ date: -1 }).toArray();
        res.json({ ok: true, data });
    } catch (e) {
        console.error('API Error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST: 新增資料
app.post('/api/stock/add', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.collection(COLLECTION_NAME).insertOne(req.body);
        res.json({ ok: true, id: result.insertedId });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST: 更新資料
app.post('/api/stock/update', async (req, res) => {
    try {
        const db = await getDb();
        const { _id, ...updateData } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: "Missing _id" });
        await db.collection(COLLECTION_NAME).updateOne({ _id: new ObjectId(_id) }, { $set: updateData });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST: 刪除資料
app.post('/api/stock/delete', async (req, res) => {
    try {
        const db = await getDb();
        const { _id } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: "Missing _id" });
        await db.collection(COLLECTION_NAME).deleteOne({ _id: new ObjectId(_id) });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// GET: 取得股價 (Yahoo Finance chart API — works from any server location)
app.get('/api/stock/prices', async (req, res) => {
    try {
        const codes = req.query.codes ? req.query.codes.split(',') : [];
        if (codes.length === 0) return res.json({ ok: true, prices: {}, time: new Date().toLocaleString('zh-TW') });

        // Only valid Taiwan stock codes: 4+ digits, optional single uppercase letter suffix (ETFs like 00642U)
        const cleanCodes = [...new Set(
            codes.map(c => c.toString().trim()).filter(c => /^\d{4,}[A-Z]?$/.test(c))
        )];

        if (cleanCodes.length === 0) return res.json({ ok: true, prices: {}, time: new Date().toLocaleString('zh-TW') });

        const YF_HEADERS = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, */*',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        async function fetchYahoo(symbol) {
            const r = await fetch(
                `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d&includePrePost=false`,
                { headers: YF_HEADERS }
            );
            if (!r.ok) return null;
            const json = await r.json();
            const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
            return typeof price === 'number' && price > 0 ? price : null;
        }

        async function fetchOne(code) {
            try {
                // Primary: TWSE (.TW) for most codes; OTC (.TWO) for codes starting with 3 or 4
                const primary = code + ((/^[34]/.test(code)) ? '.TWO' : '.TW');
                const fallback = code + ((/^[34]/.test(code)) ? '.TW' : '.TWO');
                const price = (await fetchYahoo(primary)) ?? (await fetchYahoo(fallback));
                return { code, price };
            } catch (e) {
                return { code, price: null };
            }
        }

        console.log('Fetching prices from Yahoo Finance for:', cleanCodes.join(','));
        const results = await Promise.all(cleanCodes.map(fetchOne));

        const prices = {};
        results.forEach(({ code, price }) => { if (price) prices[code] = price; });

        res.json({ ok: true, prices, time: new Date().toLocaleString('zh-TW') });
    } catch (e) {
        console.error('Price API Error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Support local development
if (process.env.NODE_ENV !== 'production') {
    const port = 3001;
    app.listen(port, () => console.log(`Stock API running at http://localhost:${port}`));
}

module.exports = app;
