const fs = require('fs');
const csv = require('csv-parser');

const results = [];
let count = 0;

fs.createReadStream('temp_sheet.csv')
  .pipe(csv({ headers: false }))
  .on('data', (data) => {
    if (count < 20) {
      results.push(data);
      count++;
    }
  })
  .on('end', () => {
    fs.writeFileSync('preview.json', JSON.stringify(results, null, 2), 'utf8');
    console.log('Finished writing preview.json');
  });
