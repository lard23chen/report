const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const names = [
            '國泰世華銀行 2026 韋禮安 韋，您好 HI WE1巡迴演唱會',
            '國泰世華銀行2026韋禮安「 HI WE1 韋，您好 巡迴演唱會」台北場'
        ];
        const dates = ['2026-03-05', '2026-03-13', '2026-03-14', '2026-03-15', '2026-03-08'];
        
        for (let d of dates) {
            const count = await db.collection("Qware_A_Ticket_data_Daily").countDocuments({
                "節目/商品名稱": { "$in": names },
                "交易時間": { "$regex": "^" + d }
            });
            console.log(`Tickets on ${d}: ${count}`);
        }

    } finally {
        await client.close();
    }
}
check();
