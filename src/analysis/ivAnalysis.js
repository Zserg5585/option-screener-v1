function getAtmIv(optionsData, underlying, spotPrice) {
  const calls = optionsData.filter(o =>
    o.symbol.startsWith(underlying)
    && (o.side==='CALL' || o.symbol.includes('-C'))
  );
  if (calls.length===0 || !spotPrice) return null;
  let closest = calls[0];
  let minD = Math.abs(
    parseFloat(closest.strikePrice) - spotPrice);
  for (const opt of calls) {
    const d = Math.abs(
      parseFloat(opt.strikePrice) - spotPrice);
    if (d < minD) { minD = d; closest = opt; }
  }
  return {
    iv: parseFloat(closest.markIV || closest.iv || 0),
    strike: parseFloat(closest.strikePrice),
    symbol: closest.symbol,
  };
}

function calculateIvRankAndPercentile(currentIv, hist) {
  if (!hist || hist.length === 0) {
    return { ivRank: null, ivPercentile: null,
      dataPoints: 0,
      message: 'Not enough historical data' };
  }
  const minIv = Math.min(...hist);
  const maxIv = Math.max(...hist);
  const avgIv = hist.reduce((a,b) => a+b, 0)/hist.length;
  const ivRank = maxIv !== minIv
    ? ((currentIv-minIv)/(maxIv-minIv))*100 : 50;
  const belowCount = hist.filter(
    iv => iv < currentIv).length;
  const ivPercentile = (belowCount/hist.length)*100;
  const ivChange = ((currentIv-avgIv)/avgIv)*100;
  let status = 'NORMAL';
  if (ivChange > 20) status = 'SPIKE';
  else if (ivChange < -20) status = 'CRUSH';
  else if (ivChange > 10) status = 'ELEVATED';
  else if (ivChange < -10) status = 'DEPRESSED';
  let signal = { direction: 'NEUTRAL',
    confidence: 'LOW',
    description: 'IV in normal range.' };
  if (status==='SPIKE' || ivRank > 80) {
    signal = { direction: 'SELL_PREMIUM',
      confidence: ivRank>90 ? 'HIGH' : 'MEDIUM',
      description: 'IV high - options overpriced. '
        + 'Consider selling premium.' };
  } else if (status==='CRUSH' || ivRank < 20) {
    signal = { direction: 'BUY_PREMIUM',
      confidence: ivRank<10 ? 'HIGH' : 'MEDIUM',
      description: 'IV low - options underpriced. '
        + 'Consider buying premium.' };
  }
  return {
    currentIv,
    ivRank: parseFloat(ivRank.toFixed(2)),
    ivPercentile: parseFloat(ivPercentile.toFixed(2)),
    minIv: parseFloat(minIv.toFixed(4)),
    maxIv: parseFloat(maxIv.toFixed(4)),
    avgIv: parseFloat(avgIv.toFixed(4)),
    ivChangeFromAvg: parseFloat(ivChange.toFixed(2)),
    status, dataPoints: hist.length, signal,
  };
}
module.exports = {
  getAtmIv, calculateIvRankAndPercentile };
