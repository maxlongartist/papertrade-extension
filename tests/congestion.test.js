import test from 'node:test';import assert from 'node:assert/strict';
import {parsePressure,pressureView,createPressureFeed} from '../extension/congestion.js';
const stamp=100000;
function publication({pending=28,submitted='3000000',queued='9000000',ts=stamp}={}){return {queueRevision:'revision:1',snapshot:{schemaVersion:1,ok:true,stale:false,ts,source:'relayer-postgres',blockGasLimit:'3000000',totalSubmittedGas:submitted,totalQueuedGas:queued,totalPendingGas:String(BigInt(submitted)+BigInt(queued)),pendingCount:pending,chain:{ok:true,stale:false,source:'state-postgres',latestBlockNumber:102,latestBlockTimestampMs:ts,blocks:[{number:101,timestampMs:ts-1000,gasUsed:'1000000',gasLimit:'3000000',papertradeGasUsed:'900000',transactionCount:3},{number:102,timestampMs:ts,gasUsed:'1100000',gasLimit:'3000000',papertradeGasUsed:'1000000',transactionCount:5}]}}};}
test('gas backlog matches native Status thresholds and minimum clearing estimate',()=>{
 for(const [submitted,queued,pending,level,blocks,seconds] of [['0','0',0,'LOW',0,0],['0','1',1,'LOW',1,3],['3000000','9000000',28,'MEDIUM',4,4],['0','15000000',30,'MEDIUM',5,5],['0','15000001',31,'HIGH',6,6]]){
  const s=parsePressure(publication({submitted,queued,pending}),stamp);assert.equal(s.level,level);assert.equal(s.neededBlocks,blocks);assert.equal(s.clearSeconds,seconds);assert.equal(s.avgTxPerBlock,4);
 }
});
test('invalid, future, stale or inconsistent chain/queue data never produces a usable estimate',()=>{
 for(const mutate of [p=>p.snapshot.stale=true,p=>p.snapshot.ts=stamp-5000,p=>p.snapshot.ts=stamp+1001,p=>p.snapshot.blockGasLimit='0',p=>p.snapshot.totalPendingGas='1',p=>p.snapshot.pendingCount=-1,p=>p.snapshot.chain.ok=false,p=>p.snapshot.chain.latestBlockNumber=103,p=>p.snapshot.chain.blocks[1].number=103,p=>p.snapshot.chain.blocks[0].papertradeGasUsed='9999999',p=>p.snapshot.totalQueuedGas='NaN']){
  const p=publication();mutate(p);assert.throws(()=>parsePressure(p,stamp));
 }
 const parsed=parsePressure(publication(),stamp);assert.equal(pressureView(parsed,stamp+4999).live,true);assert.equal(pressureView(parsed,stamp+5000).live,false);assert.equal(pressureView(parsed,stamp,'Disconnected').level,'UNKNOWN');
});
function feedFixture(){
 let clock=stamp,nextId=0;const timers=new Map(),sockets=[];
 const feed=createPressureFeed({now:()=>clock,schedule:(fn,ms)=>{const id=++nextId;timers.set(id,{fn:()=>{timers.delete(id);fn();},ms});return id;},cancel:id=>timers.delete(id),socket:url=>{const ws={url,readyState:0,sent:[],send(v){this.sent.push(JSON.parse(v));},close(){this.readyState=3;this.onclose?.();}};sockets.push(ws);return ws;}});
 const publish=p=>sockets.at(-1).onmessage({data:JSON.stringify({push:{channel:'pressure:current',pub:{data:p}}})});
 return {feed,sockets,timers,publish,time:ms=>clock+=ms};
}
test('single public subscription uses no credentials, answers pings, ignores old frames and expires',()=>{
 const f=feedFixture();assert.equal(f.feed.get().live,false);const ws=f.sockets[0];ws.readyState=1;ws.onopen();assert.deepEqual(ws.sent[0],{id:1,connect:{}});
 ws.onmessage({data:'{"id":1,"connect":{}}'});assert.deepEqual(ws.sent[1],{id:2,subscribe:{channel:'pressure:current'}});
 ws.onmessage({data:'{}'});assert.deepEqual(ws.sent[2],{});f.publish(publication());assert.equal(f.feed.get().level,'MEDIUM');f.feed.get();assert.equal(f.sockets.length,1);
 f.time(1000);f.publish(publication({queued:'0',ts:stamp-100}));assert.equal(f.feed.get().level,'MEDIUM');f.time(4000);assert.equal(f.feed.get().live,false);f.feed.stop();
});
test('disconnect backs off, malformed data hides numbers, and idle consumers close the feed',()=>{
 const f=feedFixture();f.feed.get();const ws=f.sockets[0];ws.readyState=1;f.publish(publication());ws.onmessage({data:'malformed'});assert.equal(f.feed.get().live,false);
 ws.close();const retry=[...f.timers.values()].find(t=>t.ms===2000);assert.ok(retry);assert.equal(f.feed.get().level,'UNKNOWN');retry.fn();assert.equal(f.sockets.length,2);
 f.feed.stop();assert.equal(f.timers.size,0);
 const idle=feedFixture();idle.feed.get();idle.time(60000);[...idle.timers.values()][0].fn();assert.equal(idle.sockets[0].readyState,3);
});
test('trend is unavailable until enough history exists and reports block-scale growth',()=>{
 const f=feedFixture();f.feed.get();f.sockets[0].readyState=1;f.publish(publication());assert.equal(f.feed.get().trend,'Collecting trend');f.time(5000);f.publish(publication({ts:stamp+5000,queued:'15000000'}));assert.equal(f.feed.get().trend,'Queue growing');f.feed.stop();
});

test('an open but stalled public feed is retired and reconnected with backoff',()=>{
 const f=feedFixture();f.feed.get();const ws=f.sockets[0];ws.readyState=1;f.publish(publication());
 f.time(10000);const watchdog=[...f.timers.values()].find(t=>t.ms===10000);assert.ok(watchdog,'fresh-data watchdog is armed');watchdog.fn();
 assert.equal(ws.readyState,3);assert.equal(f.feed.get().level,'UNKNOWN');assert.match(f.feed.get().reason,/fresh.*queue|queue.*fresh/i);
 const retry=[...f.timers.values()].find(t=>t.ms===2000);assert.ok(retry);retry.fn();assert.equal(f.sockets.length,2);
 f.sockets[1].readyState=1;f.publish(publication({ts:stamp+10000}));assert.equal(f.feed.get().live,true);assert.equal(f.feed.get().trend,'Collecting trend');f.feed.stop();assert.equal(f.timers.size,0);
});
test('valid publications renew the watchdog but pings cannot keep stalled data alive',()=>{
 const f=feedFixture();f.feed.get();f.sockets[0].readyState=1;f.publish(publication());
 const original=[...f.timers.values()].find(t=>t.ms===10000);assert.ok(original);
 f.time(4000);f.publish(publication({ts:stamp+4000}));assert.ok(![...f.timers.values()].includes(original));
 f.time(10000);f.sockets[0].onmessage({data:'{}'});[...f.timers.values()].find(t=>t.ms===10000).fn();assert.equal(f.sockets[0].readyState,3);f.feed.stop();
});
test('connection construction failures back off instead of retrying on every status read',()=>{
 let calls=0,clock=stamp;const timers=new Map();let seq=0;
 const feed=createPressureFeed({socket:()=>{calls++;throw Error('blocked');},now:()=>clock,schedule:(fn,ms)=>{const id=++seq;timers.set(id,{fn:()=>{timers.delete(id);fn();},ms});return id;},cancel:id=>timers.delete(id)});
 assert.doesNotThrow(()=>feed.get());for(let i=0;i<5;i++)assert.equal(feed.get().level,'UNKNOWN');assert.equal(calls,1);
 const retry=[...timers.values()].find(t=>t.ms===2000);assert.ok(retry);clock+=2000;retry.fn();assert.equal(calls,2);feed.stop();assert.equal(timers.size,0);
});
test('socket errors retire the transport even without a close event and late frames cannot revive it',()=>{
 const f=feedFixture();f.feed.get();const ws=f.sockets[0];ws.readyState=1;f.publish(publication());ws.onerror();
 assert.equal(ws.readyState,3);assert.equal(f.feed.get().live,false);
 ws.onmessage({data:JSON.stringify({push:{channel:'pressure:current',pub:{data:publication()}}})});assert.equal(f.feed.get().live,false);assert.equal(f.sockets.length,1);f.feed.stop();
});
test('hung handshakes use bounded exponential backoff without overlapping sockets',()=>{
 const f=feedFixture();f.feed.get();
 for(const delay of [2000,4000,8000,16000,30000,30000]){
  const before=f.sockets.length;f.time(10000);f.feed.get();
  [...f.timers.values()].find(t=>t.ms===10000).fn();assert.equal(f.sockets.at(-1).readyState,3);
  const retry=[...f.timers.values()].find(t=>t.ms===delay);assert.ok(retry,`retry delay ${delay}`);
  for(let n=0;n<4;n++)f.feed.get();assert.equal(f.sockets.length,before);
  f.time(delay);retry.fn();assert.equal(f.sockets.length,before+1);
 }
 f.feed.stop();assert.equal(f.timers.size,0);
});
test('publication callback forwards only strictly advancing validated public snapshots',()=>{
 let clock=stamp,ws;const forwarded=[];
 const feed=createPressureFeed({now:()=>clock,socket:()=>ws={readyState:1,send(){},close(){}},schedule:()=>1,cancel(){},onPublication:p=>forwarded.push(p)});
 feed.get();const deliver=p=>ws.onmessage({data:JSON.stringify({push:{channel:'pressure:current',pub:{data:p}}})});
 const valid=publication();deliver(valid);deliver(valid);clock+=1000;deliver(publication({ts:stamp-1}));deliver({bad:true});
 assert.deepEqual(forwarded,[valid]);const newer=publication({ts:clock});deliver(newer);assert.deepEqual(forwarded,[valid,newer]);feed.stop();
});
test('queue peek reads cached evidence without opening, reconnecting or extending consumer lifetime',()=>{
 const f=feedFixture();assert.equal(f.feed.peek().live,false);assert.equal(f.sockets.length,0);assert.equal(f.timers.size,0);
 f.feed.get();f.publish(publication());assert.equal(f.feed.peek().live,true);const count=f.timers.size;f.time(60000);assert.equal(f.feed.peek().live,false);assert.equal(f.timers.size,count);[...f.timers.values()].find(t=>t.ms===60000).fn();assert.equal(f.sockets[0].readyState,3);f.feed.peek();assert.equal(f.sockets.length,1);assert.equal(f.timers.size,0);
});
