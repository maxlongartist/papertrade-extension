import {test} from 'node:test';import assert from 'node:assert/strict';import {createEngine} from '../extension/engine.js';
const stamp=Date.now(),order={owner:'0x'+'1'.repeat(40),id:'pending-entry',market:'BTC',side:'long',price:83000,margin:25,leverage:400,entryTolerance:2,entryMode:'limit',priceMode:'papertrade',status:'watching',createdAt:stamp,expiresAt:stamp+86400000};
const tick=price=>({market:'BTC',price,mid:price,bid:price-1,ask:price+1,sourceAt:stamp,receivedAt:stamp});
const row=[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0'];const venue={schemaVersion:1,tradingPaused:false,receivedAt:stamp,instruments:[row],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('cancel pending entry persists and prevents crossing execution after worker restart',async()=>{
 let stored=[order],entries=0;const options={load:async()=>stored,save:async v=>{stored=structuredClone(v);},probe:async()=>({ok:true,precisionSupported:true,owner:'0x'+'1'.repeat(40)}),execute:async()=>{entries++;return {ok:true,clicked:true};},now:()=>stamp};const engine=createEngine(options);engine.setVenue(venue);await engine.quote(tick(83010));const result=await engine.request({type:'cancel',id:order.id});assert.match(result.message,/cancelled before submission/i);assert.equal(stored[0].status,'cancelled');assert.equal(stored[0].events.at(-1).type,'cancelled');
 const restarted=createEngine(options);restarted.setVenue(venue);await restarted.quote(tick(82999));await restarted.settled();assert.equal(entries,0);
});
test('cancelling during slow preflight prevents the eventual native entry',async()=>{
 const ready=deferred(),started=deferred();let entries=0,stored=[];const engine=createEngine({load:async()=>[order],save:async v=>{stored=v;},probe:async()=>{started.resolve();return ready.promise;},execute:async()=>{entries++;return {ok:true,clicked:true};},now:()=>stamp});engine.setVenue(venue);
 await engine.quote(tick(82999));await started.promise;await engine.request({type:'cancel',id:order.id});ready.resolve({ok:true,precisionSupported:true,owner:'0x'+'1'.repeat(40)});await engine.settled();assert.equal(entries,0);assert.equal(stored[0].status,'cancelled');
});
test('reserved or submitted actions never falsely report entry cancellation',async()=>{
 for(const status of ['submitting','submitted','awaiting_fill','closing','close_submitted']){
  const engine=createEngine({load:async()=>[{...order,status}],save:async()=>{},probe:async()=>({ok:true}),execute:async()=>{},now:()=>stamp});await assert.rejects(engine.request({type:'cancel',id:order.id}),/Only a watching order/);
 }
});
test('removing SL/TP persists without closing the position or reactivating after restart',async()=>{
 let stored=[{...order,kind:'position_exits',status:'exits_armed',positionId:'42',stopLoss:82900,takeProfit:84000,exitLead:2,exitPriceMode:'mark'}],closes=0;const options={load:async()=>stored,save:async v=>{stored=structuredClone(v);},probe:async()=>({ok:true}),execute:async()=>{throw Error('must not open');},close:async()=>{closes++;return {ok:true,clicked:true};},now:()=>stamp};const engine=createEngine(options);const result=await engine.request({type:'cancelExits',id:order.id});assert.match(result.message,/position remains open/);assert.equal(stored[0].status,'exits_disabled');assert.equal(stored[0].events.at(-1).type,'exits_cancelled');
 const restarted=createEngine(options);await restarted.quote(tick(82800));await restarted.settled();assert.equal(closes,0);
});
