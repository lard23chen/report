const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);

async function run() {
    await client.connect();
    const db = client.db('QwareAi');

    const collection = db.collection('Qware_Ticket_Data');
    const TARGET_NAME = '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards';
    const TARGET_FIELD = '節目/商品名稱';
    console.log("Fetching tickets");
    const data = await collection.find({ [TARGET_FIELD]: TARGET_NAME }).toArray();
    console.log("Ticket Count:", data.length);

    const memberIds = [...new Set(data.map(d => d['會員編號']).filter(id => id && id !== '-'))];
    console.log("Distinct Members:", memberIds.length);

    // Fetch members
    const memberColl = db.collection('Qware_Member_data');
    console.log("Fetching members");
    const members = await memberColl.find({ '會員編號': { $in: memberIds } }).toArray();
    console.log("Member details fetched:", members.length);

    if (members.length > 0) {
        console.log("First member country:", members[0]['國家']);
    }

    client.close();
}
run();
