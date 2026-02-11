
const { MongoClient, ServerApiVersion } = require('mongodb');

// 設定連接字串
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// 建立 MongoClient
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        console.log("正在嘗試連接到 MongoDB... (Testing connection...)");
        // 連接到伺服器
        await client.connect();

        // 發送 ping 指令
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
        console.log("成功連接到 MongoDB！");

        // 列出資料庫
        const dbs = await client.db().admin().listDatabases();
        console.log("\nAvailable Databases (可用資料庫):");
        dbs.databases.forEach(db => console.log(` - ${db.name}`));

    } catch (error) {
        console.error("連接失敗 (Connection Failed):", error);
    } finally {
        // 關閉連接
        await client.close();
    }
}

run().catch(console.dir);
