import test from 'node:test';
import assert from 'node:assert/strict';
import {createManualPairs} from '../extension/manual-pair.js';
import {legTiming} from '../extension/execution-timing.js';
const owner='0x'+'1'.repeat(40);
const binding={targetTabId:11,targetTabKey:'tab-session',market:'BTC'};
function fixture({autoFill=true,stored=[],executeOverride,closeOverride,saveOverride,queue}={}){
 let clock=100000,seq=0,storedValue=structuredClone(stored),accountOwner=owner,pending=0,rows=[];
 const entries=[],closes=[],writes=[];
 let ticket={ok:true,ready:true,margin:25,leverage:400},available=1000;
 const fill=(side,positionId=String(++seq))=>{rows.push({market:'BTC',side,positionId,margin:25,leverage:400,entryPrice:83000});return positionId;};
 const api={queue,load:async()=>storedValue,save:async value=>{if(saveOverride)await saveOverride(value);storedValue=structuredClone(value);writes.push(value);},snapshot:async b=>({ok:true,owner:accountOwner,market:b.market,ticket,available,pending,price:83000,positions:structuredClone(rows)}),execute:async o=>{entries.push(o);assert.equal(storedValue[0].legs.find(l=>l.side===o.side).entry,'sending','journal must precede click');if(executeOverride)return executeOverride(o,{fill});if(autoFill)fill(o.side);return {ok:true,clicked:true};},close:async o=>{closes.push(o);assert.equal(storedValue[0].legs.find(l=>l.side===o.side).close,'sending','close reservation must precede click');if(closeOverride)return closeOverride(o);rows=rows.filter(p=>p.positionId!==o.positionId);return {ok:true,clicked:true};},now:()=>clock,id:()=>String(++seq)};
 const controller=createManualPairs(api);
 const request=(type,extra={})=>controller.request({...binding,type,...extra});
 return {controller,request,entries,closes,writes,fill,api,stored:()=>storedValue,rows:()=>rows,time:ms=>clock+=ms,owner:v=>accountOwner=v,pending:v=>pending=v,ticket:v=>ticket=v,available:v=>available=v,replaceRows:v=>rows=v};
}
test('one Open submits one long and one short; Close targets only those IDs and needs two complete absent observations',async()=>{
 const f=fixture();const {pair}=await f.request('pairOpen');assert.equal(pair.status,'open');assert.deepEqual(f.entries.map(o=>[o.side,o.margin,o.leverage]),[['long',25,400],['short',25,400]]);
 await assert.rejects(f.request('pairOpen'),/already/);assert.equal(f.entries.length,2);
 await f.request('pairClose',{id:pair.id});assert.equal(f.closes.length,2);assert.equal((await f.request('pairState')).pair.status,'closing');
 await f.controller.pulse();assert.equal((await f.request('pairState')).pair.status,'closing');
 await f.controller.pulse();assert.equal((await f.request('pairState')).pair.status,'closed');
 await f.controller.pulse();assert.equal(f.entries.length,2,'no repeating or automatic entries');assert.equal(f.closes.length,2);
});
test('missing wallet, insufficient total collateral, pending entries and pre-existing positions prevent Open',async()=>{
 for(const scenario of ['wallet','money','pending','position','ticket']){
  const f=fixture();if(scenario==='wallet')f.owner(null);if(scenario==='money')f.available(49);if(scenario==='pending')f.pending(1);if(scenario==='position')f.fill('long');if(scenario==='ticket')f.ticket({ok:true,ready:false});
  await assert.rejects(f.request('pairOpen'));assert.equal(f.entries.length,0);
 }
});
test('Close during first entry response suppresses the unsent short and unwinds the long',async()=>{
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const f=fixture({executeOverride:async(o,{fill})=>{entered();await gate;fill(o.side);return {clicked:true};}});
 const opening=f.request('pairOpen');await started;
 const inFlight=(await f.request('pairState')).pair;assert.equal(inFlight.legs[0].entry,'sending');
 const closing=f.request('pairClose',{id:inFlight.id});await new Promise(r=>setImmediate(r));release();await opening;await closing;
 assert.equal(f.entries.length,1);assert.equal(f.closes.length,1);
 assert.equal(f.stored()[0].closeRequested,true);
});
test('Close while fills are pending waits and closes late matching fills without resubmitting entries',async()=>{
 const f=fixture({autoFill:false});const {pair}=await f.request('pairOpen');
 f.pending(2);await f.request('pairClose',{id:pair.id});assert.equal(f.closes.length,0);
 f.fill('long','101');f.pending(1);await f.controller.pulse();assert.deepEqual(f.closes.map(c=>c.positionId),['101']);
 f.fill('short','102');f.pending(0);f.time(1001);await f.controller.pulse();assert.deepEqual(f.closes.map(c=>c.positionId),['101','102']);
 await f.controller.pulse();await f.controller.pulse();assert.equal((await f.request('pairState')).pair.status,'closed');assert.equal(f.entries.length,2);
});
test('lost entry response never clicks the other side or guesses that a flat view resolves the entry',async()=>{
 const f=fixture({executeOverride:async()=>{throw Error('reply lost');}});const {pair}=await f.request('pairOpen');
 assert.equal(f.entries.length,1);await f.request('pairClose',{id:pair.id});await f.controller.pulse();await f.controller.pulse();
 assert.notEqual((await f.request('pairState')).pair.status,'closed');assert.equal(f.closes.length,0);
 f.fill('long','77');await f.controller.pulse();await f.controller.pulse();await f.controller.pulse();assert.equal((await f.request('pairState')).pair.status,'closed');assert.equal(f.entries.length,1);
});
test('explicit native rejection of the first leg sends nothing else and reports no entries',async()=>{
 const f=fixture({executeOverride:async()=>({clicked:false,error:'Wallet prompt required'})});const {pair}=await f.request('pairOpen');
 assert.equal(f.entries.length,1);assert.equal(pair.status,'closed');assert.match(pair.message,/No entries submitted/);assert.equal(f.closes.length,0);
});
test('wallet switch and unavailable account observations cannot confirm a close or target another wallet',async()=>{
 const f=fixture();const {pair}=await f.request('pairOpen');f.owner('0x'+'2'.repeat(40));await f.request('pairClose',{id:pair.id});assert.equal(f.closes.length,0);assert.match((await f.request('pairState')).pair.message,/Wallet changed/);
 f.owner(owner);await f.controller.pulse();assert.equal(f.closes.length,2);await f.controller.pulse();
 f.owner('0x'+'2'.repeat(40));await f.controller.pulse();assert.notEqual((await f.request('pairState')).pair.status,'closed');
 f.owner(owner);await f.controller.pulse();await f.controller.pulse();assert.equal((await f.request('pairState')).pair.status,'closed');
});
test('restart restores tracking but never replays entries or uncertain closes',async()=>{
 const f=fixture({closeOverride:async()=>{throw Error('close response lost');}});const {pair}=await f.request('pairOpen');await f.request('pairClose',{id:pair.id});
 const restored=createManualPairs({...f.api,load:async()=>f.stored()});await restored.pulse();await restored.pulse();assert.equal(f.entries.length,2);assert.equal(f.closes.length,2);assert.notEqual((await restored.request({...binding,type:'pairState'})).pair.status,'closed');
});
test('matching ambiguity prevents guessed binding and closes',async()=>{
 const f=fixture({autoFill:false});const {pair}=await f.request('pairOpen');f.fill('long','91');f.fill('long','92');f.fill('short','93');await f.controller.pulse();await f.request('pairClose',{id:pair.id});assert.equal(f.closes.length,0);assert.match((await f.request('pairState')).pair.message,/Multiple matching/);
});
test('tab binding and pair ID prevent cross-tab Close',async()=>{
 const f=fixture();const {pair}=await f.request('pairOpen');await assert.rejects(f.request('pairClose',{id:pair.id,targetTabId:22}),/not found/);await assert.rejects(f.request('pairClose',{id:'wrong'}),/not found/);assert.equal(f.closes.length,0);
});
test('failed durable storage prevents entry clicks',async()=>{
 const f=fixture({saveOverride:async()=>{throw Error('storage full');}});await assert.rejects(f.request('pairOpen'),/storage full/);assert.equal(f.entries.length,0);
});
test('both Close messages are sent even while one response is stalled',async()=>{
 let release;const gate=new Promise(r=>release=r);const f=fixture({closeOverride:async o=>{if(o.side==='long')await gate;return {clicked:true};}});const {pair}=await f.request('pairOpen');const closing=f.request('pairClose',{id:pair.id});await new Promise(r=>setImmediate(r));assert.deepEqual(f.closes.map(c=>c.side),['long','short']);release();await closing;
});
test('readiness preflight performs all account and venue checks without writing or trading',async()=>{
 const f=fixture();let validated=0;
 const controller=createManualPairs({...f.api,validate:async()=>{validated++;}});
 const inspect=()=>controller.request({...binding,type:'pairInspect'});
 assert.deepEqual(await inspect(),{ready:true,owner,ticket:{margin:25,leverage:400},available:1000,checkedAt:100000});assert.equal(validated,1);
 f.available(49);assert.match((await inspect()).reason,/both margins/);
 assert.equal(f.entries.length,0);assert.equal(f.closes.length,0);assert.equal(f.writes.length,0);
 f.available(1000);f.pending(1);assert.equal((await inspect()).ready,false);
});
test('readiness venue rejection surfaces its reason and does not submit orders',async()=>{
 const f=fixture();const c=createManualPairs({...f.api,validate:async()=>{throw Error('Venue paused');}});
 const r=await c.request({...binding,type:'pairInspect'});assert.equal(r.ready,false);assert.equal(r.reason,'Venue paused');
 assert.equal(f.entries.length,0);assert.equal(f.writes.length,0);
});
test('native observations timestamp marks and history; a missing leg is never labelled both visible',async()=>{
 const f=fixture();const {pair}=await f.request('pairOpen');
 f.replaceRows(f.rows().map(r=>({...r,markPrice:83100})));f.time(2000);await f.controller.pulse();
 let r=await f.request('pairState');assert.equal(r.pair.observedAt,102000);assert.equal(r.pair.legs[0].markPrice,83100);assert.equal(r.history.length,1);
 f.replaceRows(f.rows().slice(0,1));await f.controller.pulse();r=await f.request('pairState');assert.equal(r.pair.status,'attention');assert.doesNotMatch(r.pair.message,/Both legs visible/);
 const other=await f.request('pairState',{targetTabId:22});assert.equal(other.history.length,0);assert.equal(other.pair,null);
 assert.equal(f.entries.length,2);assert.equal(f.closes.length,0);
});
test('a failed close remains visible as a leg error; later accepted close clears the error',async()=>{
 let ready=false;const f=fixture({closeOverride:async()=>ready?{clicked:true}:{clicked:false,error:'Native button disabled'}});
 const {pair}=await f.request('pairOpen');await f.request('pairClose',{id:pair.id});
 let r=await f.request('pairState');assert.match(r.pair.legs[0].error,/disabled/);
 ready=true;f.time(1001);await f.controller.pulse();r=await f.request('pairState');assert.equal(r.pair.legs[0].error,null);assert.equal(r.pair.legs[0].closeClickedAt,101001);
});
function newTabController(f,{originAvailable=async()=>false}={}) {
 const c=createManualPairs({...f.api,load:async()=>f.stored(),originAvailable});
 const request=(type,extra={})=>c.request({...binding,targetTabId:22,targetTabKey:'new-session',type,...extra});
 return {c,request};
}
test('orphaned pair restores exact saved IDs to a new tab without any entry or close',async()=>{
 const f=fixture();const opened=await f.request('pairOpen');
 const n=newTabController(f);const check=await n.request('pairInspect');
 assert.equal(check.ready,false);assert.equal(check.recovery.canRestore,true);
 const before=[f.entries.length,f.closes.length];
 const restored=await n.request('pairRestore',{id:opened.pair.id});
 assert.deepEqual(restored.pair.legs.map(l=>l.positionId),opened.pair.legs.map(l=>l.positionId));
 assert.deepEqual([f.entries.length,f.closes.length],before);
 await n.c.pulse();assert.equal((await n.request('pairState')).pair.status,'open');
 await n.request('pairClose',{id:opened.pair.id});assert.equal(f.closes.length,2);assert.ok(f.closes.every(o=>o.targetTabId===22&&o.targetTabKey==='new-session'));
});
test('a live original tab cannot be stolen and an unknown origin check fails closed',async()=>{
 const f=fixture();const {pair}=await f.request('pairOpen');
 for (const originAvailable of [async()=>true,async()=>{throw Error('tab inventory unavailable');}]) {
  const n=newTabController(f,{originAvailable});const r=await n.request('pairInspect');
  assert.ok(!r.recovery?.canRestore);await assert.rejects(n.request('pairRestore',{id:pair.id}));
 }
 assert.equal(f.entries.length,2);assert.equal(f.closes.length,0);assert.equal(f.stored()[0].targetTabId,11);
});
test('restore refuses wrong wallet, market, ID, pending requests, changed leg details and unknown fills',async()=>{
 for (const scenario of ['wallet','market','id','pending','details','unknown']) {
  const f=fixture({autoFill:scenario!=='unknown'});const {pair}=await f.request('pairOpen');
  if(scenario==='wallet')f.owner('0x'+'2'.repeat(40));
  if(scenario==='pending')f.pending(1);
  if(scenario==='details')f.replaceRows(f.rows().map((r,i)=>i===0?{...r,leverage:200}:r));
  const n=newTabController(f);
  await assert.rejects(n.request('pairRestore',{id:scenario==='id'?'wrong':pair.id,...(scenario==='market'?{market:'ETH'}:{})}));
  assert.equal(f.closes.length,0);assert.equal(f.entries.length,2);assert.equal(f.stored()[0].targetTabId,11);
 }
});
test('restore pauses a previous Close intent and never replays uncertain closes',async()=>{
 const f=fixture({closeOverride:async()=>{throw Error('reply lost');}});const {pair}=await f.request('pairOpen');await f.request('pairClose',{id:pair.id});
 assert.equal(f.closes.length,2);const n=newTabController(f);
 const r=await n.request('pairRestore',{id:pair.id});assert.equal(r.pair.closeRequested,false);assert.equal(r.pair.previousCloseRequested,true);
 await n.c.pulse();assert.equal(f.closes.length,2);await n.request('pairClose',{id:pair.id});assert.equal(f.closes.length,2,'unknown Close is never replayed');
});
test('restored missing positions require two new complete absence observations and ignore unrelated positions',async()=>{
 const f=fixture();const {pair}=await f.request('pairOpen');f.replaceRows([{market:'BTC',side:'long',positionId:'unrelated',margin:25,leverage:400,entryPrice:83000}]);
 const n=newTabController(f);await n.request('pairRestore',{id:pair.id});
 assert.notEqual((await n.request('pairState')).pair.status,'closed');await n.c.pulse();assert.notEqual((await n.request('pairState')).pair.status,'closed');
 await n.c.pulse();assert.equal((await n.request('pairState')).pair.status,'closed');assert.equal(f.closes.length,0);
});
test('storage failure rolls back recovery binding and Close intent; it sends no trades',async()=>{
 let fail=false;const f=fixture({saveOverride:async()=>{if(fail)throw Error('disk full');}});const {pair}=await f.request('pairOpen');
 const n=newTabController(f);fail=true;await assert.rejects(n.request('pairRestore',{id:pair.id}),/disk full/);
 const old=await n.c.request({...binding,type:'pairState'});assert.equal(old.pair.targetTabId,11);assert.equal(old.pair.restoredAt,undefined);assert.equal(f.closes.length,0);
});
test('recovery rejects duplicated native IDs and previously closed legs that reappear',async()=>{
 for (const scenario of ['duplicate','reappear']) {
  const f=fixture();await f.request('pairOpen');const saved=f.stored();
  if(scenario==='duplicate')saved[0].legs[1].positionId=saved[0].legs[0].positionId;
  else saved[0].legs[1].closed=true;
  const c=createManualPairs({...f.api,load:async()=>saved,originAvailable:async()=>false});
  if(scenario==='duplicate'){await assert.rejects(c.ready,/tracking is unreadable/);assert.equal(f.closes.length,0);continue;}
  const m={...binding,targetTabId:22,targetTabKey:'new-session'};
  const check=await c.request({...m,type:'pairInspect'});assert.equal(check.recovery.canRestore,false);
  await assert.rejects(c.request({...m,type:'pairRestore',id:saved[0].id}));assert.equal(f.closes.length,0);
 }
});
test('pair timing records native clicks, acknowledgement and stable absence confirmation separately',async()=>{
 let f;f=fixture({executeOverride:async(o,{fill})=>{const clickedAt=f.api.now();f.time(100);fill(o.side);return {clicked:true,clickedAt};},closeOverride:async()=>({clicked:true,executionCheck:{clickedAt:f.api.now()}})});
 const {pair}=await f.request('pairOpen');assert.equal(pair.legs[0].clickedAt,100000);assert.equal(pair.legs[0].entryAcknowledgedAt,100100);assert.equal(pair.legs[0].filledAt,100200);assert.equal(pair.legs[0].clickTimeSource,'native');
 await f.request('pairClose',{id:pair.id});f.replaceRows([]);f.time(1000);await f.controller.pulse();f.time(1000);await f.controller.pulse();
 const closed=(await f.request('pairState')).pair;assert.equal(closed.legs[0].closedObservedAt,102200);assert.equal(closed.legs[0].closeTimeSource,'native');
 f.time(5000);await f.controller.pulse();assert.equal((await f.request('pairState')).pair.legs[0].closedObservedAt,102200);
});
test('unavailable observations mark pending timing samples interrupted without replaying actions',async()=>{
 const f=fixture({autoFill:false});const {pair}=await f.request('pairOpen');f.owner(null);await f.controller.pulse();f.owner(owner);f.fill('long','111');f.fill('short','112');await f.controller.pulse();
 const r=(await f.request('pairState')).pair;assert.equal(r.legs[0].entryObservationInterrupted,true);assert.equal(f.entries.length,2);assert.equal(f.closes.length,0);
 await f.request('pairClose',{id:pair.id});assert.equal(f.closes.length,2);
});
test('a disconnected close observation cannot produce a misleading close latency sample',async()=>{
 let f;f=fixture({closeOverride:async()=>({clicked:true,executionCheck:{clickedAt:f.api.now()}})});
 const {pair}=await f.request('pairOpen');await f.request('pairClose',{id:pair.id});f.owner(null);await f.controller.pulse();
 f.owner(owner);f.replaceRows([]);await f.controller.pulse();await f.controller.pulse();const r=(await f.request('pairState')).pair;
 assert.equal(r.status,'closed');assert.equal(r.legs[0].closeObservationInterrupted,true);assert.equal(f.closes.length,2);
});

test('worker restart invalidates visible marks until a fresh account observation without replaying entries',async()=>{
 const f=fixture();await f.request('pairOpen');
 f.replaceRows(f.rows().map(r=>({...r,markPrice:83100})));await f.controller.pulse();
 const saved=structuredClone(f.stored());assert.ok(saved[0].legs.every(l=>l.visible));
 const c=createManualPairs({...f.api,load:async()=>saved});await c.ready;
 const {pair}=await c.request({...binding,type:'pairState'});
 assert.equal(pair.observedAt,null);assert.ok(pair.legs.every(l=>l.visible===null&&l.markPrice===null&&l.absent===0));
 assert.deepEqual(pair.legs.map(l=>l.positionId),saved[0].legs.map(l=>l.positionId));
 await c.pulse();const fresh=(await c.request({...binding,type:'pairState'})).pair;
 assert.ok(fresh.legs.every(l=>l.visible&&l.markPrice===83100));assert.equal(f.entries.length,2);assert.equal(f.closes.length,0);
});
test('worker restart requires two new complete absence observations and excludes interrupted close latency',async()=>{
 const f=fixture();const {pair}=await f.request('pairOpen');await f.request('pairClose',{id:pair.id});await f.controller.pulse();
 const saved=structuredClone(f.stored());assert.ok(saved[0].legs.every(l=>l.absent===1&&!l.closed));
 for(const l of saved[0].legs){l.closeClickedAt=100000;l.closeTimeSource='native';}
 const c=createManualPairs({...f.api,load:async()=>saved});await c.ready;f.time(30000);
 await c.pulse();let state=(await c.request({...binding,type:'pairState'})).pair;
 assert.equal(state.status,'closing');assert.ok(state.legs.every(l=>l.absent===1&&!l.closed&&l.closeObservationInterrupted));
 await c.pulse();state=(await c.request({...binding,type:'pairState'})).pair;
 assert.equal(state.status,'closed');assert.ok(state.legs.every(l=>legTiming(l).closeMs===null));assert.equal(f.closes.length,2);assert.equal(f.entries.length,2);
});
test('restart marks pending entries interrupted but preserves completed timing evidence and history',async()=>{
 const f=fixture({autoFill:false,executeOverride:async()=>({clicked:true,clickedAt:100000})});await f.request('pairOpen');
 const c=createManualPairs({...f.api,load:async()=>structuredClone(f.stored())});await c.ready;
 f.fill('long','301');f.fill('short','302');await c.pulse();
 const {pair}=await c.request({...binding,type:'pairState'});assert.ok(pair.legs.every(l=>l.entryObservationInterrupted&&l.entry==='filled'&&legTiming(l).entryMs===null));assert.equal(f.entries.length,2);
 const finished={...structuredClone(pair),status:'closed',closedAt:100500,observedAt:100500};
 finished.legs=finished.legs.map(l=>({...l,closed:true,entryObservationInterrupted:false,filledAt:100100,closedObservedAt:100400,closeObservationInterrupted:false}));
 const history=structuredClone(finished);const h=createManualPairs({...f.api,load:async()=>[finished]});await h.ready;
 assert.deepEqual((await h.request({...binding,type:'pairState'})).pair,history);assert.ok(history.legs.every(l=>legTiming(l).entryMs===100));
});
test('unknown native click outcomes stop the unsent side and never replay uncertain closes',async()=>{
 const entry=fixture({executeOverride:async(o,{fill})=>{fill(o.side);return {ok:false,clicked:null,error:'Native click outcome uncertain'};}});
 const opened=await entry.request('pairOpen');assert.equal(entry.entries.length,1);assert.equal(opened.pair.legs[1].entry,'not_sent');assert.notEqual(opened.pair.status,'closed');await entry.controller.pulse();assert.equal(entry.entries.length,1);
 const f=fixture({closeOverride:async()=>({ok:false,clicked:null,error:'Native click outcome uncertain'})});const {pair}=await f.request('pairOpen');await f.request('pairClose',{id:pair.id});
 for(let i=0;i<3;i++){f.time(2000);await f.controller.pulse();}assert.equal(f.closes.length,2);assert.ok((await f.request('pairState')).pair.legs.every(l=>l.close==='uncertain'));assert.equal(f.entries.length,2);
});
test('entry and first Close request retain separate frozen queue context without extra orders',async()=>{
 let reading={live:true,source:'public-stream',sourceAt:100000,receivedAt:100000,level:'MEDIUM',pending:4,clearSeconds:3};
 const f=fixture({queue:()=>reading});const {pair}=await f.request('pairOpen');assert.equal(pair.entryQueue.pending,4);
 f.time(1000);reading={...reading,sourceAt:101000,receivedAt:101000,level:'HIGH',pending:40,clearSeconds:8};await f.request('pairClose',{id:pair.id});
 reading.pending=400;await f.request('pairClose',{id:pair.id});const state=(await f.request('pairState')).pair;
 assert.equal(state.entryQueue.pending,4);assert.equal(state.closeQueue.pending,40);assert.equal(state.closeQueue.recordedAt,101000);assert.equal(f.entries.length,2);assert.equal(f.closes.length,2);
});
test('unavailable queue evidence never blocks pair entry or closing',async()=>{
 const f=fixture({queue:()=>{throw Error('private context');}});const {pair}=await f.request('pairOpen');assert.equal(pair.entryQueue.available,false);await f.request('pairClose',{id:pair.id});await f.controller.pulse();await f.controller.pulse();
 const result=(await f.request('pairState')).pair;assert.equal(result.status,'closed');assert.equal(result.closeQueue.available,false);assert.equal(f.entries.length,2);assert.equal(f.closes.length,2);assert.doesNotMatch(JSON.stringify(result),/private context/);
});
test('saved history verifies the live wallet and asset and returns only closed pairs across tabs without actions',async()=>{
 const closed={id:'old',owner,market:'BTC',status:'closed',margin:25,leverage:400,beforePositionIds:[],createdAt:1,legs:[],targetTabId:99,targetTabKey:'old-session'};
 let liveOwner=owner;let reads=0;const c=createManualPairs({load:async()=>[closed,{...closed,id:'foreign',owner:'0x'+'2'.repeat(40)},{...closed,id:'eth',market:'ETH'},{...closed,id:'active',status:'opening',legs:['long','short'].map(side=>({side,entry:'not_sent',close:'available'}))}],save:async()=>assert.fail('history must not write'),identify:async()=>{reads++;return {ok:true,owner:liveOwner,market:'BTC'};},snapshot:async()=>assert.fail('history must not read positions'),execute:async()=>assert.fail('history cannot enter'),close:async()=>assert.fail('history cannot close')});
 const request=()=>c.request({...binding,targetTabId:22,targetTabKey:'new-session',type:'pairHistory',owner:'0x'+'2'.repeat(40)});
 const result=await request();assert.deepEqual(result.history.map(p=>p.id),['old']);assert.equal(result.owner,owner);assert.equal(reads,1);
 liveOwner='0x'+'2'.repeat(40);assert.deepEqual((await request()).history.map(p=>p.id),['foreign']);liveOwner=null;await assert.rejects(request(),/wallet/);
});
test('history read does not wait behind a stalled native entry acknowledgement',async()=>{
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const f=fixture({executeOverride:async()=>{entered();await gate;return {clicked:true};}});
 const opening=f.request('pairOpen');await started;const result=await f.request('pairHistory',{targetTabId:22,targetTabKey:'new-session'});assert.deepEqual(result.history,[]);assert.equal(f.entries.length,1);release();await opening;
});
test('failed initial pair save restores prior tracking and permits a clean explicit retry',async()=>{
 let fail=true;const f=fixture({saveOverride:async()=>{if(fail)throw Error('storage full');}});
 await assert.rejects(f.request('pairOpen'),/storage full/);assert.equal((await f.request('pairState')).pair,null);assert.equal(f.controller.blocksEntries(),false);assert.equal(f.entries.length,0);assert.deepEqual(f.stored(),[]);
 fail=false;const {pair}=await f.request('pairOpen');assert.equal(pair.status,'open');assert.equal(f.entries.length,2);assert.equal(f.stored().length,1);
});
test('failed initial pair save does not prune previous history or publish a new attempt',async()=>{
 const history=Array.from({length:31},(_,i)=>({...binding,id:'closed-'+i,owner,margin:25,leverage:400,status:'closed',createdAt:i,closedAt:i+1,legs:[]}));
 const f=fixture({stored:history,saveOverride:async()=>{throw Error('storage full');}});const before=await f.request('pairState');await assert.rejects(f.request('pairOpen'),/storage full/);assert.deepEqual(await f.request('pairState'),before);assert.deepEqual(f.stored(),history);assert.equal(f.entries.length,0);
});
test('Close during a failed initial pair write cannot preserve an orphan active pair or send entries',async()=>{
 let rejectWrite,entered,writes=0;const started=new Promise(r=>entered=r),gate=new Promise((_,reject)=>rejectWrite=reject);
 const f=fixture({saveOverride:async()=>{if(++writes===1){entered();await gate;}}});const opening=f.request('pairOpen');await started;
 const pair=(await f.request('pairState')).pair;const closing=f.request('pairClose',{id:pair.id});const failed=assert.rejects(opening,/storage full/);rejectWrite(Error('storage full'));await failed;await closing;
 assert.equal((await f.request('pairState')).pair,null);assert.equal(f.controller.blocksEntries(),false);assert.equal(f.entries.length,0);assert.equal(f.closes.length,0);assert.deepEqual(f.stored(),[]);
});
for(const side of ['long','short'])test(`failed ${side} entry reservation is known not sent and never replayed`,async()=>{
 let fail=true;const f=fixture({saveOverride:async value=>{if(fail&&value[0].legs.find(l=>l.side===side).entry==='sending')throw Error('reservation storage full');}});
 await assert.rejects(f.request('pairOpen'),/reservation storage full/);const pair=(await f.request('pairState')).pair,leg=pair.legs.find(l=>l.side===side);assert.equal(leg.entry,'not_sent');assert.equal(leg.entryRequestedAt,undefined);assert.equal(f.entries.length,side==='long'?0:1);assert.equal(pair.status,side==='long'?'closed':'attention');assert.equal(f.controller.blocksEntries(),side==='short');
 fail=false;
 if(side==='long'){await f.request('pairOpen');assert.equal(f.entries.length,2);}
 else{await f.controller.pulse();const current=(await f.request('pairState')).pair;assert.equal(current.legs[0].entry,'filled');assert.equal(current.legs[1].entry,'not_sent');await f.request('pairClose',{id:pair.id});await f.controller.pulse();await f.controller.pulse();assert.equal(f.closes.length,1);assert.equal(f.entries.length,1);assert.equal((await f.request('pairState')).pair.status,'closed');}
});
test('persistent storage failure after a rejected first-leg reservation cannot strand an in-memory sending leg',async()=>{
 let failed=false,healthy=false;const f=fixture({saveOverride:async value=>{if(value[0].legs[0].entry==='sending')failed=true;if(failed&&!healthy)throw Error('storage offline');}});
 await assert.rejects(f.request('pairOpen'),/storage offline/);const current=(await f.request('pairState')).pair;assert.equal(current.status,'closed');assert.equal(current.legs[0].entry,'not_sent');assert.equal(f.controller.blocksEntries(),false);assert.equal(f.entries.length,0);
 healthy=true;const restarted=createManualPairs(f.api);await restarted.pulse();assert.equal((await restarted.request({...binding,type:'pairState'})).pair.status,'closed');assert.equal(f.entries.length,0);
});
test('a failure saving an actual entry acknowledgement retains the submitted leg and blocks a new pair',async()=>{
 let fail=true;const f=fixture({saveOverride:async value=>{if(fail&&value[0].legs[0].entry==='submitted')throw Error('acknowledgement storage full');}});
 await assert.rejects(f.request('pairOpen'),/acknowledgement storage full/);assert.equal(f.entries.length,1);assert.equal(f.controller.blocksEntries(),true);const pair=(await f.request('pairState')).pair;assert.equal(pair.legs[0].entry,'submitted');assert.notEqual(pair.status,'closed');await assert.rejects(f.request('pairOpen'),/already/);
 fail=false;await f.controller.pulse();await f.request('pairClose',{id:pair.id});assert.equal(f.closes.length,1);assert.equal(f.entries.length,1);
});
test('failed pair Close reservations stay unsent and resume after storage recovers',async()=>{
 let fail=false;const f=fixture({saveOverride:async value=>{if(fail&&value[0].legs.some(l=>l.close==='sending'))throw Error('close reservation storage full');}});const {pair}=await f.request('pairOpen');fail=true;
 await assert.rejects(f.request('pairClose',{id:pair.id}),/close reservation storage full/);const current=(await f.request('pairState')).pair;assert.equal(current.closeRequested,true);assert.equal(current.status,'attention');assert.equal(f.closes.length,0);assert.ok(current.legs.every(l=>l.close==='available'&&l.closeRequestedAt===undefined));
 fail=false;await f.controller.pulse();assert.equal(f.closes.length,2);await f.controller.pulse();await f.controller.pulse();assert.equal((await f.request('pairState')).pair.status,'closed');assert.equal(f.closes.length,2);
});
test('persistent Close storage outage does not turn known-unsent legs into uncertain sends',async()=>{
 let failed=false,healthy=false;const f=fixture({saveOverride:async value=>{if(value[0].legs.some(l=>l.close==='sending'))failed=true;if(failed&&!healthy)throw Error('close storage offline');}});const {pair}=await f.request('pairOpen');
 await assert.rejects(f.request('pairClose',{id:pair.id}),/close storage offline/);await assert.rejects(f.controller.pulse(),/close storage offline/);const current=(await f.request('pairState')).pair;assert.equal(current.closeRequested,true);assert.ok(current.legs.every(l=>l.close==='available'));assert.equal(f.closes.length,0);
 healthy=true;await f.controller.pulse();assert.equal(f.closes.length,2);
});
for(const longOutcome of ['submitted','uncertain'])test(`a rejected new Close reservation preserves a ${longOutcome} sibling without replay`,async()=>{
 let fail=false,shortAttempts=0;const f=fixture({closeOverride:async o=>o.side==='long'?{clicked:longOutcome==='submitted'?true:null}:++shortAttempts===1?{clicked:false,error:'temporarily unavailable'}:{clicked:true},saveOverride:async value=>{if(fail&&value[0].legs[1].close==='sending')throw Error('retry reservation failed');}});const {pair}=await f.request('pairOpen');await f.request('pairClose',{id:pair.id});assert.equal(f.closes.length,2);f.time(1001);fail=true;
 await f.controller.pulse();assert.match((await f.request('pairState')).pair.message,/retry reservation failed/);let current=(await f.request('pairState')).pair;assert.equal(current.legs[0].close,longOutcome);assert.equal(current.legs[1].close,'available');assert.equal(f.closes.length,2);
 fail=false;await f.controller.pulse();current=(await f.request('pairState')).pair;assert.equal(current.legs[0].close,longOutcome);assert.equal(f.closes.filter(o=>o.side==='long').length,1);assert.equal(f.closes.filter(o=>o.side==='short').length,2);
});
test('failed observation persistence retains a verified position read and valid close timing',async()=>{
 let fail=false;const f=fixture({closeOverride:async()=>({clicked:true,clickedAt:100000}),saveOverride:async()=>{if(fail)throw Error('observation save offline');}});const {pair}=await f.request('pairOpen');await f.request('pairClose',{id:pair.id});f.time(1001);fail=true;
 await assert.rejects(f.controller.pulse(),/observation save offline/);let current=(await f.request('pairState')).pair;assert.equal(current.observationError,false);assert.equal(current.observedAt,101001);assert.ok(current.legs.every(l=>l.closeObservationInterrupted!==true));assert.equal(f.closes.length,2);
 fail=false;f.replaceRows([]);await f.controller.pulse();f.time(1001);await f.controller.pulse();current=(await f.request('pairState')).pair;assert.equal(current.status,'closed');assert.ok(current.legs.every(l=>Number.isFinite(legTiming(l,102002).closeMs)));assert.equal(f.closes.length,2);
});
test('a real account observation failure still invalidates timings when its save also fails',async()=>{
 let fail=false;const f=fixture({closeOverride:async()=>({clicked:true}),saveOverride:async()=>{if(fail)throw Error('save offline');}});const {pair}=await f.request('pairOpen');await f.request('pairClose',{id:pair.id});f.owner('0x'+'2'.repeat(40));fail=true;
 await assert.rejects(f.controller.pulse(),/save offline/);const current=(await f.request('pairState')).pair;assert.equal(current.observationError,true);assert.ok(current.legs.every(l=>l.closeObservationInterrupted===true));assert.equal(f.closes.length,2);
});
test('Close reservation storage errors do not falsely invalidate a successful native position read',async()=>{
 let fail=false;const f=fixture({saveOverride:async value=>{if(fail&&value[0].legs.some(l=>l.close==='sending'))throw Error('reservation offline');}});const {pair}=await f.request('pairOpen');fail=true;await assert.rejects(f.request('pairClose',{id:pair.id}),/reservation offline/);f.time(1001);await f.controller.pulse();const current=(await f.request('pairState')).pair;assert.equal(current.observationError,false);assert.equal(current.observedAt,101001);assert.equal(f.closes.length,0);assert.ok(current.legs.every(l=>l.close==='available'));
});
test('changed bound position details still invalidate observations and cannot authorize another Close',async()=>{
 const f=fixture({closeOverride:async()=>({clicked:true})});const {pair}=await f.request('pairOpen');await f.request('pairClose',{id:pair.id});f.replaceRows(f.rows().map(row=>({...row,margin:999})));await f.controller.pulse();const current=(await f.request('pairState')).pair;assert.equal(current.observationError,true);assert.match(current.message,/Bound position details changed/);assert.ok(current.legs.every(l=>l.closeObservationInterrupted===true));assert.equal(f.closes.length,2);
});
test('pair readiness reports the verified wallet without writing or sending entries',async()=>{
 const f=fixture();const ready=await f.request('pairInspect');assert.equal(ready.owner,owner);assert.equal(ready.ready,true);assert.equal(f.writes.length,0);assert.equal(f.entries.length,0);
});
test('pair Open rejects a wallet change after readiness and accepts an explicitly refreshed wallet',async()=>{
 const f=fixture();await f.request('pairInspect');const selected=owner;f.owner('0x'+'2'.repeat(40));await assert.rejects(f.request('pairOpen',{expectedOwner:selected}),/Wallet changed since readiness check/);assert.equal(f.entries.length,0);assert.deepEqual(f.stored(),[]);assert.equal((await f.request('pairState')).pair,null);
 const refreshed=await f.request('pairInspect');const result=await f.request('pairOpen',{expectedOwner:refreshed.owner});assert.equal(result.pair.owner,'0x'+'2'.repeat(40));assert.equal(f.entries.length,2);
});
test('malformed selected-wallet identities cannot open a pair',async()=>{
 const f=fixture();for(const expectedOwner of ['invalid',{},0]){await assert.rejects(f.request('pairOpen',{expectedOwner}),/Wallet changed since readiness check/);assert.equal(f.entries.length,0);assert.deepEqual(f.stored(),[]);}const result=await f.request('pairOpen',{expectedOwner:owner});assert.equal(result.pair.owner,owner);assert.equal(f.entries.length,2);
});

test('stale displayed pair margin or leverage rejects before any journal or native action',async()=>{
 for(const expectedTicket of [{margin:20,leverage:400},{margin:25,leverage:300}]){
  const f=fixture();await assert.rejects(f.request('pairOpen',{expectedOwner:owner,expectedTicket}),/Margin or leverage changed/);
  assert.equal(f.writes.length,0);assert.equal(f.entries.length,0);assert.equal((await f.request('pairState')).pair,null);
  await f.request('pairOpen',{expectedOwner:owner,expectedTicket:{margin:25,leverage:400}});assert.equal(f.entries.length,2);
 }
});
test('malformed selected pair sizing cannot silently use the native ticket',async()=>{
 for(const expectedTicket of [{},{margin:'25',leverage:400},{margin:25,leverage:'400'},false,0]){
  const f=fixture();await assert.rejects(f.request('pairOpen',{expectedTicket}),/Margin or leverage changed/);assert.equal(f.entries.length,0);assert.equal(f.writes.length,0);
 }
});

test('readiness reports the native ticket actually verified, independently of caller sizing',async()=>{
 const f=fixture();const result=await f.request('pairInspect',{margin:99,leverage:999});
 assert.deepEqual(result.ticket,{margin:25,leverage:400});result.ticket.margin=80;
 assert.deepEqual((await f.request('pairInspect')).ticket,{margin:25,leverage:400});assert.equal(f.entries.length,0);assert.equal(f.writes.length,0);
});

for(const side of ['long','short']) test('Close during '+side+' reservation save prevents that still-unsent native entry',async()=>{
 let release,entered,held=false;
 const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const f=fixture({saveOverride:async value=>{if(!held&&value[0]?.legs.find(l=>l.side===side)?.entry==='sending'){held=true;entered();await gate;}}});
 const opening=f.request('pairOpen');await started;
 const {pair}=await f.request('pairState');assert.equal(f.entries.length,side==='long'?0:1);
 const closing=f.request('pairClose',{id:pair.id});await new Promise(r=>setImmediate(r));release();await Promise.all([opening,closing]);await f.controller.pulse();await f.controller.pulse();
 assert.deepEqual(f.entries.map(e=>e.side),side==='long'?[]:['long']);assert.deepEqual(f.closes.map(e=>e.side),side==='long'?[]:['long']);
 const result=(await f.request('pairState')).pair;assert.equal(result.status,'closed');const skipped=result.legs.find(l=>l.side===side);assert.equal(skipped.entry,'not_sent');assert.equal(skipped.entryRequestedAt,undefined);assert.equal(f.stored()[0].legs.find(l=>l.side===side).entry,'not_sent');
});
