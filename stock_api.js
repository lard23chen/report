const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';
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

// GET: 取得股價
app.get('/api/stock/prices', async (req, res) => {
    try {
        const codes = req.query.codes ? req.query.codes.split(',') : [];
        if (codes.length === 0) return res.json({ ok: true, prices: {}, time: new Date().toLocaleString('zh-TW') });

        // Filter and sanitize codes
        const cleanCodes = codes.map(c => c.toString().trim()).filter(c => c.length >= 2);
        const parts = cleanCodes.flatMap(c => [`tse_${c}.tw`, `otc_${c}.tw`]);
        const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${parts.join('|')}&json=1&delay=0&_=${Date.now()}`;
        
        console.log('Fetching prices from TWSE:', cleanCodes.join(','));
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://mis.twse.com.tw/'
            }
        });
        const twseData = await response.json();
        
        const prices = {};
        if (twseData.msgArray) {
            twseData.msgArray.forEach(item => {
                // z: 最近成交價, y: 昨收, pz: 昨收(備援), o: 開盤
                const px = parseFloat((item.z && item.z !== '-') ? item.z : (item.y && item.y !== '-' ? item.y : (item.pz && item.pz !== '-' ? item.pz : '0')));
                if (item.c && px > 0) {
                    // 如果已經有值(tse)，不要被 0 或更差的值覆蓋
                    if (!prices[item.c] || prices[item.c] === 0) {
                        prices[item.c] = px;
                    }
                }
            });
        }
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
