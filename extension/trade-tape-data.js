// Public market-wide events only; no account credentials, private state or orders.
import {validAddress} from './wallet-data.js';
const id=value=>typeof value==='string'&&/^\d{1,30}$/.test(value)||Number.isSafeInteger(value)&&value>=0;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function parseTapeBatch(data,now=Date.now()){
  if(!Array.isArray(data)||data.length<1||data.length>120)throw Error('Trade tape schema changed.');
  return data.map(r=>{
    if(!r||!id(r.seq)||!id(r.positionId)||!validAddress(r.wallet)||!['open','close','liq'].includes(r.kind)||!['long','short'].includes(r.side)||typeof r.instrument!=='string'||!/^[A-Z0-9]{1,16}$/.test(r.instrument)||!Number.isSafeInteger(r.instrumentId)||r.instrumentId<0||typeof r.instrumentTerminal!=='boolean'||!Number.isSafeInteger(r.ts)||r.ts<=0||r.ts>now+1000||!Number.isSafeInteger(r.leverage)||r.leverage<1||!finite(r.notionalUsd)||r.notionalUsd<=0)throw Error('Invalid public trade identity or amount.');
    for(const value of [r.entry,r.exit])if(value!==null&&(!finite(value)||value<0))throw Error('Invalid public trade price.');
    if(r.kind==='open'?r.pnlUsd!==null:!finite(r.pnlUsd))throw Error('Invalid public trade PnL.');
    // traderPnlUsd is wallet-level performance, not this trade's PnL. Never substitute it.
    return {seq:BigInt(r.seq).toString(),positionId:BigInt(r.positionId).toString(),at:r.ts,wallet:r.wallet.toLowerCase(),market:r.instrument,side:r.side,kind:r.kind,notional:r.notionalUsd,leverage:r.leverage,price:(r.kind==='open'?r.entry:r.exit)||null,pnl:r.kind==='open'?null:r.pnlUsd};
  });
}
export function tapeMatches(row,{market='all',kind='all',minimum=0}={}){return (market==='all'||row.market===market)&&(kind==='all'||row.kind===kind)&&row.notional>=minimum;}
export function createTapeStore({now=Date.now,limit=3000}={}){
  let rows=[],seen=new Set(),coverageSince=now();
  function prune(){const cutoff=now()-120000;rows=rows.filter(r=>r.at>=cutoff).slice(0,limit);seen=new Set(rows.map(r=>r.seq));}
  return {
    add(batch){let added=0;for(const r of batch){if(seen.has(r.seq)||r.at<now()-120000)continue;seen.add(r.seq);rows.push(r);added++;}rows.sort((a,b)=>b.at-a.at||(BigInt(a.seq)>BigInt(b.seq)?-1:BigInt(a.seq)<BigInt(b.seq)?1:0));prune();return added;},
    gap(){coverageSince=now();},
    snapshot(){prune();return {rows:[...rows],coverageSince,limited:rows.length===limit};}
  };
}
export function tapeView(snapshot,filters,now=Date.now()){
  const rows=snapshot.rows.filter(r=>tapeMatches(r,filters)),minute=rows.filter(r=>r.at>now-60000&&r.at<=now+1000);
  const summary={long:{count:0,notional:0},short:{count:0,notional:0}};
  for(const row of minute){const side=summary[row.side];side.count++;side.notional+=row.notional;}
  return {rows:rows.slice(0,200),summary,partial:now-snapshot.coverageSince<60000||snapshot.limited&&snapshot.rows.at(-1)?.at>now-60000};
}
