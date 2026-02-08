const { Router } = require('express');
const { checkApiKey } = require('../middleware/auth');
const { cache } = require('../services/cache');
const { fetchSpotPrices } = require('../services/binance');
const { findUnusualVolume } = require('../analysis/unusualVolume');
const { findTopMovers } = require('../analysis/topMovers');
const { calculateAllMaxPain } = require('../analysis/maxPain');
const { getAtmIv, calculateIvRankAndPercentile } = require('../analysis/ivAnalysis');
const { analyzeAllPCRatios } = require('../analysis/putCallRatio');
const { analyzeSkew } = require('../analysis/ivSkew');
const { findGammaPlays } = require('../analysis/gammaPlay');

const router = Router();

function mergeGreeks(optionsData) {
  if (!cache.greeks) return optionsData;
  return optionsData.map(o => {
    const g = cache.greeks[o.symbol];
    if (!g) return o;
    return {
      ...o,
      delta: g.delta,
      gamma: g.gamma,
      theta: g.theta,
      vega: g.vega,
      markIV: g.markIV,
      strikePrice: g.strikePrice || o.strikePrice,
      side: g.side || o.side,
    };
  });
}

router.get('/api/signals/unusual-volume', checkApiKey, async (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  const spotPrices = await fetchSpotPrices();
  const data = mergeGreeks(cache.options);
  const result = findUnusualVolume(data, spotPrices, {
    underlying: req.query.underlying || null,
    limit: parseInt(req.query.limit) || 30,
  });
  res.json({ success: true, lastUpdate: cache.lastUpdate, ...result });
});

router.get('/api/signals/iv-analysis', checkApiKey, async (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  const spotPrices = await fetchSpotPrices();
  const data = mergeGreeks(cache.options);
  const results = {};
  for (const [asset, spot] of Object.entries(spotPrices)) {
    const atm = getAtmIv(data, asset, spot);
    if (atm) {
      results[asset] = {
        ...atm,
        spotPrice: spot,
        ...calculateIvRankAndPercentile(atm.iv, []),
      };
    }
  }
  res.json({ success: true, lastUpdate: cache.lastUpdate, data: results });
});

router.get('/api/signals/max-pain', checkApiKey, async (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  const spotPrices = await fetchSpotPrices();
  const data = mergeGreeks(cache.options);
  const result = calculateAllMaxPain(data, spotPrices);
  res.json({ success: true, lastUpdate: cache.lastUpdate, count: result.length, data: result });
});

router.get('/api/signals/oi-concentration', checkApiKey, async (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  const data = mergeGreeks(cache.options);
  const underlying = req.query.underlying ? req.query.underlying.toUpperCase() : null;
  const filtered = underlying
    ? data.filter(o => o.symbol.startsWith(underlying + '-'))
    : data;

  const strikes = {};
  for (const o of filtered) {
    const parts = o.symbol.split('-');
    const strike = parseFloat(parts[2] || o.strikePrice);
    if (!strike) continue;
    const oi = parseFloat(o.openInterest || o.oi || 0);
    const isCall = o.side === 'CALL' || o.symbol.includes('-C');
    if (!strikes[strike]) strikes[strike] = { strike, callOi: 0, putOi: 0, totalOi: 0 };
    if (isCall) strikes[strike].callOi += oi;
    else strikes[strike].putOi += oi;
    strikes[strike].totalOi += oi;
  }

  const sorted = Object.values(strikes)
    .sort((a, b) => b.totalOi - a.totalOi)
    .slice(0, parseInt(req.query.limit) || 20);

  res.json({
    success: true,
    lastUpdate: cache.lastUpdate,
    underlying: underlying || 'ALL',
    count: sorted.length,
    data: sorted,
  });
});

router.get('/api/signals/put-call-ratio', checkApiKey, (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  const data = mergeGreeks(cache.options);
  const underlying = req.query.underlying ? req.query.underlying.toUpperCase() : null;
  const result = analyzeAllPCRatios(data, underlying);
  res.json({ success: true, lastUpdate: cache.lastUpdate, ...result });
});

router.get('/api/signals/iv-skew', checkApiKey, async (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  const spotPrices = await fetchSpotPrices();
  const data = mergeGreeks(cache.options);
  const results = {};
  for (const [asset, spot] of Object.entries(spotPrices)) {
    results[asset] = analyzeSkew(data, asset, spot);
  }
  res.json({ success: true, lastUpdate: cache.lastUpdate, data: results });
});

router.get('/api/signals/gamma-play', checkApiKey, async (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  const spotPrices = await fetchSpotPrices();
  const data = mergeGreeks(cache.options);
  const result = findGammaPlays(data, spotPrices, {
    limit: parseInt(req.query.limit) || 20,
  });
  res.json({ success: true, lastUpdate: cache.lastUpdate, count: result.length, data: result });
});

module.exports = router;
