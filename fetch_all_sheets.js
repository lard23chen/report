const fs = require('fs');

async function getSheets() {
    const url = 'https://docs.google.com/spreadsheets/d/12PafK4fsLw7SAy4FG3SSK-P3khs0VcBnRwirgsBpeSk/htmlview';
    const response = await fetch(url);
    const html = await response.text();
    
    const regex = /<li id="sheet-button-(.*?)".*?>.*?<a.*?>(.*?)<\/a><\/li>/g;
    let match;
    while((match = regex.exec(html)) !== null) {
        console.log(`gid: ${match[1]}, name: ${match[2]}`);
    }
}

getSheets();
