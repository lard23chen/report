
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function generateReport() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Fetching optimized data for 2026-03 (Field projection active)...");
        // 只抓取必要欄位以節省記憶體與時間
        const data = await collection.find(
            { "交易時間": { $regex: "^2026-03" } },
            { projection: { 
                "交易時間": 1, "售價": 1, "狀態": 1, "訂單編號": 1, 
                "節目/商品名稱": 1, "付款方式": 1, "銷售點": 1, 
                "手續費": 1, "實退金額": 1, "退票因素": 1, "退票時間": 1 
            }}
        ).toArray();
        
        console.log(`Successfully fetched ${data.length} records.`);

        // 轉換 Decimal128 格式為純數值，否則前端 JS 會運算錯誤 (出現 [object Object] 或 NaN)
        const mappedData = data.map(item => {
            const newItem = { ...item };
            if (item['售價'] && item['售價']['$numberDecimal']) newItem['售價'] = parseFloat(item['售價']['$numberDecimal']);
            if (item['實退金額'] && item['實退金額']['$numberDecimal']) newItem['實退金額'] = parseFloat(item['實退金額']['$numberDecimal']);
            if (item['手續費'] && item['手續費']['$numberDecimal']) newItem['手續費'] = parseFloat(item['手續費']['$numberDecimal']);
            return newItem;
        });

        const dateTitle = "2026年03月 分析報表 (A系統)";
        const reportTime = new Date().toLocaleString('zh-TW');

        // 讀取 Feb 範本內容
        const templateFile = 'generate_report_feb_2026.js';
        const scriptContent = fs.readFileSync(templateFile, 'utf8');
        const startTag = 'const htmlContent = `';
        const endTag = '`;';
        const startIndex = scriptContent.indexOf(startTag) + startTag.length;
        const endIndex = scriptContent.lastIndexOf(endTag);
        let htmlTemplate = scriptContent.substring(startIndex, endIndex);

        const fileName = `A_Qware_Revenue_Report_2026年03月_分析報表.html`;
        const filePath = path.join(__dirname, fileName);

        // 處理數據中的 script 標籤避免 HTML 破裂
        const safeData = JSON.stringify(mappedData).replace(/<\/script>/g, '<\\/script>');
        
        let finalHtml = htmlTemplate
            .replace(/\${dateTitle}/g, dateTitle)
            .replace(/\${reportTime}/g, reportTime)
            .replace("'__DB_DATA_PLACEHOLDER__'", safeData);

        // 注入 Error Handling
        const errorScript = `
        <script>
            window.onerror = function(msg, url, line, col, error) {
                console.error("Report Error:", msg, error);
                return false;
            };
        </script>
        `;
        finalHtml = finalHtml.replace('<body>', '<body>' + errorScript);

        fs.writeFileSync(filePath, '\ufeff' + finalHtml);
        console.log(`Report generated successfully: ${filePath}`);

    } catch (e) {
        console.error("Error generating report:", e);
    } finally {
        await client.close();
    }
}

generateReport();
