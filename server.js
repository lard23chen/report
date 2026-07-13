require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));
app.use(express.static('.'));

// --- Qware MongoDB ---
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db("allticket");
        console.log("Connected to MongoDB (Qware)");
    } catch (err) {
        console.error("Failed to connect to MongoDB (Qware)", err);
    }
}

connectDB();

// --- AlexLIFE MongoDB (Insurance) ---
const alexClient = new MongoClient(process.env.MONGODB_URI_PERSONAL);
let alexDb;

async function connectAlexDB() {
    try {
        await alexClient.connect();
        alexDb = alexClient.db('AlexLIFE');
        console.log("Connected to MongoDB (AlexLIFE)");
    } catch (err) {
        console.error("Failed to connect to MongoDB (AlexLIFE)", err);
    }
}

connectAlexDB();

// Insurance CRUD routes
app.get('/api/insurance', async (req, res) => {
    try {
        const data = await alexDb.collection('Insurance').find({}).toArray();
        res.json({ ok: true, data });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post('/api/insurance/add', async (req, res) => {
    try {
        const result = await alexDb.collection('Insurance').insertOne(req.body);
        res.json({ ok: true, id: result.insertedId });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post('/api/insurance/update', async (req, res) => {
    try {
        const { _id, ...updateData } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: 'Missing _id' });
        await alexDb.collection('Insurance').updateOne(
            { _id: new ObjectId(_id) },
            { $set: updateData }
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post('/api/insurance/delete', async (req, res) => {
    try {
        const { _id } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: 'Missing _id' });
        await alexDb.collection('Insurance').deleteOne({ _id: new ObjectId(_id) });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('/api/dashboard-data', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: "Database not connected yet" });
        }
        const collection = db.collection('Qware_DashBoard');
        // Fetch all data (assuming reasonable size for a demo, otherwise we'd paginate)
        const data = await collection.find({}).toArray();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Travel Expense CRUD
app.get('/api/travel-expense', async (req, res) => {
    try {
        if (!alexDb) return res.status(503).json({ ok: false, error: 'DB not connected' });
        const data = await alexDb.collection('TravelExpense').find({}).sort({ date: -1, createdAt: -1 }).toArray();
        res.json({ ok: true, data });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post('/api/travel-expense', async (req, res) => {
    try {
        if (!alexDb) return res.status(503).json({ ok: false, error: 'DB not connected' });
        const doc = { ...req.body, createdAt: new Date() };
        const result = await alexDb.collection('TravelExpense').insertOne(doc);
        res.json({ ok: true, id: result.insertedId });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.delete('/api/travel-expense/:id', async (req, res) => {
    try {
        if (!alexDb) return res.status(503).json({ ok: false, error: 'DB not connected' });
        await alexDb.collection('TravelExpense').deleteOne({ _id: new ObjectId(req.params.id) });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// USA Stock — 即時讀取 AlexLIFE/USA_Stock
app.get('/api/usa-stock', async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    try {
        if (!alexDb) return res.status(503).json({ ok: false, error: 'DB not connected' });
        const data = await alexDb.collection('USA_Stock').find({}, { projection: { _id: 0 } }).sort({ dateObj: 1 }).toArray();
        res.json({ ok: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('/api/prompt-log', (req, res) => {
    const logPath = 'C:\\Users\\alexchen\\.claude\\prompt-log.txt';
    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: err.message });
        res.type('text/plain').send(data);
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
