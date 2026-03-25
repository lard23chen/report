
const { MongoClient } = require('mongodb');

async function inspect() {
    const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');
        const TARGET_NAME = '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards';
        
        const counts = await collection.aggregate([
            { $match: { '節目/商品名稱': TARGET_NAME, '狀態': '正常' } },
            { $group: { 
                _id: { price: "$售價", section: "$座位資訊/票區" }, 
                count: { $sum: 1 } 
              } 
            },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]).toArray();
        console.log("\nTop Combinations:");
        counts.forEach(c => {
            console.log(`Price: ${c._id.price}, Section: ${c._id.section}, Count: ${c.count}`);
        });

        // Also check section info that resulted in $0 price
        const zeroPrice = await collection.aggregate([
            { $match: { '節目/商品名稱': TARGET_NAME, '狀態': '正常', '售價': 0 } },
            { $group: { 
                _id: "$座位資訊/票區", 
                count: { $sum: 1 } 
              } 
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();
        console.log("\nZero Price Sections:");
        zeroPrice.forEach(z => {
            console.log(`Section: ${z._id}, Count: ${z.count}`);
        });

    } finally {
        await client.close();
    }
}
inspect();
