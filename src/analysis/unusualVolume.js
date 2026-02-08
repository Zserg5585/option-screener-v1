function findUnusualVolume(optionsData, spotPrices, cfg = {}) {
  const { minVoiRatio=3, minVolume=1, limit=30,
    underlying=null } = cfg;
  const results = [];
  for (const opt of optionsData) {
    if (underlying && !opt.symbol.startsWith(underlying))
      continue;
    const volume = parseFloat(opt.volume || 0);
    const oi = parseFloat(opt.openInterest || opt.oi || 0);
    if (volume < minVolume) continue;
    const voiRatio = oi > 0 ? volume/oi : (volume>0?999:0);
    if (voiRatio < minVoiRatio) continue;
    const parts = opt.symbol.split('-');
    const asset = parts[0];
    const strike = parseFloat(parts[2] || opt.strikePrice);
    const spot = spotPrices[asset] || 0;
    const lastPrice = parseFloat(
      opt.lastPrice || opt.close || 0);
    const premiumUsd = lastPrice * volume * spot;
    const isCall = opt.side==='CALL'
      || opt.symbol.includes('-C');
    const isItm = isCall ? spot>strike : spot<strike;
    const distPct = spot>0 ? ((strike-spot)/spot)*100 : 0;
    let severity = 'LOW';
    if (voiRatio > 10) severity = 'EXTREME';
    else if (voiRatio > 5) severity = 'HIGH';
    else if (voiRatio > 3) severity = 'MEDIUM';
    let direction = isCall ? 'BULLISH' : 'BEARISH';
    let confidence = 'MEDIUM';
    if (isItm) {
      confidence = 'HIGH';
      direction = isCall ? 'STRONG_BULLISH':'STRONG_BEARISH';
    }
    if (premiumUsd > 100000) confidence = 'HIGH';
    const descs = {
      EXTREME: 'Extreme activity! V/OI>10x.',
      HIGH: 'High unusual activity. V/OI>5x.',
      MEDIUM: 'Notable unusual activity. V/OI>3x.',
      LOW: 'Moderate activity.',
    };
    results.push({
      symbol: opt.symbol, underlying: asset, strike,
      type: isCall?'CALL':'PUT', expiry: parts[1],
      volume, openInterest: oi,
      voiRatio: parseFloat(voiRatio.toFixed(2)),
      lastPrice,
      premiumUsd: parseFloat(premiumUsd.toFixed(2)),
      spotPrice: spot, moneyness: isItm?'ITM':'OTM',
      distancePercent: parseFloat(distPct.toFixed(2)),
      delta: opt.delta ? parseFloat(opt.delta) : null,
      iv: opt.markIV ? parseFloat(opt.markIV) : null,
      signal: { severity, direction, confidence,
        description: descs[severity] },
    });
  }
  results.sort((a,b) => b.voiRatio - a.voiRatio);
  return { count: Math.min(results.length, limit),
    totalFound: results.length,
    data: results.slice(0, limit) };
}
module.exports = { findUnusualVolume };
