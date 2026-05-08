const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3001;

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

let db;
async function connectDB() {
    try {
        await client.connect();
        db = client.db("QwareAi");
        console.log("Connected to MongoDB QwareAi");
    } catch (err) {
        console.error("Failed to connect to MongoDB", err);
    }
}
connectDB();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'A_Insurance_Report.html'));
});

// API Endpoints
app.get('/api/insurance', async (req, res) => {
    try {
        const collection = db.collection('AlexLFE_insurance');
        const data = await collection.find({}).toArray();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/insurance', async (req, res) => {
    try {
        const collection = db.collection('AlexLFE_insurance');
        const newRecord = { ...req.body, createdAt: new Date() };
        const result = await collection.insertOne(newRecord);
        res.json({ success: true, id: result.insertedId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/insurance/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const collection = db.collection('AlexLFE_insurance');
        const updateData = { ...req.body };
        delete updateData._id; // Remove _id from body if present
        
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        res.json({ success: true, modifiedCount: result.modifiedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/insurance/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const collection = db.collection('AlexLFE_insurance');
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Insurance Management Server running at http://localhost:${port}`);
    console.log(`Access the UI at http://localhost:${port}/A_Insurance_Manager.html`);
});
