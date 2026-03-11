const fs = require('fs');

async function downloadCSV() {
    const url = 'https://docs.google.com/spreadsheets/d/12PafK4fsLw7SAy4FG3SSK-P3khs0VcBnRwirgsBpeSk/export?format=csv&gid=581929756';
    console.log('Downloading...', url);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error('Failed to fetch:', response.statusText);
            return;
        }
        const text = await response.text();
        fs.writeFileSync('temp_sheet.csv', text, 'utf8');
        console.log('Downloaded temp_sheet.csv');
        
        // Print the first few lines to understand the structure
        const lines = text.split('\n');
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            console.log(lines[i]);
        }
    } catch (err) {
        console.error(err);
    }
}

downloadCSV();
