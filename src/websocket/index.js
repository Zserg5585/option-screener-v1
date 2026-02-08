const WebSocket = require('ws');
const config = require('../config');
const { cache, enrichWithGreeks } = require('../services/cache');

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
      count: unusual.length, data: enrichWithGreeks(unusual),
    };
  }

  let filtered = cache.options;
  if (channel !== 'all') {
    filtered = filtered.filter(o => o.symbol.startsWith(channel + '-'));
  }
  const enriched = enrichWithGreeks(filtered);
  return { type: 'update', channel, lastUpdate: cache.lastUpdate, count: enriched.length, data: enriched };
}

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

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

    const payload = getChannelData(ws._channel);
    if (payload) ws.send(JSON.stringify(payload));
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws._alive) return ws.terminate();
      ws._alive = false;
      ws.ping();
    });
  }, config.ws.heartbeatInterval);

  wss.on('close', () => clearInterval(heartbeat));

  return { wss, broadcastUpdates };
}

module.exports = { setupWebSocket };
