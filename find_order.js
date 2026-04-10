const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function run() {
    try {
        await client.connect();
        const db = client.db("QwareAi");

        console.log("Searching for ticket sales on 2026/03/09...");
        
        // Match transactions on 3/9 around 18:00
        const sales = await db.collection("Qware_A_Ticket_data_Daily").find({
            "交易時間": { $regex: "^2026-03-09" }
        }).limit(20).toArray();

        if (sales.length > 0) {
            console.log("Found recent sales on 3/9:");
            const uniqueNames = [...new Set(sales.map(s => s["節目/商品名稱"]))];
            uniqueNames.forEach(name => console.log("-", name));
            
            // Look for ActivityID link if possible
            const oneSale = await db.collection("Qware_A_Ticket_data_Daily").findOne({
                 "交易時間": { $regex: "^2026-03-09 18" }
            });
            if(oneSale) {
                console.log("\nSample 18:00 sale detail:");
                console.log("Name:", oneSale["節目/商品名稱"]);
                console.log("Order ID:", oneSale["訂單編號"]);
            }
        } else {
            console.log("No sales found on 3/9 in Qware_A_Ticket_data_Daily");
        }

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
