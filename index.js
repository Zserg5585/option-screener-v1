require('dotenv').config();
const express = require('express');
const axios = require('axios');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || 'default_key';

let cache = { 
  options: null, 
  greeks: null,
  lastUpdate: null 
};

function checkApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

async function fetchOptions() {
  try {
    const url = 'https://eapi.binance.com/eapi/v1/ticker';
    const resp = await axios.get(url);
    return resp.data;
  } catch (err) {
    console.error('Binance ticker error:', err.message);
    return null;
  }
}

async function fetchGreeks() {
  try {
    const url = 'https://eapi.binance.com/eapi/v1/mark';
    const resp = await axios.get(url);
    return resp.data;
  } catch (err) {
    console.error('Binance greeks error:', err.message);
    return null;
  }
}

async function updateCache() {
  console.log('Updating cache...');
  const [options, greeks] = await Promise.all([
    fetchOptions(),
    fetchGreeks()
  ]);
  
  if (options) cache.options = options;
  if (greeks) {
    // Создаём map для быстрого поиска
    cache.greeks = {};
    greeks.forEach(g => {
      cache.greeks[g.symbol] = g;
    });
  }
  cache.lastUpdate = new Date().toISOString();
  console.log('Cache updated:', cache.lastUpdate);
}

function parseSymbol(symbol) {
  const parts = symbol.split('-');
  if (parts.length !== 4) return null;
  return {
    underlying: parts[0],
    expiry: parts[1],
    strike: parts[2],
    type: parts[3] === 'C' ? 'CALL' : 'PUT'
  };
}

function applyFilters(options, query) {
  let result = options;
  
  if (query.underlying) {
    const u = query.underlying.toUpperCase();
    result = result.filter(o => o.symbol.startsWith(u + '-'));
  }
  
  if (query.expiry) {
    result = result.filter(o => o.symbol.includes('-' + query.expiry + '-'));
  }
  
  if (query.type) {
    const t = query.type.toUpperCase();
    const suffix = t === 'CALL' ? '-C' : '-P';
    result = result.filter(o => o.symbol.endsWith(suffix));
  }
  
  if (query.minStrike) {
    const min = parseFloat(query.minStrike);
    result = result.filter(o => {
      const p = parseSymbol(o.symbol);
      return p && parseFloat(p.strike) >= min;
    });
  }
  
  if (query.maxStrike) {
    const max = parseFloat(query.maxStrike);
    result = result.filter(o => {
      const p = parseSymbol(o.symbol);
      return p && parseFloat(p.strike) <= max;
    });
  }
  
  if (query.minVolume) {
    const min = parseFloat(query.minVolume);
    result = result.filter(o => parseFloat(o.volume || 0) >= min);
  }
  
  // Фильтры по грекам
  if (query.minDelta) {
    const min = parseFloat(query.minDelta);
    result = result.filter(o => {
      const g = cache.greeks[o.symbol];
      return g && parseFloat(g.delta) >= min;
    });
  }
  
  if (query.maxDelta) {
    const max = parseFloat(query.maxDelta);
    result = result.filter(o => {
      const g = cache.greeks[o.symbol];
      return g && parseFloat(g.delta) <= max;
    });
  }
  
  if (query.minGamma) {
    const min = parseFloat(query.minGamma);
    result = result.filter(o => {
      const g = cache.greeks[o.symbol];
      return g && parseFloat(g.gamma) >= min;
    });
  }
  
  if (query.minVega) {
    const min = parseFloat(query.minVega);
    result = result.filter(o => {
      const g = cache.greeks[o.symbol];
      return g && parseFloat(g.vega) >= min;
    });
  }
  
  if (query.minIV) {
    const min = parseFloat(query.minIV);
    result = result.filter(o => {
      const g = cache.greeks[o.symbol];
      return g && parseFloat(g.markIV) >= min;
    });
  }
  
  if (query.maxIV) {
    const max = parseFloat(query.maxIV);
    result = result.filter(o => {
      const g = cache.greeks[o.symbol];
      return g && parseFloat(g.markIV) <= max;
    });
  }
  
  return result;
}

// Добавляем греки к опционам
function enrichWithGreeks(options) {
  return options.map(o => {
    const g = cache.greeks ? cache.greeks[o.symbol] : null;
    return {
      ...o,
      greeks: g ? {
        delta: g.delta,
        gamma: g.gamma,
        theta: g.theta,
        vega: g.vega,
        markIV: g.markIV
      } : null
    };
  });
}

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    lastUpdate: cache.lastUpdate,
    optionsCount: cache.options ? cache.options.length : 0,
    greeksLoaded: !!cache.greeks
  });
});

app.get('/api/options', checkApiKey, (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  const filtered = applyFilters(cache.options, req.query);
  const enriched = enrichWithGreeks(filtered);
  res.json({
    lastUpdate: cache.lastUpdate,
    count: enriched.length,
    filters: req.query,
    data: enriched
  });
});

app.get('/api/summary', checkApiKey, (req, res) => {
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
      totalVolume: totalVol.toFixed(2)
    };
  };
  
  res.json({
    lastUpdate: cache.lastUpdate,
    BTC: calcStats(btc),
    ETH: calcStats(eth)
  });
});

app.get('/api/expiries', checkApiKey, (req, res) => {
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
    expiries: Array.from(expiries).sort()
  });
});

app.get('/api/top-movers', checkApiKey, (req, res) => {
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
    losers
  });
});

app.get('/api/unusual-volume', checkApiKey, (req, res) => {
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
      data: []
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
      volumeRatio: parseFloat((_vol / avgVolume).toFixed(2))
    }));

  res.json({
    lastUpdate: cache.lastUpdate,
    avgVolume: parseFloat(avgVolume.toFixed(4)),
    threshold: parseFloat(threshold.toFixed(4)),
    count: unusual.length,
    data: enrichWithGreeks(unusual)
  });
});

// --- WebSocket server ---
const wss = new WebSocket.Server({ server });

const VALID_CHANNELS = new Set(['BTC', 'ETH', 'all', 'top-movers', 'unusual-volume']);

function getChannelData(channel) {
  if (!cache.options) return null;

  if (channel === 'top-movers') {
    let items = cache.options
      .filter(o => o.priceChange != null && o.priceChange !== '')
      .map(o => ({ ...o, _change: parseFloat(o.priceChange) }));
    items.sort((a, b) => b._change - a._change);
    const gainers = items.slice(0, 10).map(({ _change, ...o }) => o);
    const losers = items.slice(-10).reverse().map(({ _change, ...o }) => o);
    return { type: 'update', channel: 'top-movers', lastUpdate: cache.lastUpdate, gainers, losers };
  }

  if (channel === 'unusual-volume') {
    let items = cache.options
      .filter(o => parseFloat(o.volume || 0) > 0)
      .map(o => ({ ...o, _vol: parseFloat(o.volume) }));
    if (items.length === 0) {
      return { type: 'update', channel: 'unusual-volume', lastUpdate: cache.lastUpdate, count: 0, data: [] };
    }
    const avgVolume = items.reduce((s, o) => s + o._vol, 0) / items.length;
    const threshold = avgVolume * 2;
    const unusual = items
      .filter(o => o._vol >= threshold)
      .sort((a, b) => b._vol - a._vol)
      .slice(0, 10)
      .map(({ _vol, ...o }) => ({ ...o, volumeRatio: parseFloat((_vol / avgVolume).toFixed(2)) }));
    return {
      type: 'update', channel: 'unusual-volume', lastUpdate: cache.lastUpdate,
      count: unusual.length, data: enrichWithGreeks(unusual)
    };
  }

  // BTC, ETH, or all
  let filtered = cache.options;
  if (channel !== 'all') {
    filtered = filtered.filter(o => o.symbol.startsWith(channel + '-'));
  }
  const enriched = enrichWithGreeks(filtered);
  return { type: 'update', channel, lastUpdate: cache.lastUpdate, count: enriched.length, data: enriched };
}

function broadcastUpdates() {
  wss.clients.forEach(ws => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const channel = ws._channel || 'all';
    const payload = getChannelData(channel);
    if (payload) {
      ws.send(JSON.stringify(payload));
    }
  });
}

wss.on('connection', (ws, req) => {
  ws._channel = 'all';
  ws._alive = true;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[WS] Client connected: ${ip} (default channel: all)`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.subscribe && VALID_CHANNELS.has(msg.subscribe.toUpperCase ? msg.subscribe : '')) {
        ws._channel = msg.subscribe;
        console.log(`[WS] ${ip} subscribed to: ${ws._channel}`);
        // Send current data immediately on subscribe
        const payload = getChannelData(ws._channel);
        if (payload) ws.send(JSON.stringify(payload));
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid channel. Use: BTC, ETH, all, top-movers, unusual-volume' }));
      }
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  });

  ws.on('pong', () => { ws._alive = true; });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected: ${ip}`);
  });

  // Send current data on connect
  const payload = getChannelData(ws._channel);
  if (payload) ws.send(JSON.stringify(payload));
});

// Heartbeat: ping every 30s, terminate unresponsive clients
const heartbeat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws._alive) return ws.terminate();
    ws._alive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

// --- Cache update & broadcast ---
async function updateAndBroadcast() {
  await updateCache();
  broadcastUpdates();
}

updateAndBroadcast();
setInterval(updateAndBroadcast, 5 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
  console.log(`[WS] WebSocket server ready on ws://0.0.0.0:${PORT}`);
});
