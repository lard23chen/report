
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Connect to MongoDB
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db("allticket");
        console.log("Connected to MongoDB");
    } catch (err) {
        console.error("Failed to connect to MongoDB", err);
    }
}

connectDB();

app.use(express.static('public'));

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
