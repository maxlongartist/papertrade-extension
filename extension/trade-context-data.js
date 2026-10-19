import {chartQuoteView} from './chart-data.js';
import {validAddress} from './wallet-data.js';
const integer=(v,signed=false)=>typeof v==='string'&&(signed?/^-?\d{1,80}$/:/^\d{1,80}$/).test(v);
export function closedTradePage(data){
  if(!data||!Array.isArray(data.items)||data.items.length>200||!(data.nextCursor===null||typeof data.nextCursor==='string'&&data.nextCursor.length>0&&data.nextCursor.length<=2048))throw Error('Closed-trade history schema unavailable.');
  const seen=new Set();let prior=Infinity;
  const items=data.items.map(row=>{
    if(!row||!integer(row.positionId)||seen.has(row.positionId)||!/^0x[0-9a-fA-F]{64}$/.test(row.txHash??'')||!['PositionClosed','Liquidated'].includes(row.kind)||typeof row.isLong!=='boolean'||typeof row.symbol!=='string'||!/^[A-Z0-9]{1,16}$/.test(row.symbol)||!Number.isSafeInteger(row.leverage)||row.leverage<1||!Number.isSafeInteger(row.timestampMs)||!Number.isSafeInteger(row.openedAtMs)||row.openedAtMs<0||row.timestampMs<row.openedAtMs||row.timestampMs>prior)throw Error('Invalid closed-trade identity or ordering.');
    for(const key of ['priceScaleRaw','entryPriceRaw','exitPriceRaw','marginRaw','userPaidFeeRaw','paperMintedRaw'])if(!integer(row[key]))throw Error('Invalid closed-trade units.');
    if(BigInt(row.priceScaleRaw)<=0n||BigInt(row.entryPriceRaw)<=0n||BigInt(row.marginRaw)<=0n||!integer(row.adjustedPnlRaw,true))throw Error('Invalid closed-trade amounts.');
    seen.add(row.positionId);prior=row.timestampMs;
    const scale=Number(row.priceScaleRaw),entry=Number(row.entryPriceRaw)/scale,exit=Number(row.exitPriceRaw)/scale,margin=Number(row.marginRaw)/1e18;
    if(![entry,exit,margin].every(Number.isFinite))throw Error('Closed-trade amount too large.');
    return {id:row.positionId,market:row.symbol,side:row.isLong?'long':'short',entry,exit,margin,leverage:row.leverage,openedAt:row.openedAtMs,closedAt:row.timestampMs,outcome:row.kind,txHash:row.txHash.toLowerCase(),adjustedPnlRaw:row.adjustedPnlRaw,feeRaw:row.userPaidFeeRaw,netRaw:(BigInt(row.adjustedPnlRaw)-BigInt(row.userPaidFeeRaw)).toString(),paperRaw:row.paperMintedRaw};
  });return {items,nextCursor:data.nextCursor};
}
export function tradeHistoryUrl(owner,cursor=null){
  if(!validAddress(owner)||cursor!=null&&(typeof cursor!=='string'||!cursor||cursor.length>2048))throw Error('Invalid history request.');
  const params=new URLSearchParams({filter:'all',limit:'75'});if(cursor)params.set('cursor',cursor);params.sort();return `/query/accounts/${owner.toLowerCase()}/trades?${params}`;
}
export function closedStats(rows){
  let net=0n,fees=0n,wins=0,losses=0,peak=0n,equity=0n,drawdown=0n;
  for(const row of [...rows].sort((a,b)=>a.closedAt-b.closedAt||a.id.localeCompare(b.id))){const value=BigInt(row.netRaw);net+=value;fees+=BigInt(row.feeRaw);if(value>0n)wins++;if(value<0n)losses++;equity+=value;if(equity>peak)peak=equity;if(peak-equity>drawdown)drawdown=peak-equity;}
  return {count:rows.length,net:Number(net)/1e18,fees:Number(fees)/1e18,wins,losses,winRate:rows.length>=20?wins/rows.length:null,drawdown:Number(drawdown)/1e18};
}
export function walletExposure(positions,market){
  const rows=positions.filter(p=>p.market===market);let long=0,short=0;
  for(const p of rows){if(p.entry>0&&Number.isFinite(p.notional)){if(p.side==='long')long+=p.notional/p.entry;else short+=p.notional/p.entry;}}
  const gross=long+short,net=long-short,paired=gross?2*Math.min(long,short)/gross:0;
  return {count:rows.length,long,short,net,paired,bias:!gross?'flat':Math.abs(net)/gross<.1?'paired':net>0?'net long':'net short',leverageMin:rows.length?Math.min(...rows.map(p=>p.leverage)):null,leverageMax:rows.length?Math.max(...rows.map(p=>p.leverage)):null};
}
// Exposure is a sample of opted-in wallets, never a market-wide signal.
export function watchedExposure(wallets,states,market,{now=Date.now(),enabled=true}={}){
  const unique=new Map(wallets.filter(w=>w.selected!==false).map(w=>[w.address,w]));
  const result={status:enabled?'unavailable':'off',selected:unique.size,fresh:0,missing:unique.size,positions:0,long:0,short:0,net:0,longShare:null,largestShare:null,largestAddress:null,counts:{long:0,short:0,paired:0,flat:0}};
  if(!enabled)return result;let largest=0;
  for(const address of unique.keys()){
    const state=states.get(address),age=now-state?.receivedAt;
    if(state?.status!=='live'||!Number.isFinite(age)||age<0||age>=30000||!Array.isArray(state.positions))continue;
    const rows=state.positions.filter(p=>p.market===market);
    if(rows.some(p=>!['long','short'].includes(p.side)||!Number.isFinite(p.notional)||p.notional<0||!Number.isFinite(p.entry)||p.entry<=0||!Number.isFinite(p.notional/p.entry)))continue;
    const exposure=walletExposure(rows,market),gross=exposure.long+exposure.short;
    if(!Number.isFinite(gross)||!Number.isFinite(result.long+result.short+gross))continue;
    result.fresh++;result.positions+=rows.length;result.long+=exposure.long;result.short+=exposure.short;if(gross>largest){largest=gross;result.largestAddress=address;}
    result.counts[exposure.bias==='net long'?'long':exposure.bias==='net short'?'short':exposure.bias==='paired'?'paired':'flat']++;
  }
  result.missing=result.selected-result.fresh;result.net=result.long-result.short;const gross=result.long+result.short;
  if(result.fresh)result.status='available';if(gross){result.longShare=result.long/gross;result.largestShare=largest/gross;}return result;
}
export function entryComparison(position,tick,now=Date.now()){
  const quote=chartQuoteView(tick,now);if(!position||quote.status!=='current')return {status:quote.status,price:null};
  const difference=(quote.price-position.entry)*(position.side==='long'?1:-1);
  return {status:'current',price:quote.price,difference,percent:difference/position.entry*100,ageMs:Number.isFinite(position.openedAt)&&position.openedAt<=now?now-position.openedAt:null};
}
export function walletAlertCandidates(previous,next){
  if(!previous)return [];
  const out=[];for(const market of new Set([...previous.positions,...next.positions].map(p=>p.market))){
    const before=previous.positions.filter(p=>p.market===market),after=next.positions.filter(p=>p.market===market),oldIds=new Set(before.map(p=>p.id)),newIds=new Set(after.map(p=>p.id));
    const added=after.filter(p=>!oldIds.has(p.id)),removed=before.filter(p=>!newIds.has(p.id));
    if(added.length)out.push({type:'opened',market,amount:added.reduce((n,p)=>n+p.notional,0),ids:added.map(p=>p.id)});
    if(removed.length)out.push({type:'removed',market,amount:removed.reduce((n,p)=>n+p.notional,0),ids:removed.map(p=>p.id)});
    const gross=rows=>rows.reduce((n,p)=>n+p.notional,0),increase=gross(after)-gross(before);
    if(increase>0)out.push({type:'increased',market,amount:increase,ids:added.map(p=>p.id)});
    const a=walletExposure(before,market),b=walletExposure(after,market);
    if(['net long','net short'].includes(a.bias)&&['net long','net short'].includes(b.bias)&&a.bias!==b.bias)out.push({type:'reversed',market,amount:gross(after),ids:after.map(p=>p.id)});
  }return out.map(e=>({...e,address:next.address}));
}
export function walletAlertSummary(event,previous,next){
  const amount='$'+event.amount.toLocaleString(undefined,{maximumFractionDigits:0});
  if(event.type==='reversed')return `${event.market} · ${walletExposure(previous.positions,event.market).bias} → ${walletExposure(next.positions,event.market).bias} · ${amount} gross`;
  if(event.type==='increased')return `${event.market} · gross exposure increased by ${amount}`;
  const rows=event.type==='removed'?previous.positions:next.positions,ids=new Set(event.ids),positions=rows.filter(p=>ids.has(p.id)&&p.market===event.market),label=event.type==='removed'?'no longer open':'new';
  const details=positions.slice(0,3).map(p=>`${p.side} #${p.id}`).join(', '),extra=positions.length>3?` +${positions.length-3} more`:'';
  return `${event.market} · ${label} ${details}${extra} · ${amount}`;
}
export function createAlertGate(now=Date.now){
  const last=new Map();return (previous,next,settings,{market,enabled=true,publication='update'}={})=>{
    if(!enabled||settings?.enabled!==true||publication!=='update')return [];
    const minimum=Number.isFinite(settings.minimum)?Math.max(0,settings.minimum):5000,cooldown=Number.isFinite(settings.cooldown)?Math.max(0,Math.min(3600,settings.cooldown))*1000:30000,at=now(),alerts=[];
    for(const e of walletAlertCandidates(previous,next)){if(e.market!==market||settings.types?.[e.type]!==true||e.amount<minimum)continue;const key=e.address+':'+e.market+':'+e.type;if(last.has(key)&&at-last.get(key)<cooldown)continue;last.set(key,at);alerts.push({...e,at});}return alerts;
  };
}
