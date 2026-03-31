const express = require('express');
const { MongoClient } = require('mongodb');
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

// Get all records
app.get('/api/stock', async (req, res) => {
    try {
        const data = await collection.find({}).toArray();
        res.json({ ok: true, data });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Add record
app.post('/api/stock/add', async (req, res) => {
    try {
        const result = await collection.insertOne(req.body);
        res.json({ ok: true, id: result.insertedId });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Update record
app.post('/api/stock/update', async (req, res) => {
    try {
        const { index, ...updateData } = req.body;
        // In the migration, we didn't add an ID from the sheet index.
        // For simplicity, let's just use the index if provided, but better to use _id
        if (req.body._id) {
            const { ObjectId } = require('mongodb');
            const id = req.body._id;
            delete updateData._id;
            await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateData });
        } else {
            // Fallback to finding by some unique combination if needed, 
            // but the HTML passes _idx which was the array index.
            // We should ideally update the HTML to use MongoDB _id.
            res.status(400).json({ ok: false, error: "Missing _id for update" });
            return;
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Delete record
app.post('/api/stock/delete', async (req, res) => {
    try {
        if (req.body._id) {
            const { ObjectId } = require('mongodb');
            await collection.deleteOne({ _id: new ObjectId(req.body._id) });
        } else {
            res.status(400).json({ ok: false, error: "Missing _id for delete" });
            return;
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.listen(port, () => {
    console.log(`Stock API running at http://localhost:${port}`);
});
