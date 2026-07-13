require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const uri = process.env.MONGODB_URI_DMP;

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
