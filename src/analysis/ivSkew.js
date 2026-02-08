function findByDelta(options, targetDelta, type) {
  const filtered = options.filter(o => {
    const isType = type==='CALL'
      ? (o.side==='CALL' || o.symbol.includes('-C'))
      : (o.side==='PUT' || o.symbol.includes('-P'));
    return isType && o.delta!=null;
  });
  if (filtered.length===0) return null;
  let closest = filtered[0];
  let minD = Math.abs(
    Math.abs(parseFloat(closest.delta))-targetDelta);
  for (const o of filtered) {
    const d = Math.abs(
      Math.abs(parseFloat(o.delta))-targetDelta);
    if (d < minD) { minD=d; closest=o; }
  }
  return closest;
}

function findByMoneyness(options, spot, pctOtm, type) {
  const filtered = options.filter(o => {
    return type==='CALL'
      ? (o.side==='CALL' || o.symbol.includes('-C'))
      : (o.side==='PUT' || o.symbol.includes('-P'));
  });
  if (filtered.length===0) return null;
  const target = type==='CALL'
    ? spot*(1+pctOtm/100) : spot*(1-pctOtm/100);
  let closest = filtered[0];
  let minD = Math.abs(
    parseFloat(closest.strikePrice)-target);
  for (const o of filtered) {
    const d = Math.abs(
      parseFloat(o.strikePrice)-target);
    if (d < minD) { minD=d; closest=o; }
  }
  return closest;
}

function analyzeSkew(optionsData, underlying, spotPrice) {
  const filtered = optionsData.filter(
    o => o.symbol.startsWith(underlying));
  const expiries = [...new Set(
    filtered.map(o => o.symbol.split('-')[1])
  )].sort();
  const results = [];
  for (const expiry of expiries) {
    const exOpts = filtered.filter(
      o => o.symbol.includes('-'+expiry+'-'));
    const putOpt = findByDelta(exOpts, 0.25, 'PUT')
      || findByMoneyness(exOpts, spotPrice, 10, 'PUT');
    const callOpt = findByDelta(exOpts, 0.25, 'CALL')
      || findByMoneyness(exOpts, spotPrice, 10, 'CALL');
    if (!putOpt || !callOpt) continue;
    const putIv = parseFloat(
      putOpt.markIV || putOpt.iv || 0);
    const callIv = parseFloat(
      callOpt.markIV || callOpt.iv || 0);
    if (putIv===0 || callIv===0) continue;
    const skew = putIv - callIv;
    let signal='NEUTRAL',
      description='Skew in normal range.',
      severity='LOW';
    if (skew < -0.05) {
      signal='BULLISH';
      description='Calls more expensive - '
        + 'market expects upside.';
      severity='HIGH';
    } else if (skew > 0.15) {
      signal='STRONG_BEARISH';
      description='Puts much more expensive - '
        + 'market hedging heavily.';
      severity='HIGH';
    } else if (skew > 0.05) {
      signal='BEARISH';
      description='Puts more expensive - '
        + 'normal hedge, bearish lean.';
      severity='LOW';
    }
    results.push({
      underlying, expiry,
      skew25d: parseFloat(skew.toFixed(4)),
      putIv: parseFloat(putIv.toFixed(4)),
      callIv: parseFloat(callIv.toFixed(4)),
      putStrike: parseFloat(putOpt.strikePrice),
      callStrike: parseFloat(callOpt.strikePrice),
      signal, description, severity,
    });
  }
  return results;
}
module.exports = { analyzeSkew };
