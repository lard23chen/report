/**
 * stock_prices_api.js
 * Vercel serverless — 即時抓取 Yahoo Finance 報價
 * GET /api/stock-prices → { ok, prices: { AAPL: 182.5, ... }, fetchedAt }
 */
const express = require('express');
const https   = require('https');
const cors    = require('cors');

const app = express();
app.use(cors());

const SYMBOLS = ['AAPL','AMD','BNDW','EWJ','TLT','LLY'];

function fetchYahooPrice(symbol) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'query1.finance.yahoo.com',
      path: `/v8/finance/chart/${symbol}?range=1d&interval=1d&includePrePost=false`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const meta  = json?.chart?.result?.[0]?.meta;
          const price = meta?.regularMarketPrice;
          resolve({ symbol, price: typeof price === 'number' ? +price.toFixed(4) : null });
        } catch {
          resolve({ symbol, price: null });
        }
      });
    });
    req.on('error', () => resolve({ symbol, price: null }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ symbol, price: null }); });
  });
}

// GET /api/stock-prices
app.get('/api/stock-prices', async (req, res) => {
  try {
    const results = await Promise.all(SYMBOLS.map(fetchYahooPrice));
    const prices  = {};
    results.forEach(({ symbol, price }) => {
      if (price !== null) prices[symbol] = price;
    });
    res.json({ ok: true, prices, fetchedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, prices: {} });
  }
});

module.exports = app;
