const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Credentials must come from Vercel env vars — never hardcode here.
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'AlexLIFE';
const PRODUCTS_COLLECTION = 'Structured_Products';
const EVENTS_COLLECTION = 'Structured_Products_Events';

// Global connection cache
let cachedClient = null;
let cachedDb = null;

async function getDb() {
    if (cachedDb) return cachedDb;
    if (!MONGO_URI) throw new Error('MONGO_URI env var is not set');
    console.log('=> connecting to database: ' + DB_NAME);
    const client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    cachedClient = client;
    cachedDb = db;
    return db;
}

// ---------- Products CRUD ----------

// GET: 取得所有商品（可用 ?status= 篩選）
app.get('/api/structured-products', async (req, res) => {
    try {
        const db = await getDb();
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        const data = await db.collection(PRODUCTS_COLLECTION).find(filter).sort({ maturityDate: 1 }).toArray();
        res.json({ ok: true, data });
    } catch (e) {
        console.error('API Error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST: 新增商品
app.post('/api/structured-products/add', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.collection(PRODUCTS_COLLECTION).insertOne(req.body);
        res.json({ ok: true, id: result.insertedId });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST: 修改商品
app.post('/api/structured-products/update', async (req, res) => {
    try {
        const db = await getDb();
        const { _id, ...updateData } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: 'Missing _id' });
        await db.collection(PRODUCTS_COLLECTION).updateOne({ _id: new ObjectId(_id) }, { $set: updateData });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST: 刪除商品
app.post('/api/structured-products/delete', async (req, res) => {
    try {
        const db = await getDb();
        const { _id } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: 'Missing _id' });
        await db.collection(PRODUCTS_COLLECTION).deleteOne({ _id: new ObjectId(_id) });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ---------- Events (cashflow) CRUD ----------

// GET: 取得事件紀錄（依 productId 篩選）
app.get('/api/structured-products/events', async (req, res) => {
    try {
        const db = await getDb();
        const filter = {};
        if (req.query.productId) filter.productId = req.query.productId;
        const data = await db.collection(EVENTS_COLLECTION).find(filter).sort({ date: -1 }).toArray();
        res.json({ ok: true, data });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST: 新增事件
app.post('/api/structured-products/events/add', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.collection(EVENTS_COLLECTION).insertOne(req.body);
        res.json({ ok: true, id: result.insertedId });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// POST: 刪除事件
app.post('/api/structured-products/events/delete', async (req, res) => {
    try {
        const db = await getDb();
        const { _id } = req.body;
        if (!_id) return res.status(400).json({ ok: false, error: 'Missing _id' });
        await db.collection(EVENTS_COLLECTION).deleteOne({ _id: new ObjectId(_id) });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ---------- Live risk calculation ----------

const YF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, */*',
    'Accept-Language': 'en-US,en;q=0.9'
};

// 抓近 3 個月每日收盤價（最新一筆在陣列最後）
// 注意：目前假設 ticker 為可直接被 Yahoo Finance 辨識的代號（美股）；
// 日股（如三菱重工、Tokyo Electron）需自行加上 .T 等交易所後綴，尚未處理。
async function fetchYahooHistory(symbol) {
    try {
        const r = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`,
            { headers: YF_HEADERS }
        );
        if (!r.ok) return null;
        const json = await r.json();
        const result = json?.chart?.result?.[0];
        const closes = result?.indicators?.quote?.[0]?.close;
        if (!Array.isArray(closes)) return null;
        return closes.filter(c => typeof c === 'number' && c > 0);
    } catch (e) {
        return null;
    }
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

// 近 20 日日報酬年化波動度（%）
function annualizedVol20d(closes) {
    if (!closes || closes.length < 21) return null;
    const recent = closes.slice(-21);
    const rets = [];
    for (let i = 1; i < recent.length; i++) {
        rets.push(Math.log(recent[i] / recent[i - 1]));
    }
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
    return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function daysBetween(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function nextFixingDate(fixings) {
    if (!Array.isArray(fixings)) return null;
    const upcoming = fixings
        .map(f => f.date)
        .filter(d => daysBetween(d) >= 0)
        .sort((a, b) => new Date(a) - new Date(b));
    return upcoming[0] || null;
}

// GET: 計算所有（或指定 status）商品的即時風險狀態，不寫回 DB
app.get('/api/structured-products/risk', async (req, res) => {
    try {
        const db = await getDb();
        const filter = req.query.status ? { status: req.query.status } : { status: { $in: ['進行中', '觀察中'] } };
        const products = await db.collection(PRODUCTS_COLLECTION).find(filter).toArray();

        const tickers = [...new Set(products.flatMap(p => (p.underlyings || []).map(u => u.ticker)))];
        const historyByTicker = {};
        await Promise.all(tickers.map(async t => {
            historyByTicker[t] = await fetchYahooHistory(t);
        }));

        const results = products.map(product => {
            const daysToNextFixing = (() => {
                const d = nextFixingDate(product.fixings);
                return d ? daysBetween(d) : 999;
            })();
            const daysScore = clamp((60 - daysToNextFixing) / 60 * 100, 0, 100);

            const underlyingResults = (product.underlyings || []).map(u => {
                const closes = historyByTicker[u.ticker];
                const currentPrice = closes && closes.length ? closes[closes.length - 1] : null;
                if (currentPrice == null || !u.strikePrice) {
                    return { ticker: u.ticker, currentPrice: null, distToKI: null, distToKO: null };
                }
                const currentPct = currentPrice / u.strikePrice * 100;
                const distToKI = u.kiBarrierPct != null ? currentPct - u.kiBarrierPct : null;
                const distToKO = u.koBarrierPct != null ? currentPct - u.koBarrierPct : null;

                const proximityScore = distToKI != null ? clamp((30 - distToKI) / 30 * 100, 0, 100) : 0;
                const vol = annualizedVol20d(closes);
                const volScore = vol != null ? clamp((vol - 20) / 40 * 100, 0, 100) : 0;
                const kiAbsolute = u.kiBarrierPct != null ? u.strikePrice * u.kiBarrierPct / 100 : null;
                const everClosedBelowKI = kiAbsolute != null && closes ? closes.some(c => c < kiAbsolute) : false;
                const breachedScore = everClosedBelowKI ? 100 : 0;

                return {
                    ticker: u.ticker, currentPrice, currentPct, distToKI, distToKO,
                    proximityScore, volScore, breachedScore, everClosedBelowKI
                };
            });

            // worst-of：取 distToKI 最小的標的代表整檔商品風險
            const withKI = underlyingResults.filter(u => u.distToKI != null);
            const worst = withKI.length ? withKI.reduce((a, b) => (a.distToKI < b.distToKI ? a : b)) : null;

            // CDRAN 等無股權標的（conditions 為信用/利率連結）的商品，不套用股權 KI/KO 風險模型
            if (!product.underlyings || product.underlyings.length === 0) {
                return {
                    productId: product._id,
                    riskScore: null,
                    status: '不適用',
                    hint: null,
                    daysToNextFixing,
                    worstUnderlying: null,
                    underlyings: [],
                    conditions: product.conditions || []
                };
            }

            let riskScore = 0;
            if (worst) {
                riskScore = 0.40 * worst.proximityScore + 0.20 * daysScore + 0.25 * worst.volScore + 0.15 * worst.breachedScore;
            }
            const status = riskScore < 30 ? '安全' : riskScore <= 60 ? '警戒' : '高風險';

            let hint = null;
            if (worst && worst.distToKO != null && worst.distToKO <= 0 && daysToNextFixing <= 30) {
                hint = '可能於下次觀察日提前贖回(KO)';
            }

            return {
                productId: product._id,
                riskScore: Math.round(riskScore),
                status,
                hint,
                daysToNextFixing,
                worstUnderlying: worst,
                underlyings: underlyingResults
            };
        });

        res.json({ ok: true, data: results, time: new Date().toLocaleString('zh-TW') });
    } catch (e) {
        console.error('Risk API Error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Support local development
if (process.env.NODE_ENV !== 'production') {
    const port = 3002;
    app.listen(port, () => console.log(`Structured Products API running at http://localhost:${port}`));
}

module.exports = app;
