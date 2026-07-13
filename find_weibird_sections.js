require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('QwareAi');
        const query = await db.collection('Qware_A_Section_number').find({
            $or: [
                { '節目名稱': /韋禮安/ },
                { '場次名稱': /韋禮安/ }
            ]
        }).toArray();

        console.log('Matches:', query.length);
        if (query.length > 0) {
            console.log('Program Names:', [...new Set(query.map(q => q['節目名稱']))]);
            console.log('Show Names:', [...new Set(query.map(q => q['場次名稱']))]);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}
run();
