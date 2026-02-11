const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function generateMonthlyStats() {
    try {
        await client.connect();
        console.log("Connected to MongoDB...");

        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        const pipeline = [
            {
                $project: {
                    month: { $substr: ["$交易時間", 0, 7] }, // Extract YYYY-MM
                    status: "$狀態",
                    fee: "$手續費"
                }
            },
            {
                $group: {
                    _id: "$month",
                    salesCount: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "正常"] }, 1, 0]
                        }
                    },
                    refundCount: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        { $eq: ["$status", "已退票"] },
                                        { $eq: ["$status", "退票"] },
                                        { $gt: ["$fee", 0] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    totalCount: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // Sort by month ascending
            }
        ];

        const results = await collection.aggregate(pipeline).toArray();

        console.log("\n每月訂購與退票統計 (Monthly Sales vs Refunds):");
        console.log("--------------------------------------------------");
        console.log("月份 (Month) | 訂購筆數 (Sales) | 退票筆數 (Refunds) | 總筆數 (Total)");
        console.log("--------------------------------------------------");

        results.forEach(r => {
            if (r._id && r._id.match(/^\d{4}-\d{2}$/)) { // Simple validation for YYYY-MM format
                console.log(`${r._id.padEnd(12)} | ${String(r.salesCount).padStart(13)} | ${String(r.refundCount).padStart(16)} | ${String(r.totalCount).padStart(12)}`);
            }
        });
        console.log("--------------------------------------------------");

    } catch (err) {
        console.error("Error generating stats:", err);
    } finally {
        await client.close();
    }
}

generateMonthlyStats();
