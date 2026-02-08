require('dotenv').config();

const config = {
  port: process.env.PORT || 8080,
  apiKey: process.env.API_KEY || 'default_key',
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV || 'development',
  binance: {
    tickerUrl: 'https://eapi.binance.com/eapi/v1/ticker',
    markUrl: 'https://eapi.binance.com/eapi/v1/mark',
  },
  cache: {
    refreshInterval: 5 * 60 * 1000, // 5 minutes
  },
  ws: {
    heartbeatInterval: 30000,
  },
};

module.exports = config;
