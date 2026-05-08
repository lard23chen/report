const fs = require('fs');

async function downloadCSV() {
    // Try gviz endpoint
    const url = 'https://docs.google.com/spreadsheets/d/1H7HqWIlV5jj3rPipVO-kIvuEP63nBcdHXKjP9DYlnXY/gviz/tq?tqx=out:csv&gid=0';
    console.log('Downloading via gviz...', url);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error('Failed to fetch:', response.status, response.statusText);
            return;
        }
        const text = await response.text();
        if (text.includes('<!DOCTYPE html>')) {
            console.log('Received HTML instead of CSV. Likely needs login.');
            return;
        }
        fs.writeFileSync('insurance_data.csv', text, 'utf8');
        console.log('Downloaded insurance_data.csv');
        
        const lines = text.split('\n');
        console.log('First 5 lines:');
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            console.log(lines[i]);
        }
    } catch (err) {
        console.error('Error during download:', err);
    }
}

downloadCSV();
