// Hyperliquid node data indexed by LiqFlow. Never synthesizes liquidation prices
// from open interest, order-book depth, or Papertrade positions.
export const heatmapOrigin='https://node.liqflow.app';
export const heatmapRefreshMs=300000,heatmapMaxAgeMs=900000;
export function heatmapURL(market){if(!['BTC','ETH'].includes(market))throw Error('Unsupported Hyperliquid market');return `${heatmapOrigin}/api/coin/${market}/liq-levels`;}
export function validateHeatmapKey(value){if(typeof value!=='string'||value.length>256||/[\s\x00-\x1f\x7f]/.test(value)||/^(0x)?[0-9a-fA-F]{64}$/.test(value))throw Error('Use a LiqFlow data API key, never a wallet private key.');return value;}
export function parseHyperliquidHeatmap(raw,market,now=Date.now()){
  heatmapURL(market);const at=typeof raw?.snapshot_time==='string'&&/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(raw.snapshot_time)?Date.parse(raw.snapshot_time):NaN;
  if(!Number.isFinite(at)||at>now+5000||now-at>heatmapMaxAgeMs)throw Error('Hyperliquid snapshot missing, stale or future-dated; map hidden.');
  if(!Array.isArray(raw.levels)||raw.levels.length>10000||raw.coin!==undefined&&raw.coin!==market)throw Error('Invalid Hyperliquid liquidation levels');
  const merged=new Map();for(const row of raw.levels){
    if(!row||typeof row.liq_price!=='number'||!Number.isFinite(row.liq_price)||row.liq_price<=0||row.liq_price>1e9||(!Object.hasOwn(row,'long_notional')&&!Object.hasOwn(row,'short_notional')))throw Error('Invalid Hyperliquid liquidation price');
    const long=Object.hasOwn(row,'long_notional')?row.long_notional:0,short=Object.hasOwn(row,'short_notional')?row.short_notional:0;
    if(![long,short].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e15))throw Error('Invalid Hyperliquid liquidation notional');
    const prior=merged.get(row.liq_price)??{price:row.liq_price,long:0,short:0};prior.long+=long;prior.short+=short;if(prior.long+prior.short>1e15)throw Error('Invalid Hyperliquid liquidation total');merged.set(row.liq_price,prior);
  }
  const levels=[...merged.values()].sort((a,b)=>a.price-b.price),deltas=levels.slice(1).map((p,i)=>p.price-levels[i].price),width=deltas.length?Math.min(...deltas):0;
  // Observed API levels lie on one coarse grid. Refuse inconsistent spacing;
  // never stretch a band across missing buckets or invent finer resolution.
  if(width&&deltas.some(d=>Math.abs(d/width-Math.round(d/width))>1e-5))throw Error('Unsupported Hyperliquid bucket spacing');
  return {market,at,source:'Hyperliquid via LiqFlow',snapshot:raw.snapshot_time,bucketWidth:width,buckets:levels.map(p=>({...p,low:Math.max(0,p.price-width/2),high:p.price+width/2}))};
}
export function visibleHeatmapRange(map,range,reference){
  if(!['0.1','0.25','0.5','1','2','5','10','25'].includes(range))throw Error('Invalid heatmap range');
  if(!Number.isFinite(reference)||reference<=0)return {...map,range,buckets:[]};
  const from=reference*(1-Number(range)/100),to=reference*(1+Number(range)/100);
  return {...map,range,from,to,buckets:map.buckets.filter(b=>b.high>=from&&b.low<=to)};
}
