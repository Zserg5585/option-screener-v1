const axios = require('axios');
const config = require('../config');

async function fetchOptions() {
  try {
    const resp = await axios.get(config.binance.tickerUrl);
    return resp.data;
  } catch (err) {
    console.error('Binance ticker error:', err.message);
    return null;
  }
}

async function fetchGreeks() {
  try {
    const resp = await axios.get(config.binance.markUrl);
    return resp.data;
  } catch (err) {
    console.error('Binance greeks error:', err.message);
    return null;
  }
}

async function fetchSpotPrices() {
  try {
    const resp = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      params: { symbols: '["BTCUSDT","ETHUSDT"]' },
    });
    const prices = {};
    for (const item of resp.data) {
      if (item.symbol === 'BTCUSDT') prices.BTC = parseFloat(item.price);
      if (item.symbol === 'ETHUSDT') prices.ETH = parseFloat(item.price);
    }
    return prices;
  } catch (err) {
    console.error('Binance spot price error:', err.message);
    return {};
  }
}

module.exports = { fetchOptions, fetchGreeks, fetchSpotPrices };
