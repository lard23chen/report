const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const status = await client.db("admin").command({ connectionStatus: 1 });
        console.log(JSON.stringify(status.authInfo.authenticatedUserRoles, null, 2));
    } catch (err) {
        console.log("Error running connectionStatus:", err.message);
    } finally {
        await client.close();
    }
}
run();
