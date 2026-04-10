const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");

        // 3/9 18:00 - 18:30 (Local Time)
        const startTime = new Date("2026-03-09T18:00:00+08:00");
        const endTime = new Date("2026-03-09T18:30:00+08:00");

        const sessions = await db.collection("QwareTrafficSession").find({
            ActivityID: 39455,
            CreateTime: { $gte: startTime, $lte: endTime }
        }).sort({ CreateTime: 1 }).toArray();

        const reads = await db.collection("QwareTrafficGAReadTime").find({
            ActivityID: 39455,
            CreateTime: { $gte: startTime, $lte: endTime }
        }).sort({ CreateTime: 1 }).toArray();

        // Flatten data by minute
        const masterMap = {};

        sessions.forEach(s => {
            const m = s.CreateTime.getMinutes().toString().padStart(2, '0');
            const key = `18:${m}`;
            if (!masterMap[key]) masterMap[key] = { time: key, session: 0, activeD: 0, activeA: 0, activeDMin: 0, activeAMin: 0 };
            masterMap[key].session = Math.max(masterMap[key].session, s.SessionCount);
        });

        reads.forEach(r => {
            const m = r.CreateTime.getMinutes().toString().padStart(2, '0');
            const key = `18:${m}`;
            if (!masterMap[key]) masterMap[key] = { time: key, session: 0, activeD: 0, activeA: 0, activeDMin: 0, activeAMin: 0 };
            masterMap[key].activeD = r.ActiveUsersDCount;
            masterMap[key].activeA = r.ActiveUsersACount;
            masterMap[key].activeDMin = r.ActiveUsersDMinCount;
            masterMap[key].activeAMin = r.ActiveUsersAMinCount;
        });

        const sortedKeys = Object.keys(masterMap).sort();
        console.log("TIME,SESSION,ACTIVE_D,ACTIVE_A,ACTIVE_D_MIN,ACTIVE_A_MIN");
        sortedKeys.forEach(k => {
            const d = masterMap[k];
            console.log(`${d.time},${d.session},${d.activeD},${d.activeA},${d.activeDMin},${d.activeAMin}`);
        });

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
