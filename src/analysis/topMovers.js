function findTopMovers(optionsData, config = {}) {
  const { underlying = null, limit = 10 } = config;
  const filtered = optionsData.filter(opt => {
    if (underlying && !opt.symbol.startsWith(underlying))
      return false;
    return parseFloat(opt.priceChange || 0) !== 0;
  });
  const enriched = filtered.map(opt => {
    const parts = opt.symbol.split('-');
    const priceChange = parseFloat(opt.priceChange || 0);
    const lastPrice = parseFloat(
      opt.lastPrice || opt.close || 0
    );
    const isCall = opt.side === 'CALL'
      || opt.symbol.includes('-C');
    return {
      symbol: opt.symbol,
      underlying: parts[0],
      expiry: parts[1],
      strike: parseFloat(parts[2] || opt.strikePrice),
      type: isCall ? 'CALL' : 'PUT',
      lastPrice, priceChange,
      volume: parseFloat(opt.volume || 0),
      delta: opt.delta ? parseFloat(opt.delta) : null,
      iv: opt.markIV ? parseFloat(opt.markIV) : null,
    };
  });
  enriched.sort((a, b) =>
    Math.abs(b.priceChange) - Math.abs(a.priceChange)
  );
  return {
    gainers: enriched
      .filter(o => o.priceChange > 0).slice(0, limit),
    losers: enriched
      .filter(o => o.priceChange < 0).slice(0, limit),
  };
}
module.exports = { findTopMovers };
