
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });

async function explore() {
    try {
        await client.connect();
        const db = client.db('allticket');
        const collections = await db.listCollections().toArray();

        let report = [];
        report.push("Collections: " + collections.map(c => c.name).join(', '));

        for (const col of collections.slice(0, 5)) {
            const data = await db.collection(col.name).findOne({});
            report.push(`\nSince collection: ${col.name}`);
            report.push(JSON.stringify(data, null, 2));
        }

        fs.writeFileSync('db_report.txt', report.join('\n'));
        console.log("Report saved to db_report.txt");
    } catch (error) {
        console.error(error);
    } finally {
        await client.close();
    }
}
explore();
