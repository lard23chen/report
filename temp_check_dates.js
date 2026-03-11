const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const coll = db.collection("Qware_A_Ticket_data_Daily");
        const pipeline = [
            {
                $project: {
                    date: { $substr: ["$交易時間", 0, 10] }
                }
            },
            {
                $group: {
                    _id: "$date",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: -1 }
            }
        ];
        const result = await coll.aggregate(pipeline).toArray();
        console.log("Dates in Qware_A_Ticket_data_Daily:");
        console.dir(result);
    } finally {
        await client.close();
    }
}
run().catch(console.dir);
