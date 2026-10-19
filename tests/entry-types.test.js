import test from 'node:test';import assert from 'node:assert/strict';
import {validateOrder,hit,entryWindow} from '../extension/core.js';import {createEngine} from '../extension/engine.js';
const now=100000,owner='0x'+'1'.repeat(40),input={market:'BTC',side:'long',price:83000,margin:40,leverage:300,entryTolerance:2};
const venue={schemaVersion:1,tradingPaused:false,receivedAt:now,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
const tick=(price,time=now)=>({market:'BTC',price,mid:price,bid:price-.1,ask:price+.1,sourceAt:time,receivedAt:time});
test('trigger entries cross in the opposite direction from limits and honor their entry window',()=>{
 const long=validateOrder({...input,entryMode:'trigger'},venue,now),short={...long,side:'short'};assert.equal(hit(long,tick(82999),now),false);assert.equal(entryWindow(long,tick(83001),now),true);assert.equal(entryWindow(long,tick(83010),now),false);assert.equal(hit(short,tick(83001),now),false);assert.equal(entryWindow(short,tick(82999),now),true);assert.equal(entryWindow(short,tick(82990),now),false);
});
test('market requests require fresh quotes and expire within ten seconds',()=>{
 const order=validateOrder({...input,entryMode:'market'},venue,now);assert.equal(order.expiresAt,now+10000);assert.equal(entryWindow(order,tick(83500),now),true);assert.equal(entryWindow(order,tick(83500,now-501),now),false);assert.equal(hit(order,{...tick(83000),market:'ETH'},now),false);
});
function setup({stored=[],execute=async()=>({ok:true,clicked:true})}={}){let time=now,records=[],calls=0;const engine=createEngine({load:async()=>stored,save:async v=>{records=structuredClone(v);},probe:async()=>({ok:true,precisionSupported:true,owner}),execute:async o=>{calls++;return execute(o);},now:()=>time});engine.setVenue(venue);return {engine,time:t=>{time=t;},records:()=>records,calls:()=>calls};}
test('market creation uses the worker quote and executes only once',async()=>{
 const f=setup();await f.engine.quote(tick(83123));const result=await f.engine.request({type:'create',order:{...input,entryMode:'market'}});await f.engine.settled();assert.equal(result.order.price,83123);assert.equal(f.calls(),1);await f.engine.quote(tick(83200));assert.equal(f.calls(),1);
});
test('a deferred market request expires rather than opening on a later price update',async()=>{
 const f=setup({execute:async()=>({ok:true,clicked:false,deferred:true})});await f.engine.quote(tick(83000));await f.engine.request({type:'create',order:{...input,entryMode:'market'}});assert.equal(f.calls(),1);f.time(now+10001);await f.engine.quote(tick(84000,now+10001));await f.engine.settled();assert.equal(f.calls(),1);assert.equal(f.records()[0].status,'expired');
});
test('restart discards unsubmitted market requests while preserving ordinary trigger watches',async()=>{
 const market={...validateOrder({...input,entryMode:'market'},venue,now),owner},trigger={...validateOrder({...input,entryMode:'trigger'},venue,now),owner};const f=setup({stored:[market,trigger]});const state=await f.engine.request({type:'state'});assert.equal(state.orders[0].status,'cancelled');assert.equal(state.orders[1].status,'watching');assert.equal(f.calls(),0);
});
test('uncertain market click outcomes never submit again on subsequent quotes',async()=>{
 const f=setup({execute:async()=>({clicked:null,error:'Acknowledgement lost'})});await f.engine.quote(tick(83000));await f.engine.request({type:'create',order:{...input,entryMode:'market'}});await f.engine.settled();await f.engine.quote(tick(83001));assert.equal(f.calls(),1);assert.equal(f.records()[0].status,'attention');
});
test('stale market data refuses a new market request',async()=>{
 const f=setup();await f.engine.quote(tick(83000,now-6000));await assert.rejects(f.engine.request({type:'create',order:{...input,entryMode:'market'}}),/fresh market quote/);assert.equal(f.calls(),0);
});
test('market submission expiry does not disable exits while a queued fill is still settling',async()=>{
 let time=now,visible=false;const engine=createEngine({load:async()=>[],save:async()=>{},now:()=>time,probe:async()=>({ok:true,precisionSupported:true,owner}),execute:async()=>({ok:true,clicked:true,beforePositionIds:[],bindingSnapshotComplete:true}),positions:async()=>({ok:true,owner,positions:visible?[{market:'BTC',side:'long',positionId:'123',margin:40,leverage:300,entryPrice:83000}]:[]}),close:async()=>({ok:true,clicked:true})});engine.setVenue(venue);await engine.quote(tick(83000));await engine.request({type:'create',order:{...input,entryMode:'market',stopLoss:82000}});await engine.settled();time=now+12000;visible=true;await engine.quote(tick(83000,time));await engine.settled();const state=await engine.request({type:'state'});assert.equal(state.orders[0].status,'exits_armed');assert.equal(state.orders[0].positionId,'123');
});
