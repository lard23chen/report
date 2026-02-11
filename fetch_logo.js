const https = require('https');
const fs = require('fs');

const url = 'https://ticket.ibon.com.tw/assets/img/logo.png';

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://ticket.ibon.com.tw/'
    }
};

https.get(url, options, (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);

    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('Buffer length:', buffer.length);
        const base64 = buffer.toString('base64');
        console.log('Base64 sample:', base64.substring(0, 50));

        // Save to file to verify
        fs.writeFileSync('logo_test.png', buffer);
    });
}).on('error', (e) => {
    console.error(e);
});
