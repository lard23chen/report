const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function check() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const partialName = "韋禮安";
        
        const trafficNames = await db.collection("QwareTrafficSession").distinct("ActivityInfoName", {
            "ActivityInfoName": { "$regex": partialName }
        });
        console.log("Traffic Activity Names:", trafficNames);

        const ticketNamesDaily = await db.collection("Qware_A_Ticket_data_Daily").distinct("節目/商品名稱", {
            "節目/商品名稱": { "$regex": partialName }
        });
        console.log("Ticket Names Daily:", ticketNamesDaily);

        const ticketNamesHist = await db.collection("Qware_Ticket_Data").distinct("節目/商品名稱", {
            "節目/商品名稱": { "$regex": partialName }
        });
        console.log("Ticket Names Hist:", ticketNamesHist);

    } finally {
        await client.close();
    }
}
check();
