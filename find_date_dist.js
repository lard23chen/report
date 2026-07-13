require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const coll = db.collection('Qware_A_Traffic_session_data');
        const data = await coll.aggregate([
            { $match: { '節目名稱': '國泰世華銀行 2026 韋禮安 韋，您好 HI WE1巡迴演唱會' } },
            { $group: { _id: '$瀏覽日期', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();
        console.log(JSON.stringify(data, null, 2));
    } finally {
        await client.close();
    }
}
run();
