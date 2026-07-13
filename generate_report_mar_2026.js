require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB Connection Setup
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function generateReport() {
    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        const db = client.db("QwareAi");
        const collection = db.collection('Qware_Ticket_Data');

        console.log("Fetching data for 2026-03...");
        const data = await collection.find({ "交易時間": { $regex: "^2026-03" } }).toArray();
        console.log(`Fetched ${data.length} records.`);

        let fileTitle = "2026年03月 分析報表";
        let dateTitle = "2026年03月 分析報表 (A系統)";
        
        // Current Time for the report
        const reportTime = new Date().toLocaleString('zh-TW');

        // Load Logo Base64
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, 'ibon_logo.png');
            if (fs.existsSync(logoPath)) {
                const logoBuffer = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            }
        } catch (err) {}

        // HTML Template (simplified for brevity, based on Feb script)
        // I will read the Feb script to get the template again or just reuse the logic.
        // For efficiency, I will use the same template but update the month.
        
        const templateFile = 'generate_report_feb_2026.js';
        const scriptContent = fs.readFileSync(templateFile, 'utf8');
        const startTag = 'const htmlContent = `';
        const endTag = '`;';
        const startIndex = scriptContent.indexOf(startTag) + startTag.length;
        const endIndex = scriptContent.lastIndexOf(endTag);
        let htmlTemplate = scriptContent.substring(startIndex, endIndex);

        const fileName = `A_Qware_Revenue_Report_2026年03月_分析報表.html`;
        const filePath = path.join(__dirname, fileName);

        const safeData = JSON.stringify(data).replace(/<\/script>/g, '<\\/script>');
        
        let finalHtml = htmlTemplate
            .replace(/\${dateTitle}/g, dateTitle)
            .replace(/\${reportTime}/g, reportTime)
            .replace(/\${logoBase64 \? logoBase64 : 'https:\/\/ticket.ibon.com.tw\/assets\/img\/logo.png'}/g, logoBase64 || 'https://ticket.ibon.com.tw/assets/img/logo.png')
            .replace("'__DB_DATA_PLACEHOLDER__'", safeData);

        fs.writeFileSync(filePath, '\ufeff' + finalHtml);
        console.log(`Report generated successfully: ${filePath}`);

    } catch (e) {
        console.error("Error generating report:", e);
    } finally {
        await client.close();
    }
}

generateReport();
