require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");

        let outputStr = "分析 QwareTrafficGAReadTime 與 QwareTrafficSession 的節目區間列表\n";
        outputStr += "==================================================================\n\n";

        const gaReadTimeStats = await db.collection("QwareTrafficGAReadTime").aggregate([
            {
                $group: {
                    _id: "$ActivityID",
                    Name: { $first: "$ActivityInfoName" },
                    MinDate: { $min: "$CreateTime" },
                    MaxDate: { $max: "$CreateTime" },
                    Count: { $sum: 1 }
                }
            },
            { $sort: { MinDate: 1 } }
        ]).toArray();

        outputStr += "[QwareTrafficGAReadTime] 節目列表:\n";
        gaReadTimeStats.forEach(stat => {
            outputStr += `- ID: ${stat._id} | 節目名稱: ${stat.Name} | 區間: ${stat.MinDate} ~ ${stat.MaxDate} (資料筆數: ${stat.Count})\n`;
        });

        outputStr += "\n--------------------------------------------------\n\n";

        const sessionStats = await db.collection("QwareTrafficSession").aggregate([
            {
                $group: {
                    _id: "$ActivityID",
                    Name: { $first: "$ActivityInfoName" },
                    MinDate: { $min: "$CreateTime" },
                    MaxDate: { $max: "$CreateTime" },
                    Count: { $sum: 1 }
                }
            },
            { $sort: { MinDate: 1 } }
        ]).toArray();

        outputStr += "[QwareTrafficSession] 節目列表:\n";
        sessionStats.forEach(stat => {
            outputStr += `- ID: ${stat._id} | 節目名稱: ${stat.Name} | 區間: ${stat.MinDate} ~ ${stat.MaxDate} (資料筆數: ${stat.Count})\n`;
        });

        fs.writeFileSync('ga_events_list.txt', outputStr, 'utf-8');
        console.log("Analysis saved to ga_events_list.txt");

    } finally {
        await client.close();
    }
}
run().catch(console.dir);
