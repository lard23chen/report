const https = require('https');

const urls = [
    'https://ticket.ibon.com.tw/assets/img/logo.png',
    'https://ticket.ibon.com.tw/assets/images/logo.png',
    'https://ticket.ibon.com.tw/Content/img/logo.png',
    'https://ticket.ibon.com.tw/images/logo.png',
    'https://ticket.ibon.com.tw/img/logo.png',
    'https://ticket.ibon.com.tw/logo.png',
    'https://ticket.ibon.com.tw/assets/logo.png',
    'https://ticket.ibon.com.tw/Content/images/logo.png',
    'https://ticket.ibon.com.tw/Web/Content/images/logo.png',
    'https://ticket.ibon.com.tw/assets/img/logo.svg',
    'https://ticket.ibon.com.tw/assets/images/logo.svg',
    'https://ticket.ibon.com.tw/images/logo.svg'
];

function checkUrl(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                console.log('Found:', url);
                resolve(true);
            } else {
                resolve(false);
            }
        }).on('error', () => resolve(false));
    });
}

(async () => {
    for (const url of urls) {
        if (await checkUrl(url)) return;
    }
    console.log('None found');
})();
