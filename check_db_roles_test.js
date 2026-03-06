const { MongoClient } = require('mongodb');
const fs = require('fs');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@qware-dmp-ver-7.f0fpg.mongodb.net/";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const dbs = ['Attrek-first-party-dmp', 'first-party-dmp', 'Attrek', 'first-party', 'dmp', 'dmp-ver-7'];
        let out = "";
        for (let d of dbs) {
            try {
                const doc = await client.db(d).collection('event').findOne({});
                out += `\nSUCCESS DB ${d}: doc ` + (doc ? 'found' : 'null');
            } catch (err) {
                out += `\nERROR DB ${d}: ` + err.message;
            }
        }
        fs.writeFileSync("db_test_out.txt", out);
    } finally {
        await client.close();
    }
}
run();
