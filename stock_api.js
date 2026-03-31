const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const MONGO_URI = 'mongodb+srv://lard23:Alex3638@cluster0.m7ujsnq.mongodb.net/';
const COLLECTION_NAME = 'Stock_Portfolio';

let collection;

async function connectDB() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db();
    collection = db.collection(COLLECTION_NAME);
    console.log('Connected to MongoDB.');
}

connectDB().catch(console.error);

// GET: 取得所有資料
app.get('/api/stock', async (req, res) => {
    try {
        const data = await collection.find({}).sort({ date: -1 }).toArray();
        res.json({ ok: true, data });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST: 新增資料
app.post('/api/stock/add', async (req, res) => {
    try {
        const result = await collection.insertOne(req.body);
        res.json({ ok: true, id: result.insertedId });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST: 更新資料
app.post('/api/stock/update', async (req, res) => {
    try {
        const { _id, ...updateData } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: "Missing _id" });
        await collection.updateOne({ _id: new ObjectId(_id) }, { $set: updateData });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST: 刪除資料
app.post('/api/stock/delete', async (req, res) => {
    try {
        const { _id } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: "Missing _id" });
        await collection.deleteOne({ _id: new ObjectId(_id) });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// GET: 從台證所抓取最新股價 (後端抓取避免 CORS 問題)
app.get('/api/stock/prices', async (req, res) => {
    try {
        const codes = req.query.codes ? req.query.codes.split(',') : [];
        if (codes.length === 0) return res.json({ ok: true, prices: {} });

        const parts = [];
        codes.forEach(c => {
            parts.push(`tse_${c}.tw`);
            parts.push(`otc_${c}.tw`);
        });

        const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${parts.join('|')}&json=1&delay=0&_=${Date.now()}`;
        const response = await fetch(url);
        const twseData = await response.json();
        
        const prices = {};
        if (twseData.msgArray) {
            twseData.msgArray.forEach(item => {
                const px = parseFloat((item.z && item.z !== '-') ? item.z : (item.y || item.pz || '0'));
                if (item.c && px > 0) prices[item.c] = px;
            });
        }
        res.json({ ok: true, prices });
    } catch (e) {
        console.error('Fetch prices failed:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.listen(port, () => {
    console.log(`Stock API (MongoDB Only) running at http://localhost:${port}`);
});
