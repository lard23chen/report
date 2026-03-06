const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const info = await client.db("admin").command({ usersInfo: "QwareDashBoard", showPrivileges: true });
        console.log(JSON.stringify(info, null, 2));
    } catch (err) {
        console.log("Error:", err.message);
    } finally {
        await client.close();
    }
}
run();
