const { MongoClient } = require('mongodb');
const geoip = require('geoip-lite');

const uri = 'mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const isPrivateIP = ip => {
  const s = ip.toString().trim();
  return /^10\./.test(s) || /^192\.168\./.test(s) ||
         /^172\.(1[6-9]|2\d|3[01])\./.test(s) ||
         s === '127.0.0.1' || s === '::1';
};

const ipCache = {};
const lookup = ip => {
  if (!ip) return 'UNKNOWN';
  const key = ip.toString().trim();
  if (ipCache[key]) return ipCache[key];
  if (isPrivateIP(key)) return (ipCache[key] = 'INTERNAL');
  const geo = geoip.lookup(key);
  return (ipCache[key] = geo ? geo.country : 'UNKNOWN');
};

// "04-26 11:30 ~ 04-26 15:59" → { start:"2026-04-26 11:30", endExcl:"2026-04-26 16:00" }
function parseRange(range, year = 2026) {
  const [s, e] = range.split(' ~ ');
  const toDateTime = (part) => {
    const [md, t] = part.trim().split(' ');
    const [m, d] = md.split('-');
    return `${year}-${m}-${d} ${t}`;
  };
  const endStr = toDateTime(e);
  const [datePart, timePart] = endStr.split(' ');
  const [h, mn] = timePart.split(':').map(Number);
  const newMn = mn + 1;
  const newH  = newMn >= 60 ? h + 1 : h;
  const adjMn = newMn >= 60 ? 0    : newMn;
  const endExcl = `${datePart} ${String(newH).padStart(2,'0')}:${String(adjMn).padStart(2,'0')}`;
  return { start: toDateTime(s), endExcl };
}

// Row order matches the Google Sheet exactly
const EVENTS = [
  { name: '2026 YANG YOSEOP SOLO CONCERT ＜Fade In＞ IN TAIPEI',              range: '04-26 11:30 ~ 04-26 15:59' },
  { name: '2026 EXID CONCERT EXID：EXtra ID in TAIPEI',                        range: '04-18 10:30 ~ 04-18 14:59' },
  { name: "Solar '總有一顆屬於你的星球（Your Own Star）' LIVE",                 range: '04-15 11:30 ~ 04-15 12:59' },
  { name: 'NEXZ GLOBAL SHOWCASE EVENT ＜Mmchk：Not Typical＞ in TAIPEI',       range: '04-14 11:30 ~ 04-14 12:59' },
  { name: '2am Concert ［O－NEUL， 2am］ in Taipei',                           range: '04-10 11:30 ~ 04-10 12:59' },
  { name: 'KAO SUPASSARA BIRTHDAY FAN MEETING',                                range: '03-31 11:30 ~ 03-31 12:59' },
  { name: '孫淑媚《MAY好三十》演唱會－台北站(加場)',                             range: '03-28 10:30 ~ 03-28 11:59' },
  { name: '國泰世華銀行2026韋禮安「 HI WE1 韋，您好 巡迴演唱會」台北場 (加場)', range: '03-14 10:30 ~ 03-14 11:59' },
  { name: '2026台灣運彩中華職棒開季團圓大辦桌',                                range: '03-13 11:30 ~ 03-13 12:59' },
  { name: '孫淑媚《MAY好三十》演唱會－台北站',                                  range: '03-08 11:30 ~ 03-08 12:59' },
  { name: '崔立于安可場',                                                       range: '03-03 12:30 ~ 03-03 13:59' },
  { name: 'deca joins 2026 world tour',                                         range: '02-07 13:30 ~ 02-07 14:29' },
  { name: '7-ELEVEN高雄櫻花季 SAKURA FESTIVA',                                 range: '02-11 11:30 ~ 02-11 12:29' },
  { name: '2026蘇永康演唱會',                                                   range: '02-07 13:30 ~ 02-07 14:29' },
  { name: '2026 SEVENUS SPRING MINI CONCERT ［Stay With Us］ in TAIPEI',       range: null },
  { name: '2026 idntt 1st FANMEETING in TAIPEI ＜FIRST ACTION＞',              range: '01-31 11:30 ~ 01-31 12:29' },
  { name: '第40屆金唱片頒獎典禮 The 40th Golden Disc Awards',                  range: '01-07 18:30 ~ 01-07 19:29' },
];

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db('QwareAi').collection('Qware_Ticket_Data');

  console.log('Fetching records from MongoDB...');
  const all = await col.find(
    { '狀態': '正常' },
    { projection: { IP: 1, '訂單編號': 1, '交易時間': 1, '節目/商品名稱': 1 } }
  ).toArray();
  console.log(`Total 正常 records: ${all.length}\n`);

  const processed = all.map(r => ({
    ip:      r.IP,
    orderId: r['訂單編號']?.toString().split('_')[0] || 'X',
    time:    r['交易時間']?.toString() || '',
    evtName: r['節目/商品名稱']?.toString() || ''
  })).filter(r => r.time);

  const results = [];

  for (const event of EVENTS) {
    if (!event.range) {
      results.push({ name: event.name, tw: '-', ov: '-', twPct: '-', ovPct: '-', int: '-', unk: '-' });
      console.log(`[SKIP] ${event.name.substring(0, 45)} (無搶票時間)`);
      continue;
    }

    const { start, endExcl } = parseRange(event.range);

    const filtered = processed.filter(r => {
      if (r.time < start || r.time >= endExcl) return false;
      // No name filtering — use time range only
      return true;
    });

    const twO = new Set(), ovO = new Set(), intO = new Set(), unkO = new Set();
    let twT = 0, ovT = 0, intT = 0, unkT = 0;

    filtered.forEach(r => {
      const g  = lookup(r.ip);
      const gk = g === 'TW' ? 'TW' : g === 'INTERNAL' ? 'INTERNAL' : g === 'UNKNOWN' ? 'UNKNOWN' : 'OV';
      if      (gk === 'TW')       { twO.add(r.orderId);  twT++;  }
      else if (gk === 'OV')       { ovO.add(r.orderId);  ovT++;  }
      else if (gk === 'INTERNAL') { intO.add(r.orderId); intT++; }
      else                        { unkO.add(r.orderId); unkT++; }
    });

    const gO    = twO.size + ovO.size;
    const twPct = gO ? (twO.size / gO * 100).toFixed(1) + '%' : '-';
    const ovPct = gO ? (ovO.size / gO * 100).toFixed(1) + '%' : '-';

    results.push({
      name:  event.name,
      tw:    `${twO.size}筆/${twT}張`,
      ov:    `${ovO.size}筆/${ovT}張`,
      twPct,
      ovPct,
      int:   `${intO.size}筆`,
      unk:   `${unkO.size}筆`
    });

    console.log(`[OK] ${event.name.substring(0, 40).padEnd(41)} 台:${String(twO.size).padStart(4)}筆/${String(twT).padStart(4)}張 海:${String(ovO.size).padStart(3)}筆/${String(ovT).padStart(3)}張 TW%:${twPct.padStart(6)} 內:${intO.size} 未:${unkO.size}`);
  }

  console.log('\n========== 結果（貼回試算表 F~K 欄）==========');
  console.log('節目名稱\t台灣筆數/張數\t海外筆數/張數\t台灣占比\t海外占比\t內部訂單\tIP無法辨識');
  results.forEach(r =>
    console.log(`${r.name}\t${r.tw}\t${r.ov}\t${r.twPct}\t${r.ovPct}\t${r.int}\t${r.unk}`)
  );

  await client.close();
})().catch(console.error);
