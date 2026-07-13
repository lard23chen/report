require('dotenv').config({ path: __dirname + '/.env', quiet: true });
/**
 * fix_direct_profit_trades.js
 * 1. 刪除錯誤插入的合成買進記錄與舊賣出記錄
 * 2. 重新插入正確的「已實現損益」記錄（isDirectProfit: true）
 */
const { MongoClient } = require('mongodb');
const MONGO_URI = process.env.MONGODB_URI_PERSONAL;

function makeDoc(date, code, name, shares, price, profit) {
  const parts = date.split('/');
  const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return {
    date, dateObj,
    year: dateObj.getFullYear(), month: dateObj.getMonth() + 1,
    yearMonth: `${dateObj.getFullYear()}/${String(dateObj.getMonth()+1).padStart(2,'0')}`,
    code, name, fullName: `${name}(${code})`,
    action: '已實現損益', isBuy: false, isDividend: false, isDirectProfit: true,
    shares, price,
    amount: profit, currency: 'USD', fee: 0, otherFee: 0, totalFee: 0, net: profit,
    totalCost: null, netReturn: profit,
  };
}
function makeDivDoc(date, code, name, shares, pricePerSh, net) {
  const parts = date.split('/');
  const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return {
    date, dateObj,
    year: dateObj.getFullYear(), month: dateObj.getMonth() + 1,
    yearMonth: `${dateObj.getFullYear()}/${String(dateObj.getMonth()+1).padStart(2,'0')}`,
    code, name, fullName: `${name}(${code})`,
    action: '現金股利', isBuy: false, isDividend: true, isDirectProfit: false,
    shares, price: pricePerSh,
    amount: net, currency: 'USD', fee: 0, otherFee: 0, totalFee: 0, net,
    totalCost: null, netReturn: net,
  };
}

const newDocs = [
  // ── LLY 禮來（新批已實現）
  makeDoc('2025/08/14', 'LLY',  '禮來',       8,  680.00,   248.19),
  makeDoc('2025/09/30', 'LLY',  '禮來',      10,  750.00,   306.04),
  // ── NVDA 輝達
  makeDoc('2025/03/13', 'NVDA', '輝達',      48,  116.56,   370.71),
  makeDivDoc('2025/04/09', 'NVDA', '輝達',   34,    0.01,     0.34),
  // ── NKE 耐吉
  makeDivDoc('2025/07/07', 'NKE',  '耐吉',  192,    0.28,    53.76),
  makeDoc('2025/08/20', 'NKE',  '耐吉',     192,   76.90,   511.92),
  makeDivDoc('2026/04/08', 'NKE',  '耐吉',  140,   0.3711,   51.95),
  // ── ONON 昂跑控股
  makeDoc('2025/08/25', 'ONON', '昂跑控股',  74,   46.41,    96.81),
  makeDoc('2025/08/25', 'ONON', '昂跑控股', 119,   46.41,   107.17),
  makeDoc('2025/09/19', 'ONON', '昂跑控股', 230,   45.09,   175.37),
  makeDoc('2025/12/16', 'ONON', '昂跑控股',  39,   49.50,   536.19),
  makeDoc('2025/12/16', 'ONON', '昂跑控股', 321,   49.50,  3155.39),
  // ── NET Cloudflare
  makeDoc('2025/10/29', 'NET',  'Cloudflare', 54,  224.00,   382.35),
  makeDoc('2026/03/05', 'NET',  'Cloudflare', 70,  190.00,   505.93),
  makeDoc('2026/04/20', 'NET',  'Cloudflare',  3,  205.00,    89.06),
  // ── GOOG Alphabet
  makeDoc('2026/04/17', 'GOOG', 'Alphabet',  28,  337.00,  1341.78),
];

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const col = client.db('AlexLIFE').collection('USA_Stock');

    // 1. 刪除上一次錯誤插入的所有記錄（包含合成買進）
    const codes = ['NVDA','NKE','ONON','NET','GOOG'];
    const delCodes = await col.deleteMany({ code: { $in: codes } });
    console.log(`🗑  刪除 ${codes.join('/')} 舊記錄：${delCodes.deletedCount} 筆`);

    // LLY 新批次（2025/07–09 的合成買進 + 賣出）
    const delLLY = await col.deleteMany({
      code: 'LLY',
      date: { $in: ['2025/07/10','2025/08/14','2025/08/20','2025/09/30'] }
    });
    console.log(`🗑  刪除 LLY 合成記錄：${delLLY.deletedCount} 筆`);

    // 2. 插入正確格式
    const ins = await col.insertMany(newDocs);
    console.log(`✅ 插入 ${ins.insertedCount} 筆正確記錄`);

    const total = await col.countDocuments();
    console.log(`📦 總筆數：${total}`);
    for (const code of ['LLY','NVDA','NKE','ONON','NET','GOOG']) {
      const n = await col.countDocuments({ code });
      console.log(`   ${code}: ${n} 筆`);
    }
  } catch (e) {
    console.error('❌', e.message);
  } finally {
    await client.close();
  }
}
run();
