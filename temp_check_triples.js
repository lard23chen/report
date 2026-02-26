const { MongoClient } = require("mongodb");
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");

        console.log("Searching for tripleS events...");

        // Find events matching "tripleS"
        const topEvents = await db.collection("QwareTrafficSession").aggregate([
            {
                $match: {
                    ActivityInfoName: { $regex: "tripleS", $options: "i" }
                }
            },
            {
                $group: {
                    _id: "$ActivityID",
                    Name: { $first: "$ActivityInfoName" },
                    MinTime: { $min: "$CreateTime" },
                    MaxTime: { $max: "$CreateTime" },
                    Count: { $sum: 1 }
                }
            }
        ]).toArray();

        console.log("Found Sessions:", JSON.stringify(topEvents, null, 2));

        const readEvents = await db.collection("QwareTrafficGAReadTime").aggregate([
            {
                $match: {
                    ActivityInfoName: { $regex: "tripleS", $options: "i" }
                }
            },
            {
                $group: {
                    _id: "$ActivityID",
                    Name: { $first: "$ActivityInfoName" },
                    MinTime: { $min: "$CreateTime" },
                    MaxTime: { $max: "$CreateTime" },
                    Count: { $sum: 1 }
                }
            }
        ]).toArray();

        console.log("Found GAReadTime:", JSON.stringify(readEvents, null, 2));

    } finally {
        await client.close();
    }
}
run();
