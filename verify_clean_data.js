require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    await client.connect();
    const db = client.db("QwareAi");
    const collection = db.collection("Qware_A_Ticket_data_Daily");

    // 取得 2026-03 的真實統計
    const stats = await collection.aggregate([
        { $match: { "鈭斗": { $regex: "^2026-03" }, "": "蟡" } }, // 交易時間, 狀態=正常 (取亂碼對應值)
        { $group: {
            _id: null,
            totalRevenue: { $sum: { $convert: { input: "$", to: "double", onError: 0 } } }, // 售價 (亂碼)
            totalTickets: { $sum: 1 }
        }}
    ]).toArray();

    console.log("--- Verified Clean Data (Qware_A_Ticket_data_Daily) ---");
    console.log(JSON.stringify(stats, null, 2));
    
    // 也檢查 2 月與 1 月
    const feb = await collection.countDocuments({ "鈭斗": { $regex: "^2026-02" } });
    const jan = await collection.countDocuments({ "鈭斗 trace": { $regex: "^2026-01" } }); // 這裡欄位可能不同
    console.log(`Feb Tickets count: ${feb}`);
    
    process.exit();
}
run();
