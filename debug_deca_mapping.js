require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('QwareAi');
        const sectionCol = db.collection('Qware_A_Section_number');
        const ids = [ 'B0AQY9PL', 'B0ARAQUY', 'B0ARARJH', 'B0ARASAV', 'B0ARATMZ' ];
        
        // Let's also check if they are in Qware_Ticket_Data
        const mapping = await sectionCol.find({ '場次代碼': { $in: ids } }).toArray();
        console.log('Mapping from Qware_A_Section_number:', JSON.stringify(mapping, null, 2));
        
        if (mapping.length === 0) {
            console.log('No mapping found in Qware_A_Section_number. Checking Qware_Ticket_Data...');
            const ticketCol = db.collection('Qware_Ticket_Data');
            const mapping2 = await ticketCol.find({ '場次代碼': { $in: ids } }).toArray();
            console.log('Mapping from Qware_Ticket_Data count:', mapping2.length);
            if (mapping2.length > 0) {
                console.log('Sample from ticket data:', JSON.stringify(mapping2[0], null, 2));
            }
        }
    } finally {
        await client.close();
    }
}
run();
