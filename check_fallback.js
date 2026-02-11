const https = require('https');
const fs = require('fs');

const url = 'https://img.ibon.com.tw/TicketData/ADImage/8uPkfU5ENPMoYoHwfpLAaS29LUua4L.jpg';

https.get(url, (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);

    if (res.statusCode === 200) {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            console.log('Size:', buffer.length);
        });
    }
});
