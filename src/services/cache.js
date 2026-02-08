const cache = {
  options: null,
  greeks: null,
  lastUpdate: null,
};

function parseSymbol(symbol) {
  const parts = symbol.split('-');
  if (parts.length !== 4) return null;
  return {
    underlying: parts[0],
    expiry: parts[1],
    strike: parts[2],
    type: parts[3] === 'C' ? 'CALL' : 'PUT',
  };
}

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
        markIV: g.markIV,
      } : null,
    };
  });
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

module.exports = { cache, parseSymbol, enrichWithGreeks, applyFilters };
