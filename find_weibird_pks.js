
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collS = db.collection('QwareTrafficSession');
        const collR = db.collection('QwareTrafficGAReadTime');
        const topEventId = 39484;
        const dates = ['2026-03-14', '2026-03-21'];
        for (const d of dates) {
            const sc = await collS.countDocuments({ ActivityID: topEventId, CreateTime: { $regex: '^' + d } });
            const rc = await collR.countDocuments({ ActivityID: topEventId, CreateTime: { $regex: '^' + d } });
            console.log(d, "Sessions:", sc, "GAReads:", rc);
        }
    } finally {
        await client.close();
    }
}
run();
