import {positionMarkPrice} from './core.js';
// Two seconds is a display freshness window, never an execution allowance.
export function chartQuoteView(tick,now=Date.now()) {
  if(!tick)return {status:'unavailable',price:null};
  const price=positionMarkPrice(tick),times=[tick.sourceAt,tick.receivedAt];
  if(!Number.isFinite(price)||price<=0||times.some(t=>!Number.isFinite(t)||t<0||t>now+1000))return {status:'unavailable',price:null};
  if(times.some(t=>now-t>=2000))return {status:'stale',price:null};
  return {status:'current',price};
}
export function chartMoveRisk(draft) {
  if(!Number.isFinite(draft.price)||draft.price<=0||!Number.isFinite(draft.margin)||draft.margin<=0||!Number.isInteger(draft.leverage)||draft.leverage<1)return {loss:null,gain:null};
  const estimate=level=>{
    if(!Number.isFinite(level)||level<=0)return null;
    const amount=Math.abs((level-draft.price)/draft.price*draft.margin*draft.leverage);
    return Number.isFinite(amount)?amount:null;
  };
  return {loss:estimate(draft.stopLoss),gain:estimate(draft.takeProfit)};
}
// Gross move PnL at the requested TP, not net settlement or a promised fill.
export function takeProfitEstimate(draft){
  if(!draft||!['long','short'].includes(draft.side)||![draft.price,draft.takeProfit,draft.margin].every(n=>Number.isFinite(n)&&n>0)||!Number.isInteger(draft.leverage)||draft.leverage<1)return null;
  const pnl=(draft.takeProfit-draft.price)/draft.price*draft.margin*draft.leverage*(draft.side==='long'?1:-1);
  return Number.isFinite(pnl)?pnl:null;
}
