import test from 'node:test';import assert from 'node:assert/strict';
import {parseTapeBatch,createTapeStore,tapeView} from '../extension/trade-tape-data.js';
import {startTapeFeed} from '../extension/trade-tape-feed.js';
const now=100000;
const event=(patch={})=>({seq:1,ts:now,wallet:'0x'+'1'.repeat(40),instrument:'BTC',instrumentId:0,instrumentTerminal:false,side:'long',leverage:300,notionalUsd:60000,entry:82000,exit:null,positionId:23,kind:'open',pnlUsd:null,traderPnlUsd:6878,...patch});
const parsed=patch=>parseTapeBatch([event(patch)],now)[0];
test('public tape preserves exact sequence IDs and uses per-trade PnL, not wallet performance',()=>{
 const r=parsed({seq:'9007199254740993123',kind:'close',entry:null,exit:82100,pnlUsd:13.91});
 assert.equal(r.seq,'9007199254740993123');assert.equal(r.pnl,13.91);assert.equal(r.price,82100);assert.equal('traderPnlUsd' in r,false);assert.equal(parsed().pnl,null);
 assert.equal(parsed({kind:'liq',exit:81900,pnlUsd:-200}).pnl,-200);assert.equal(parsed({entry:null}).price,null);
});
test('invalid batches are rejected atomically without coercing strings, unknown actions or unsafe IDs',()=>{
 for(const patch of [{seq:Number.MAX_SAFE_INTEGER+1},{seq:'x'},{positionId:-1},{wallet:'<img>'},{instrument:'BTC<script>'},{kind:'increase'},{side:'buy'},{ts:now+1001},{ts:0},{leverage:1.5},{leverage:0},{notionalUsd:'60000'},{notionalUsd:Infinity},{entry:'82000'},{exit:-1},{pnlUsd:4},{instrumentId:undefined},{instrumentTerminal:undefined}])assert.throws(()=>parseTapeBatch([event(),event(patch)],now));
 assert.throws(()=>parseTapeBatch([],now));assert.throws(()=>parseTapeBatch(Array(121).fill(event()),now));assert.throws(()=>parsed({kind:'close',pnlUsd:null}));
});
test('deduplication is by event sequence, retaining distinct trades at the same price',()=>{
 const store=createTapeStore({now:()=>now});assert.equal(store.add([parsed(),parsed(),parsed({seq:2})]),2);assert.equal(store.add([parsed()]),0);assert.equal(store.snapshot().rows.length,2);
});
test('last-minute totals match market, kind and notional filters and exclude expired events',()=>{
 let time=now;const store=createTapeStore({now:()=>time});store.add([parsed(),parsed({seq:2,side:'short',notionalUsd:100000}),parsed({seq:3,instrument:'ETH',notionalUsd:10000}),parsed({seq:4,kind:'close',exit:82100,pnlUsd:5}),parsed({seq:5,ts:now-61000})]);
 let view=tapeView(store.snapshot(),{market:'BTC',kind:'open',minimum:70000},time);assert.equal(view.rows.length,1);assert.deepEqual(view.summary,{long:{count:0,notional:0},short:{count:1,notional:100000}});assert.equal(view.partial,true);
 time+=60000;view=tapeView(store.snapshot(),{market:'all'},time);assert.equal(view.summary.long.count,0);assert.equal(view.partial,false);store.gap();assert.equal(tapeView(store.snapshot(),{},time).partial,true);
});
test('store and displayed rows are bounded and overflow makes last-minute totals partial',()=>{
 const store=createTapeStore({now:()=>now,limit:3});store.add(Array.from({length:8},(_,i)=>parsed({seq:i})));assert.equal(store.snapshot().rows.length,3);assert.equal(tapeView(store.snapshot(),{},now+61000).partial,false);
 assert.equal(tapeView({...store.snapshot(),coverageSince:now-61000},{},now).partial,true);
 const larger=createTapeStore({now:()=>now});larger.add(Array.from({length:250},(_,i)=>parsed({seq:i})));assert.equal(tapeView(larger.snapshot(),{},now).rows.length,200);
});
function transport(){
 let time=now;const sockets=[],updates=[],jobs=new Map();let next=0;
 const stop=startTapeFeed(v=>updates.push(v),{now:()=>time,random:()=>0,setTimer:(fn,delay)=>{jobs.set(++next,{fn,delay});return next;},clearTimer:id=>jobs.delete(id),socket:url=>{assert.equal(url,'wss://stream.papertrade.xyz/connection/websocket');const ws={sent:[],closed:false,send(v){this.sent.push(JSON.parse(v));},close(){this.closed=true;}};sockets.push(ws);return ws;}});
 const frame=(ws,data)=>ws.onmessage({data:JSON.stringify(data)}),ack=ws=>{ws.onopen();frame(ws,{id:1,connect:{}});frame(ws,{id:2,subscribe:{}});};
 return {sockets,updates,jobs,frame,ack,stop,setTime:t=>time=t};
}
test('feed subscribes only to public trades, answers heartbeat and closes immediately on disposal',()=>{
 const t=transport(),ws=t.sockets[0];t.ack(ws);assert.deepEqual(ws.sent,[{id:1,connect:{}},{id:2,subscribe:{channel:'public:trades'}}]);t.frame(ws,{});assert.deepEqual(ws.sent.at(-1),{});t.frame(ws,{push:{channel:'public:trades',pub:{data:[event()]}}});assert.equal(t.updates.at(-1).trades[0].notional,60000);t.stop();assert.equal(ws.closed,true);assert.equal(t.jobs.size,0);const n=t.updates.length;t.frame(ws,{id:2,subscribe:{}});assert.equal(t.updates.length,n);
});
test('disconnects back off, mark a gap and ignore late frames from a replaced socket',()=>{
 const t=transport(),ws=t.sockets[0];t.ack(ws);ws.onclose();assert.equal(t.updates.at(-1).status,'retrying');assert.equal(t.updates.at(-1).retryAt,now+2000);const job=[...t.jobs.values()].find(j=>j.delay===2000);job.fn();const next=t.sockets[1];t.ack(next);const count=t.updates.length;t.frame(ws,{push:{channel:'public:trades',pub:{data:[event()]}}});assert.equal(t.updates.length,count);next.onclose();assert.equal(t.updates.at(-1).retryAt,now+4000);t.stop();
});
test('quiet feed heartbeat timeout and schema changes cannot leave a false Live status',()=>{
 const t=transport(),ws=t.sockets[0];t.ack(ws);t.setTime(now+30000);[...t.jobs.values()][0].fn();assert.equal(t.updates.at(-1).status,'retrying');assert.match(t.updates.at(-1).message,/heartbeat/);t.stop();
 for(const data of [{id:2,subscribe:{recoverable:true}},{push:{disconnect:{code:1}}},{push:{channel:'public:trades',pub:{data:[event({wallet:'bad'})]}}}]){const a=transport();a.ack(a.sockets[0]);a.frame(a.sockets[0],data);assert.equal(a.updates.at(-1).status,'retrying');a.stop();}
});
