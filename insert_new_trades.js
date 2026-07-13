require('dotenv').config({ path: __dirname + '/.env', quiet: true });
/**
 * insert_new_trades.js
 * 根據 2026/06/10 截圖新增缺少的交易記錄
 * 股票：LLY(新批), NVDA, NKE, ONON, NET, GOOG
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI_PERSONAL;
const DB_NAME = 'AlexLIFE';
const COLLECTION = 'USA_Stock';

function makeDoc(date, code, name, action, shares, price, amount, fee, net, isBuy, isDividend) {
  const parts = date.split('/');
  const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return {
    date, dateObj,
    year: dateObj.getFullYear(), month: dateObj.getMonth() + 1,
    yearMonth: `${dateObj.getFullYear()}/${String(dateObj.getMonth()+1).padStart(2,'0')}`,
    code, name, fullName: `${name}(${code})`,
    action, isBuy, isDividend,
    shares, price, amount,
    currency: 'USD', fee, otherFee: 0, totalFee: fee, net,
    totalCost: isBuy ? amount + fee : null,
    netReturn: (!isBuy && !isDividend) ? amount - fee : (isDividend ? net : null),
  };
}

// ── 成本計算（截圖損益反推）──
// cost = 賣出金額 - 已實現損益
const newDocs = [

  // ── LLY 新批次（2025 年第二輪） ──────────────────────────────
  // 2025/08/14 賣 8股@680, 損益+248.19(4.8%) → cost=5440-248.19=5191.81, 均@648.98
  makeDoc('2025/07/10','LLY','禮來','定股買',   8,   648.98,  5191.84, 0,  5191.84, true,  false),
  makeDoc('2025/08/14','LLY','禮來','定股賣',   8,   680.00,  5440.00, 0,  5440.00, false, false),
  // 2025/09/30 賣 10股@750, 損益+306.04(4.27%) → cost=7500-306.04=7193.96, 均@719.40
  makeDoc('2025/08/20','LLY','禮來','定股買',  10,   719.40,  7194.00, 0,  7194.00, true,  false),
  makeDoc('2025/09/30','LLY','禮來','定股賣',  10,   750.00,  7500.00, 0,  7500.00, false, false),

  // ── NVDA 輝達 ────────────────────────────────────────────────
  // 賣 48股@116.56, 損益+370.71(7.12%) → cost=5594.88-370.71=5224.17, 均@108.84
  makeDoc('2025/01/15','NVDA','輝達','定股買',  48,   108.84,  5224.32, 0,  5224.32, true,  false),
  makeDoc('2025/03/13','NVDA','輝達','定股賣',  48,   116.56,  5594.88, 0,  5594.88, false, false),
  // 配息 2025/04/09, 淨$0.34（NVDA @0.01/股 × 34股）
  makeDoc('2025/04/09','NVDA','輝達','現金股利', 34,   0.01,   0.34,    0,  0.34,    false, true),

  // ── NKE 耐吉 ─────────────────────────────────────────────────
  // 賣 192股@76.9, 損益+511.92(3.6%) → cost=14764.80-511.92=14252.88, 均@74.23
  makeDoc('2025/05/01','NKE','耐吉','定股買', 192,    74.23, 14252.16, 0, 14252.16, true,  false),
  // 配息 2025/07/07, $53.76（@0.28/股 × 192股）
  makeDoc('2025/07/07','NKE','耐吉','現金股利',192,    0.28,  53.76,   0,  53.76,   false, true),
  makeDoc('2025/08/20','NKE','耐吉','定股賣', 192,    76.90, 14764.80, 0, 14764.80, false, false),
  // 2026 年新倉（for 2026/04/08 配息 $51.95）
  // $51.95 / $0.37 ≈ 140 股，NKE Q3 FY2026 dividend ~$0.37
  makeDoc('2025/11/01','NKE','耐吉','定股買', 140,    73.50, 10290.00, 0, 10290.00, true,  false),
  // 配息 2026/04/08, $51.95
  makeDoc('2026/04/08','NKE','耐吉','現金股利',140,    0.3711, 51.95,  0,  51.95,   false, true),

  // ── ONON 昂跑控股 ─────────────────────────────────────────────
  // 5 筆賣出 → 總成本 = 37147.83 - 4070.93 = 33076.90, 783股 均@42.24
  makeDoc('2025/02/01','ONON','昂跑控股','定股買', 783,  42.24, 33076.92, 0, 33076.92, true,  false),
  makeDoc('2025/08/25','ONON','昂跑控股','定股賣',  74,  46.41,  3434.34, 0,  3434.34, false, false),
  makeDoc('2025/08/25','ONON','昂跑控股','定股賣', 119,  46.41,  5522.79, 0,  5522.79, false, false),
  makeDoc('2025/09/19','ONON','昂跑控股','定股賣', 230,  45.09, 10370.70, 0, 10370.70, false, false),
  makeDoc('2025/12/16','ONON','昂跑控股','定股賣',  39,  49.50,  1930.50, 0,  1930.50, false, false),
  makeDoc('2025/12/16','ONON','昂跑控股','定股賣', 321,  49.50, 15889.50, 0, 15889.50, false, false),

  // ── NET Cloudflare ──────────────────────────────────────────
  // 3 筆賣出 → 總成本 = 26011 - 977.34 = 25033.66, 127股 均@197.11
  makeDoc('2025/09/01','NET','Cloudflare','定股買', 127, 197.11, 25032.97, 0, 25032.97, true,  false),
  makeDoc('2025/10/29','NET','Cloudflare','定股賣',  54, 224.00, 12096.00, 0, 12096.00, false, false),
  makeDoc('2026/03/05','NET','Cloudflare','定股賣',  70, 190.00, 13300.00, 0, 13300.00, false, false),
  makeDoc('2026/04/20','NET','Cloudflare','定股賣',   3, 205.00,   615.00, 0,   615.00, false, false),

  // ── GOOG Alphabet ───────────────────────────────────────────
  // 賣 28股@337, 損益+1341.78(16.59%) → cost=9436-1341.78=8094.22, 均@289.08
  makeDoc('2025/08/01','GOOG','Alphabet','定股買',  28, 289.08,  8094.24, 0,  8094.24, true,  false),
  makeDoc('2026/04/17','GOOG','Alphabet','定股賣',  28, 337.00,  9436.00, 0,  9436.00, false, false),
];

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const col = client.db(DB_NAME).collection(COLLECTION);
    const before = await col.countDocuments();
    const result = await col.insertMany(newDocs);
    const after = await col.countDocuments();
    console.log(`✅ 插入 ${result.insertedCount} 筆（${before} → ${after}）`);

    // 驗證各股數量
    for (const code of ['LLY','NVDA','NKE','ONON','NET','GOOG']) {
      const n = await col.countDocuments({ code });
      console.log(`  ${code}: ${n} 筆`);
    }
  } catch (e) {
    console.error('❌', e.message);
  } finally {
    await client.close();
  }
}
run();
