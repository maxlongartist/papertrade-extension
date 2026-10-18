export const nativeClick = (candidate,start,end) =>
  Number.isFinite(candidate)&&Number.isFinite(start)&&candidate>=start&&candidate<=end ? candidate : null;
const elapsed = (end,start) => Number.isFinite(end)&&Number.isFinite(start)&&end>=start ? end-start : null;
export function legTiming(leg,now=Date.now()) {
  if(!leg)return {entryMs:null,closeMs:null,entryWaitMs:null,closeWaitMs:null};
  const entryMs=leg.clickTimeSource==='native'&&!leg.entryObservationInterrupted?elapsed(leg.filledAt,leg.clickedAt):null;
  const closeMs=leg.closeTimeSource==='native'&&!leg.closeObservationInterrupted?elapsed(leg.closedObservedAt,leg.closeClickedAt):null;
  return {entryMs,closeMs,
    entryWaitMs:!leg.positionId&&leg.entry!=='not_sent'?elapsed(now,leg.entryRequestedAt):null,
    closeWaitMs:!leg.closed&&['sending','submitted','uncertain'].includes(leg.close)?elapsed(now,leg.closeRequestedAt):null};
}
export function timingLabel(ms){return ms==null?'unavailable':ms<1000?`${Math.round(ms)}ms`:`${(ms/1000).toFixed(1)}s`;}
export function recentTimings(pairs,limit=20){
 const entries=[],closes=[];
 for(const p of pairs)for(const l of p.legs){const t=legTiming(l);if(t.entryMs!=null)entries.push(t.entryMs);if(t.closeMs!=null)closes.push(t.closeMs);}
 const median=values=>{const a=values.slice(0,limit).sort((x,y)=>x-y),n=a.length;return {samples:n,medianMs:n?(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2):null};};
 return {entry:median(entries),close:median(closes)};
}
