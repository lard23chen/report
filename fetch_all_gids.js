const fs = require('fs');
const https = require('https');

const gids = [
  '0', '524185961', '115421768', '769441678', '303849349', '581929756',
  '1316540184', '1728130240', '823116080', '1131256885', '1063472050',
  '330120433', '2082104892', '750428974', '985664075', '68155337',
  '2135417130', '1506269996', '200838140', '1977718004', '2141689148',
  '1120582346', '155297256', '2030070076', '1469354086', '1672787955',
  '1887379480', '931888563', '615960706', '1942458436', '1004806267',
  '268307334'
];

async function downloadAll() {
    let allCsv = '';
    for (const gid of gids) {
        console.log(`Downloading gid ${gid}`);
        const url = `https://docs.google.com/spreadsheets/d/12PafK4fsLw7SAy4FG3SSK-P3khs0VcBnRwirgsBpeSk/export?format=csv&gid=${gid}`;
        try {
            const response = await fetch(url);
            if (response.ok) {
                const text = await response.text();
                allCsv += text + '\n';
            }
        } catch(e) { console.error(e); }
    }
    fs.writeFileSync('temp_sheet_all.csv', allCsv, 'utf8');
    console.log('All sheets downloaded and combined into temp_sheet_all.csv');
}

downloadAll();
