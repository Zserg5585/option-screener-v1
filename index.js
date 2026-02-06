require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || 'default_key';

let cache = { options: null, lastUpdate: null };

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
    console.error('Binance error:', err.message);
    return null;
  }
}

async function updateCache() {
  console.log('Updating cache...');
  const data = await fetchOptions();
  if (data) {
    cache.options = data;
    cache.lastUpdate = new Date().toISOString();
    console.log('Cache updated:', cache.lastUpdate);
  }
}

// Парсинг symbol: BTC-260207-98000-C
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

// Применение фильтров
function applyFilters(options, query) {
  let result = options;
  
  // Фильтр по underlying
  if (query.underlying) {
    const u = query.underlying.toUpperCase();
    result = result.filter(o => o.symbol.startsWith(u + '-'));
  }
  
  // Фильтр по expiry (формат: 260207)
  if (query.expiry) {
    result = result.filter(o => o.symbol.includes('-' + query.expiry + '-'));
  }
  
  // Фильтр по типу (CALL или PUT)
  if (query.type) {
    const t = query.type.toUpperCase();
    const suffix = t === 'CALL' ? '-C' : '-P';
    result = result.filter(o => o.symbol.endsWith(suffix));
  }
  
  // Фильтр по минимальному strike
  if (query.minStrike) {
    const min = parseFloat(query.minStrike);
    result = result.filter(o => {
      const p = parseSymbol(o.symbol);
      return p && parseFloat(p.strike) >= min;
    });
  }
  
  // Фильтр по максимальному strike
  if (query.maxStrike) {
    const max = parseFloat(query.maxStrike);
    result = result.filter(o => {
      const p = parseSymbol(o.symbol);
      return p && parseFloat(p.strike) <= max;
    });
  }
  
  // Фильтр по минимальному volume
  if (query.minVolume) {
    const min = parseFloat(query.minVolume);
    result = result.filter(o => parseFloat(o.volume || 0) >= min);
  }
  
  return result;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    lastUpdate: cache.lastUpdate,
    optionsCount: cache.options ? cache.options.length : 0
  });
});

// Все опционы с фильтрами
app.get('/api/options', checkApiKey, (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  const filtered = applyFilters(cache.options, req.query);
  res.json({
    lastUpdate: cache.lastUpdate,
    count: filtered.length,
    filters: req.query,
    data: filtered
  });
});

// Summary статистика
app.get('/api/summary', checkApiKey, (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  
  const btc = cache.options.filter(o => o.symbol.startsWith('BTC-'));
  const eth = cache.options.filter(o => o.symbol.startsWith('ETH-'));
  
  const calcStats = (arr) => {
    const calls = arr.filter(o => o.symbol.endsWith('-C'));
    const puts = arr.filter(o => o.symbol.endsWith('-P'));
    const totalVol = arr.reduce((s, o) => 
      s + parseFloat(o.volume || 0), 0);
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

// Список доступных expiry дат
app.get('/api/expiries', checkApiKey, (req, res) => {
  if (!cache.options) {
    return res.status(503).json({ error: 'Data not ready' });
  }
  
  const expiries = new Set();
  cache.options.forEach(o => {
    const p = parseSymbol(o.symbol);
    if (p) expiries.add(p.expiry);
  });
  
  const sorted = Array.from(expiries).sort();
  res.json({
    lastUpdate: cache.lastUpdate,
    count: sorted.length,
    expiries: sorted
  });
});

updateCache();
setInterval(updateCache, 5 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
});
