const fs = require('fs');
const csv = require('csv-parser');

const files = ['temp_sheet.csv', 'temp_sheet_all.csv', 'jan_sheet.csv'];
const results = new Map();

function parseCurrency(val) {
  if (!val) return 0;
  return parseInt(val.replace(/\$|,/g, '').trim(), 10) || 0;
}

let filesProcessed = 0;

files.forEach(file => {
  if (!fs.existsSync(file)) {
      filesProcessed++;
      checkDone();
      return;
  }
  fs.createReadStream(file)
    .pipe(csv({ headers: false }))
    .on('data', (data) => {
      let dateStr = data[1] ? data[1].trim().substring(0, 10) : '';
      const isValidDate = /^(2025\/11|2025\/12|2026\/01)\/\d{2}$/.test(dateStr);
      
      if (data[0] === '' && isValidDate) {
          const dt = dateStr.replace('2026/1/', '2026/01/');
          if (!results.has(dt)) {
              results.set(dt, {
                date: dt,
                sysA: parseCurrency(data[2]),
                sysD: parseCurrency(data[3]),
                sysE: parseCurrency(data[4]),
                shared: parseCurrency(data[5]),
                member: parseCurrency(data[6]),
                total: parseCurrency(data[7]),
                monitorLevel: data[8] ? data[8].trim() : '',
                activity: data[9] ? data[9].trim() : '',
                notes: data[10] ? data[10].trim() : ''
              });
          }
      }
    })
    .on('end', () => {
      filesProcessed++;
      checkDone();
    });
});

function checkDone() {
   if (filesProcessed === files.length) {
       fs.writeFileSync('all_data.json', JSON.stringify(Array.from(results.values())), 'utf8');
       console.log('Saved all_data.json. Rows:', results.size);
   }
}
