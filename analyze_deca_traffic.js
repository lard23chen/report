const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('QwareAi');
        const trafficCol = db.collection('Qware_A_Traffic_session_data');
        const sectionCol = db.collection('Qware_A_Section_number');

        const projectName = 'deca joins 2026 world tour － 在這裡停一下';
        
        // 1. Get total traffic by session ID and date
        const trafficData = await trafficCol.find({ '節目名稱': projectName }).toArray();
        
        // 2. Map session IDs to session names
        const sessionIds = [...new Set(trafficData.map(d => d.場次代碼))];
        const sessions = await sectionCol.find({ '場次代碼': { $in: sessionIds } }).toArray();
        
        const sessionMap = {};
        sessions.forEach(s => {
            sessionMap[s.場次代碼] = s.場次名稱;
        });

        // 3. Group and aggregate
        const result = {};
        trafficData.forEach(d => {
            const sessionId = d.場次代碼;
            const sessionName = sessionMap[sessionId] || sessionId;
            const date = d.瀏覽日期.toISOString().split('T')[0];
            const views = d.瀏覽量 || 0;

            if (!result[sessionName]) {
                result[sessionName] = { 
                    total: 0, 
                    daily: {}, 
                    id: sessionId 
                };
            }
            result[sessionName].total += views;
            result[sessionName].daily[date] = (result[sessionName].daily[date] || 0) + views;
        });

        console.log(JSON.stringify(result, null, 2));

    } finally {
        await client.close();
    }
}
run();
