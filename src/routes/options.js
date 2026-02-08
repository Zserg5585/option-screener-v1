const { Router } = require('express');
const { checkApiKey } = require('../middleware/auth');
const { cache, parseSymbol, applyFilters, enrichWithGreeks } = require('../services/cache');

const router = Router();

router.get('/api/options', checkApiKey, (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  const filtered = applyFilters(cache.options, req.query);
  const enriched = enrichWithGreeks(filtered);
  res.json({
    lastUpdate: cache.lastUpdate,
    count: enriched.length,
    filters: req.query,
    data: enriched,
  });
});

router.get('/api/summary', checkApiKey, (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }

  const btc = cache.options.filter(o => o.symbol.startsWith('BTC-'));
  const eth = cache.options.filter(o => o.symbol.startsWith('ETH-'));

  const calcStats = (arr) => {
    const calls = arr.filter(o => o.symbol.endsWith('-C'));
    const puts = arr.filter(o => o.symbol.endsWith('-P'));
    const totalVol = arr.reduce((s, o) => s + parseFloat(o.volume || 0), 0);
    return {
      count: arr.length,
      calls: calls.length,
      puts: puts.length,
      totalVolume: totalVol.toFixed(2),
    };
  };

  res.json({
    lastUpdate: cache.lastUpdate,
    BTC: calcStats(btc),
    ETH: calcStats(eth),
  });
});

router.get('/api/expiries', checkApiKey, (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }

  const expiries = new Set();
  cache.options.forEach(o => {
    const p = parseSymbol(o.symbol);
    if (p) expiries.add(p.expiry);
  });

  res.json({
    lastUpdate: cache.lastUpdate,
    count: expiries.size,
    expiries: Array.from(expiries).sort(),
  });
});

router.get('/api/top-movers', checkApiKey, (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }

  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const underlying = req.query.underlying ? req.query.underlying.toUpperCase() : null;

  let items = cache.options
    .filter(o => o.priceChange != null && o.priceChange !== '')
    .map(o => ({ ...o, _change: parseFloat(o.priceChange) }));

  if (underlying) {
    items = items.filter(o => o.symbol.startsWith(underlying + '-'));
  }

  items.sort((a, b) => b._change - a._change);

  const gainers = items.slice(0, limit).map(({ _change, ...o }) => o);
  const losers = items.slice(-limit).reverse().map(({ _change, ...o }) => o);

  res.json({
    lastUpdate: cache.lastUpdate,
    limit,
    gainers,
    losers,
  });
});

router.get('/api/unusual-volume', checkApiKey, (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }

  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const underlying = req.query.underlying ? req.query.underlying.toUpperCase() : null;

  let items = cache.options
    .filter(o => parseFloat(o.volume || 0) > 0)
    .map(o => ({ ...o, _vol: parseFloat(o.volume) }));

  if (underlying) {
    items = items.filter(o => o.symbol.startsWith(underlying + '-'));
  }

  if (items.length === 0) {
    return res.json({
      lastUpdate: cache.lastUpdate,
      avgVolume: 0,
      threshold: 0,
      count: 0,
      data: [],
    });
  }

  const avgVolume = items.reduce((s, o) => s + o._vol, 0) / items.length;
  const threshold = avgVolume * 2;

  const unusual = items
    .filter(o => o._vol >= threshold)
    .sort((a, b) => b._vol - a._vol)
    .slice(0, limit)
    .map(({ _vol, ...o }) => ({
      ...o,
      volumeRatio: parseFloat((_vol / avgVolume).toFixed(2)),
    }));

  res.json({
    lastUpdate: cache.lastUpdate,
    avgVolume: parseFloat(avgVolume.toFixed(4)),
    threshold: parseFloat(threshold.toFixed(4)),
    count: unusual.length,
    data: enrichWithGreeks(unusual),
  });
});

module.exports = router;
