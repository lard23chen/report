
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function simulateLogic() {
    try {
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');
        const dbData = await collection.find({}).toArray();

        // 2c logic
        const refundRecords = dbData.filter(d => d['狀態'] === '已退票' || d['狀態'] === '退票' || (d['手續費'] && d['手續費'] > 0));
        console.log("Refund Records Count:", refundRecords.length);

        // Chart logic
        const dailyRefundsMap = {};
        refundRecords.forEach(item => {
            let dateStr = item['退票時間'];
            if (!dateStr || dateStr === '-') dateStr = item['交易時間'];
            if (!dateStr) return;

            const date = dateStr.split(' ')[0];
            const val = item['實退金額'] || 0;
            dailyRefundsMap[date] = (dailyRefundsMap[date] || 0) + val;
        });

        const rDates = Object.keys(dailyRefundsMap).sort();
        console.log("Daily Refund Map Keys:", rDates);
        console.log("First 5 amounts:", rDates.slice(0, 5).map(d => dailyRefundsMap[d]));

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

simulateLogic();
