function calcPCRatio(optionsData, expiry, underlying) {
  const filtered = optionsData.filter(o => {
    const matchExp = o.symbol.includes('-'+expiry+'-');
    const matchUnd = underlying
      ? o.symbol.startsWith(underlying) : true;
    return matchExp && matchUnd;
  });
  let cV=0,pV=0,cOi=0,pOi=0,cC=0,pC=0;
  for (const o of filtered) {
    const isCall = o.side==='CALL'
      || o.symbol.includes('-C');
    const vol = parseFloat(o.volume || 0);
    const oi = parseFloat(o.openInterest||o.oi||0);
    if (isCall) { cV+=vol; cOi+=oi; cC++; }
    else { pV+=vol; pOi+=oi; pC++; }
  }
  const volR = cV>0 ? pV/cV : null;
  const oiR = cOi>0 ? pOi/cOi : null;
  return { expiry, underlying: underlying||'ALL',
    volumeRatio: volR?parseFloat(volR.toFixed(3)):null,
    oiRatio: oiR?parseFloat(oiR.toFixed(3)):null,
    callVolume:cV, putVolume:pV,
    callOi:cOi, putOi:pOi,
    callCount:cC, putCount:pC };
}

function getSentiment(ratio) {
  if (ratio===null)
    return { sentiment:'UNKNOWN', sentimentStrength:0 };
  if (ratio > 1.5) return { sentiment:'STRONG_BEARISH',
    sentimentStrength: Math.min((ratio-1)*50, 100) };
  if (ratio > 1.0) return { sentiment:'BEARISH',
    sentimentStrength: (ratio-0.5)*50 };
  if (ratio > 0.5) return { sentiment:'BULLISH',
    sentimentStrength: (1-ratio)*50 };
  return { sentiment:'STRONG_BULLISH',
    sentimentStrength: Math.min((1-ratio)*100, 100) };
}

function analyzeAllPCRatios(optionsData, underlying) {
  const expiries = [...new Set(
    optionsData.filter(o => underlying
      ? o.symbol.startsWith(underlying) : true)
      .map(o => o.symbol.split('-')[1])
  )].sort();
  const results = expiries.map(exp => {
    const r = calcPCRatio(optionsData, exp, underlying);
    return { ...r, ...getSentiment(r.volumeRatio) };
  });
  const avgArr = results
    .filter(r => r.volumeRatio!==null)
    .map(r => r.volumeRatio);
  const avg = avgArr.length > 0
    ? avgArr.reduce((a,b)=>a+b,0)/avgArr.length : 0;
  for (const r of results) {
    r.isAnomaly = false; r.anomalyType = null;
    if (r.volumeRatio!==null && avg>0
      && Math.abs(r.volumeRatio-avg) > avg*0.5) {
      r.isAnomaly = true;
      r.anomalyType = r.volumeRatio > avg
        ? 'EXCESS_PUTS' : 'EXCESS_CALLS';
    }
  }
  return { underlying: underlying||'ALL',
    avgVolumeRatio: avg?parseFloat(avg.toFixed(3)):null,
    expiries: results,
    anomalies: results.filter(r => r.isAnomaly) };
}
module.exports = { analyzeAllPCRatios };
