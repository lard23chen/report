require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_DMP;

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
