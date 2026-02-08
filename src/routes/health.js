const { Router } = require('express');
const { cache } = require('../services/cache');

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    lastUpdate: cache.lastUpdate,
    optionsCount: cache.options ? cache.options.length : 0,
    greeksLoaded: !!cache.greeks,
  });
});

module.exports = router;
