const https = require('https');

const candidates = [
    'https://ticket.ibon.com.tw/assets/img/logo.png', // Previous one (likely invalid/HTML)
    'https://www.ibon.com.tw/images/logo.jpg',
    'https://www.ibon.com.tw/images/logo.gif',
    'https://www.ibon.com.tw/images/logo.png',
    'https://www.ibon.com.tw/images/ibon_logo.jpg',
    'https://www.ibon.com.tw/images/ibon_logo.png',
    'https://ticket.ibon.com.tw/Content/img/logo_ibon.png',
    'https://img.ibon.com.tw/TicketData/ADImage/8uPkfU5ENPMoYoHwfpLAaS29LUua4L.jpg', // The OG image found earlier
];

function check(url) {
    return new Promise(resolve => {
        const req = https.request(url, { method: 'HEAD' }, res => {
            console.log(`[${res.statusCode}] ${url} - ${res.headers['content-type']}`);
            if (res.statusCode === 200 && res.headers['content-type'] && res.headers['content-type'].startsWith('image/')) {
                resolve(url);
            } else {
                resolve(null);
            }
        });
        req.on('error', () => resolve(null));
        req.end();
    });
}

async function run() {
    for (const url of candidates) {
        const valid = await check(url);
        if (valid) {
            console.log('FOUND VALID IMAGE:', valid);
            // Verify it by trying to fetch a bit
            return;
        }
    }
    console.log('No valid standard logo found.');
}

run();
