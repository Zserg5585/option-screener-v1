require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
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

updateCache();
setInterval(updateCache, 5 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
});
