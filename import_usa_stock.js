require('dotenv').config({ path: __dirname + '/.env', quiet: true });
/**
 * import_usa_stock.js
 * 讀取 aiinvest20260529 (2)~(7).xlsx，寫入 MongoDB AlexLIFE/USA_Stock
 * 執行: node import_usa_stock.js
 *
 * 策略：先清除 USA_Stock 全部文件，再重新 insertMany（確保冪等）
 */

const XLSX       = require('xlsx');
const path       = require('path');
const { MongoClient } = require('mongodb');

const MONGO_URI  = process.env.MONGODB_URI_PERSONAL;
const DB_NAME    = 'AlexLIFE';
const COLLECTION = 'USA_Stock';
const DIR        = __dirname;

// ── 1. 讀取所有 xlsx ──────────────────────────────────────────────────────────
const files = [2,3,4,5,6,7].map(n => path.join(DIR, `aiinvest20260529 (${n}).xlsx`));

// Excel serial date → YYYY/MM/DD
function excelDateToStr(serial) {
  // Excel epoch: 1900/1/1 = 1（有個 1900 閏年 bug，1900/3/1 之後要 -1）
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd= String(d.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${dd}`;
}

function parseDate(raw) {
  if (typeof raw === 'number') return excelDateToStr(raw);
  return String(raw).trim();
}

function extractCode(name) {
  const m = name.match(/\(([^)]+)\)/);
  return m ? m[1] : name.trim();
}

const SHORT_NAME = {
  AAPL:'蘋果', AMD:'超微半導體', BNDW:'全球債券ETF',
  EWJ:'日本ETF', TLT:'長期美債ETF', LLY:'禮來'
};

let allDocs = [];
for (const f of files) {
  const wb   = XLSX.readFile(f);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;

    const dateStr   = parseDate(r[0]);
    const stockName = String(r[1]).trim();
    const code      = extractCode(stockName);
    const action    = String(r[2]).trim();   // 買進 / 賣出
    const shares    = parseFloat(r[3]) || 0;
    const price     = parseFloat(r[4]) || 0;
    const amount    = parseFloat(r[5]) || 0;
    const currency  = String(r[6]).trim() || 'USD';
    const fee       = parseFloat(r[7]) || 0;
    const otherFee  = parseFloat(r[8]) || 0;
    const totalFee  = fee + otherFee;
    const net       = parseFloat(r[10]) || 0;

    // 轉成 JS Date 供 MongoDB 時間查詢
    const parts = dateStr.split('/');
    const dateObj = new Date(
      parseInt(parts[0]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2])
    );

    allDocs.push({
      date:       dateStr,                       // "YYYY/MM/DD" 字串
      dateObj:    dateObj,                       // ISODate 供排序/範圍查詢
      year:       dateObj.getFullYear(),
      month:      dateObj.getMonth() + 1,
      yearMonth:  `${dateObj.getFullYear()}/${String(dateObj.getMonth()+1).padStart(2,'0')}`,
      code:       code,                          // "AAPL"
      name:       SHORT_NAME[code] || stockName, // "蘋果"
      fullName:   stockName,                     // "蘋果(AAPL)"
      action:     action,                        // "買進" / "賣出"
      isBuy:      action.includes('買'),
      shares:     shares,
      price:      price,
      amount:     amount,
      currency:   currency,
      fee:        fee,
      otherFee:   otherFee,
      totalFee:   totalFee,
      net:        net,
      totalCost:  action.includes('買') ? amount + totalFee : null,  // 買進總成本
      netReturn:  action.includes('賣') ? amount - totalFee : null,  // 賣出淨回收
    });
  }
}

// 按日期升序
allDocs.sort((a, b) => a.date.localeCompare(b.date));

console.log(`📦 解析完成：共 ${allDocs.length} 筆`);
console.log(`   日期範圍：${allDocs[0].date} ~ ${allDocs[allDocs.length-1].date}`);
const codes = [...new Set(allDocs.map(d => d.code))];
console.log(`   標的：${codes.join(', ')}`);

// ── 2. 寫入 MongoDB ───────────────────────────────────────────────────────────
async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('\n✅ MongoDB 連線成功');

    const db   = client.db(DB_NAME);
    const col  = db.collection(COLLECTION);

    // 清除舊資料
    const del = await col.deleteMany({});
    console.log(`🗑  已清除舊資料：${del.deletedCount} 筆`);

    // 插入新資料
    const ins = await col.insertMany(allDocs);
    console.log(`📥 已插入：${ins.insertedCount} 筆`);

    // 建立索引
    await col.createIndex({ dateObj: 1 });
    await col.createIndex({ code: 1, dateObj: 1 });
    await col.createIndex({ yearMonth: 1 });
    await col.createIndex({ isBuy: 1 });
    console.log('🔍 索引建立完成（dateObj, code+dateObj, yearMonth, isBuy）');

    // 驗證
    const total   = await col.countDocuments();
    const byCode  = await col.aggregate([
      { $group: { _id: '$code', count: { $sum: 1 }, totalAmt: { $sum: '$amount' } } },
      { $sort:  { _id: 1 } }
    ]).toArray();

    console.log(`\n📊 驗證（總計 ${total} 筆）：`);
    for (const g of byCode) {
      console.log(`   ${g._id.padEnd(5)} ${String(g.count).padStart(3)} 筆  | 成交額 $${g.totalAmt.toFixed(2)}`);
    }

    console.log(`\n✅ 完成！資料已存入 ${DB_NAME}/${COLLECTION}`);

  } catch (err) {
    console.error('❌ 錯誤：', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
