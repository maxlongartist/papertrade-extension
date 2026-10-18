import {positionHealth} from './position-health.js';
const watchStates = new Set(['watching','submitting','submitted','awaiting_fill','exits_armed','closing','close_submitted','attention','failed']);
export const activeWatches = orders => orders.filter(o => watchStates.has(o.status));
export const marketUrl = market => {
  if (!/^[A-Z][A-Z0-9]{0,15}$/.test(market ?? '')) throw Error('Invalid saved market.');
  return 'https://exchange.papertrade.xyz/trade/' + market.toLowerCase();
};
function bindingHealth(record, tabs, bindings) {
  if (!record.targetTabKey || bindings[record.targetTabId] !== record.targetTabKey) return 'Browser session changed. Open the market to restore or re-arm tracking.';
  const tab = tabs.find(t => t.id === record.targetTabId);
  if (!tab) return 'Original tab closed. Open the market to restore or re-arm tracking.';
  try {
    const u = new URL(tab.url);
    if (u.origin !== 'https://exchange.papertrade.xyz' || !u.pathname.startsWith('/trade/' + record.market.toLowerCase()) || !new RegExp('^/trade/' + record.market.toLowerCase() + '(?:/|$)').test(u.pathname))
      return 'Original tab changed page. Manage returns it to this market.';
  } catch { return 'Original tab page unavailable. Manage returns it to this market.'; }
  return null;
}
export function overview({pairs, orders, ticks, feed, tabs, bindings, now=Date.now()}) {
  const quotes = ['BTC','ETH'].map(market => {
    const tick = ticks[market];
    const valid = tick && [tick.sourceAt,tick.receivedAt].every(Number.isFinite) && tick.sourceAt <= now+1000 && tick.receivedAt <= now+1000;
    return {market, ageMs:valid ? Math.max(0,now-tick.sourceAt,now-tick.receivedAt) : null};
  });
  const items = [
    ...pairs.filter(p=>p.status!=='closed').map(p=>({kind:'pair',record:p})),
    ...activeWatches(orders).map(record=>({kind:'watch',record})),
  ].map(({kind,record:r})=>{
    let warning=bindingHealth(r,tabs,bindings);
    if (!warning && kind==='pair') {
      if(r.observationError || !Number.isFinite(r.observedAt) || now-r.observedAt>5000 || r.observedAt>now+1000)warning='Native position observations unavailable or stale. Check the page.';
      else if((r.legs??[]).some(l=>!l.closed&&(l.entry==='uncertain'||l.close==='uncertain')))warning='An entry or Close is unconfirmed. Check native Status.';
      else if(r.status==='attention')warning='Pair needs attention. Inspect each leg on the page.';
    }
    const health=kind==='watch'?positionHealth(r,now):null;
    if(!warning&&health?.warning)warning=health.text;
    if(!warning && kind==='watch') {
      if(['attention','failed'].includes(r.status)) warning='Watch needs attention. Inspect its status on the page.';
      else if(['watching','exits_armed'].includes(r.status)) {
        const q=quotes.find(q=>q.market===r.market);
        if(q?.ageMs==null || q.ageMs>500)warning='Quote unavailable or older than the entry execution window. Check the page.';
      }
    }
    return {kind,id:r.id,market:r.market,status:r.status,
      title:kind==='pair'?'Manual pair':r.kind==='position_exits'||r.status==='exits_armed'?'SL / TP':r.side==='short'?'Short entry':'Long entry',
      warning, positionIds:kind==='pair'?(r.legs??[]).filter(l=>l.positionId).map(l=>String(l.positionId)):r.positionId?[String(r.positionId)]:[],
      observedAt:kind==='pair'?r.observedAt??null:r.positionCheckedAt??null};
  });
  return {items,quotes,feed,checkedAt:now};
}
// Navigation only. Parameters come from the stored record, never caller-supplied URLs/IDs.
export async function manageRecord(record, {tabs,windows,bindings}) {
  const url=marketUrl(record.market);
  if(record.targetTabKey && bindings[record.targetTabId]===record.targetTabKey) {
    let tab;
    try {tab=await tabs.get(record.targetTabId);} catch { /* Closed tab: create a market page below. */ }
    if(tab) {
      let sameMarket=false;
      try{const u=new URL(tab.url);sameMarket=u.origin==='https://exchange.papertrade.xyz'&&new RegExp('^/trade/'+record.market.toLowerCase()+'(?:/|$)').test(u.pathname);}catch{}
      const updated=await tabs.update(tab.id,{active:true,...(sameMarket?{}:{url})});
      if(windows && Number.isInteger(updated.windowId))await windows.update(updated.windowId,{focused:true});
      return {ok:true,opened:false};
    }
  }
  await tabs.create({url,active:true});
  return {ok:true,opened:true};
}
