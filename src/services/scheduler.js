const { fetchOptions, fetchGreeks } = require('./binance');
const { cache } = require('./cache');
const config = require('../config');

let broadcastFn = null;

function setBroadcast(fn) {
  broadcastFn = fn;
}

async function updateCache() {
  console.log(`[${new Date().toISOString()}] Updating cache...`);
  const [options, greeks] = await Promise.all([
    fetchOptions(),
    fetchGreeks(),
  ]);

  if (options) cache.options = options;
  if (greeks) {
    cache.greeks = {};
    greeks.forEach(g => {
      cache.greeks[g.symbol] = g;
    });
  }
  cache.lastUpdate = new Date().toISOString();
  console.log(`[${new Date().toISOString()}] Cache updated`);
}

async function updateAndBroadcast() {
  await updateCache();
  if (broadcastFn) broadcastFn();
}

function start() {
  updateAndBroadcast();
  setInterval(updateAndBroadcast, config.cache.refreshInterval);
}

module.exports = { updateCache, updateAndBroadcast, start, setBroadcast };
