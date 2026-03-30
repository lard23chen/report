function doGet(e) {
  var sheetName = (e && e.parameter && e.parameter.sheet)
    ? e.parameter.sheet
    : 'workitem';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ ok: false, error: 'Sheet not found: ' + sheetName });

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return jsonResponse({ ok: true, data: [] });
  var dataRows = rows.slice(1);
  var data;

  if (sheetName === 'workitem') {
    data = dataRows
      .map(function(r) { return { item: r[0], url: r[1], note: r[2] }; })
      .filter(function(r) { return r.item; });

  } else if (sheetName === 'Stock_Portfolio') {
    data = dataRows
      .map(function(r) {
        return {
          date:       String(r[0]  || ''),
          type:       String(r[1]  || ''),
          code:       String(r[2]  || ''),
          name:       String(r[3]  || ''),
          buyShares:  Number(r[4])  || 0,
          buyPrice:   Number(r[5])  || 0,
          sellShares: Number(r[6])  || 0,
          sellPrice:  Number(r[7])  || 0,
          fee:        Number(r[8])  || 0,
          tax:        Number(r[9])  || 0,
          amount:     Number(r[10]) || 0,
          cost:       Number(r[11]) || 0,
          spend:      Number(r[12]) || 0,
          income:     Number(r[13]) || 0,
          note:       String(r[14] || ''),
          person:     String(r[15] || 'alex')
        };
      })
      .filter(function(r) { return r.date || r.code; });

  } else {
    return jsonResponse({ ok: false, error: 'Unknown sheet: ' + sheetName });
  }

  return jsonResponse({ ok: true, data: data });
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var sheetName = body.sheet || 'workitem';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ ok: false, error: 'Sheet not found: ' + sheetName });

  if (sheetName === 'workitem') {
    handleTeamResources(sheet, body);
  } else if (sheetName === 'Stock_Portfolio') {
    handleStockPortfolio(sheet, body);
  }
  return jsonResponse({ ok: true });
}

function handleTeamResources(sheet, body) {
  var rowNum = Number(body.index) + 2;
  if (body.action === 'add') {
    sheet.appendRow([body.item || '', body.url || '', body.note || '']);
  } else if (body.action === 'update') {
    sheet.getRange(rowNum, 1, 1, 3).setValues([[
      body.item || '', body.url || '', body.note || ''
    ]]);
  } else if (body.action === 'delete') {
    sheet.deleteRow(rowNum);
  }
}

function handleStockPortfolio(sheet, body) {
  var rowNum = Number(body.index) + 2;
  if (body.action === 'add') {
    sheet.appendRow([
      body.date,      body.type,       body.code,      body.name,
      body.buyShares, body.buyPrice,   body.sellShares, body.sellPrice,
      body.fee,       body.tax,        body.amount,    body.cost,
      body.spend,     body.income,     body.note || '', body.person
    ]);
  } else if (body.action === 'update') {
    sheet.getRange(rowNum, 1, 1, 16).setValues([[
      body.date,      body.type,       body.code,      body.name,
      body.buyShares, body.buyPrice,   body.sellShares, body.sellPrice,
      body.fee,       body.tax,        body.amount,    body.cost,
      body.spend,     body.income,     body.note || '', body.person
    ]]);
  } else if (body.action === 'delete') {
    sheet.deleteRow(rowNum);
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
