
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collS = db.collection('QwareTrafficSession');
        
        const dates = ['2026-03-14', '2026-03-21'];
        for (const d of dates) {
            console.log(`Checking ${d}...`);
            const pks = await collS.aggregate([
                { $match: { CreateTime: { $regex: '^' + d } } },
                { $group: { _id: "$ActivityID", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]).toArray();
            console.log(pks);
        }
    } finally {
        await client.close();
    }
}
run();
