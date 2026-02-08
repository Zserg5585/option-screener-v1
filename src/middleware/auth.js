const config = require('../config');

function checkApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key !== config.apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

module.exports = { checkApiKey };
