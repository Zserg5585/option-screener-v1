function calculateMaxPain(optionsData, expiry) {
  const exOpts = optionsData.filter(
    o => o.symbol.includes('-' + expiry + '-'));
  if (exOpts.length === 0) return null;
  const strikes = [...new Set(
    exOpts.map(o => parseFloat(o.strikePrice))
  )].sort((a,b) => a-b);
  const painByStrike = strikes.map(testPrice => {
    let totalPain = 0;
    for (const opt of exOpts) {
      const strike = parseFloat(opt.strikePrice);
      const oi = parseFloat(
        opt.openInterest || opt.oi || 0);
      if (oi === 0) continue;
      const isCall = opt.side === 'CALL'
        || opt.symbol.includes('-C');
      if (isCall)
        totalPain += Math.max(0, testPrice-strike) * oi;
      else
        totalPain += Math.max(0, strike-testPrice) * oi;
    }
    return { strike: testPrice, totalPain };
  });
  return painByStrike.reduce((min, cur) =>
    cur.totalPain < min.totalPain ? cur : min);
}

function calculateAllMaxPain(optionsData, spotPrices) {
  const expiries = [...new Set(
    optionsData.map(o => o.symbol.split('-')[1])
  )].sort();
  const results = [];
  for (const expiry of expiries) {
    const mp = calculateMaxPain(optionsData, expiry);
    if (!mp) continue;
    const underlying = optionsData.find(
      o => o.symbol.includes('-'+expiry+'-')
    ).symbol.split('-')[0];
    const spot = spotPrices[underlying] || 0;
    const distPct = spot > 0
      ? ((mp.strike-spot)/spot)*100 : 0;
    results.push({
      underlying, expiry,
      maxPainStrike: mp.strike, spotPrice: spot,
      distancePercent: parseFloat(distPct.toFixed(2)),
      distanceDirection:
        mp.strike > spot ? 'ABOVE' : 'BELOW',
    });
  }
  return results;
}
module.exports = { calculateMaxPain, calculateAllMaxPain };
