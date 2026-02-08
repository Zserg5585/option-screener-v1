function parseDte(expiryStr) {
  if (!expiryStr || expiryStr.length!==6) return null;
  const year = 2000+parseInt(expiryStr.substring(0,2));
  const month = parseInt(expiryStr.substring(2,4))-1;
  const day = parseInt(expiryStr.substring(4,6));
  const expDate = new Date(year, month, day, 8, 0, 0);
  const diffMs = expDate.getTime() - Date.now();
  return Math.max(0,
    parseFloat((diffMs/86400000).toFixed(2)));
}

function findGammaPlays(optionsData, spotPrices, cfg={}) {
  const { maxDte=3, maxDistancePercent=5,
    limit=20 } = cfg;
  const results = [];
  for (const opt of optionsData) {
    const parts = opt.symbol.split('-');
    if (parts.length < 4) continue;
    const underlying = parts[0];
    const expiryStr = parts[1];
    const strike = parseFloat(parts[2]);
    const spot = spotPrices[underlying];
    if (!spot) continue;
    const dte = parseDte(expiryStr);
    if (dte===null || dte > maxDte) continue;
    const distPct = Math.abs(
      ((strike-spot)/spot)*100);
    if (distPct > maxDistancePercent) continue;
    const gamma = parseFloat(opt.gamma || 0);
    const delta = parseFloat(opt.delta || 0);
    const theta = parseFloat(opt.theta || 0);
    const lastPrice = parseFloat(
      opt.lastPrice || opt.close || 0);
    const isCall = opt.side==='CALL'
      || opt.symbol.includes('-C');
    const premiumMove = lastPrice > 0
      ? ((Math.abs(delta)*spot*0.01)/lastPrice)*100
      : 0;
    let strength = 'LOW';
    if (dte<=1 && distPct<2) strength = 'EXTREME';
    else if (dte<=2 && distPct<3) strength = 'HIGH';
    else if (dte<=3 && distPct<5) strength = 'MEDIUM';
    const descs = {
      EXTREME: 'Expiry today/tomorrow, price at '
        + 'strike. Premium can move 10-20x!',
      HIGH: 'Expiry 1-2 days, close to strike. '
        + 'High sensitivity to price movement.',
      MEDIUM: 'Expiry 2-3 days, moderate gamma. '
        + 'Good risk/reward for directional bets.',
      LOW: 'Weak gamma effect.',
    };
    results.push({
      symbol: opt.symbol, underlying,
      expiry: expiryStr, strike,
      type: isCall ? 'CALL' : 'PUT',
      dte, spotPrice: spot,
      distancePercent: parseFloat(distPct.toFixed(2)),
      moneyness: distPct<1 ? 'ATM'
        : (strike>spot ? 'OTM' : 'ITM'),
      lastPrice, gamma, delta, theta,
      iv: opt.markIV ? parseFloat(opt.markIV) : null,
      volume: parseFloat(opt.volume || 0),
      premiumMoveFor1Pct:
        parseFloat(premiumMove.toFixed(1)),
      signal: { strength,
        description: descs[strength] },
    });
  }
  results.sort((a,b) => b.gamma - a.gamma);
  return results.slice(0, limit);
}
module.exports = { findGammaPlays, parseDte };
