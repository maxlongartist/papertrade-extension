import {test} from 'node:test';import assert from 'node:assert/strict';import {createEngine} from '../extension/engine.js';
const baseTime=Date.now();
const armed=(id='stop',stopLoss=83020)=>({owner:'0x'+'1'.repeat(40),id,market:'BTC',side:'short',positionId:id,price:83000,margin:20,leverage:531,stopLoss,exitLead:2,priceMode:'papertrade',status:'exits_armed'});
const tick=(price,stamp=Date.now())=>({market:'BTC',bid:price-1,ask:price+1,price,sourceAt:stamp,receivedAt:stamp});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const venue={schemaVersion:1,tradingPaused:false,receivedAt:baseTime,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
test('unresolved position reads cannot delay an armed stop',async()=>{
 const gate=deferred();let closes=0,stored=[];const engine=createEngine({load:async()=>[{...armed('waiting'),status:'awaiting_fill',beforePositionIds:[],expiresAt:Date.now()+60000},armed()],save:async v=>{stored=v;},positions:()=>gate.promise,close:async()=>{assert.equal(stored.find(o=>o.id==='stop').status,'closing');closes++;return {ok:true,clicked:true};}});
 try{await engine.quote(tick(83018));await engine.settled();assert.equal(closes,1);}finally{gate.resolve({ok:true,owner:'0x'+'1'.repeat(40),positions:[]});await engine.settled();}
});
test('a slow entry preflight does not block a newly crossed stop',async()=>{
 const gate=deferred();let closes=0;const engine=createEngine({load:async()=>[{...armed('entry'),status:'watching',stopLoss:null,price:83010,entryTolerance:2,expiresAt:Date.now()+60000},armed()],save:async()=>{},probe:()=>gate.promise,execute:async()=>({ok:true,clicked:true}),close:async()=>{closes++;return {ok:true,clicked:true};}});engine.setVenue(venue);
 try{await engine.quote(tick(83010));await engine.settled();await engine.quote(tick(83018));await engine.settled();assert.equal(closes,1);}finally{gate.resolve({ok:true,precisionSupported:true,owner:'0x'+'1'.repeat(40)});await engine.settled();}
});
test('one unacknowledged Close does not block another position exit',async()=>{
 const gate=deferred(),ids=[];const engine=createEngine({load:async()=>[armed('one'),armed('two',83025)],save:async()=>{},close:async order=>{ids.push(order.id);return order.id==='one'?gate.promise:{ok:true,clicked:true};}});
 try{await engine.quote(tick(83018));await engine.settled();await engine.quote(tick(83023));await engine.settled();assert.deepEqual(ids,['one','two']);}finally{gate.resolve({ok:true,clicked:true});await engine.settled();}
});
test('fresh brief crossing is latched even if next quote reverses before processing',async()=>{
 let submitted;const engine=createEngine({load:async()=>[armed()],save:async()=>{},close:async order=>{submitted=order;return {ok:true,clicked:true};}});await engine.request({type:'state'});
 await Promise.all([engine.quote(tick(83018)),engine.quote(tick(83010))]);await engine.settled();assert.equal(submitted.triggeredExitPrice,83018);assert.equal(submitted.exitReason,'stop loss');
});
test('position-change event retries transient fill observation without permanent inactive state',async()=>{
 let fail=true,stored=[],reads=0;const engine=createEngine({load:async()=>[{...armed('waiting'),status:'awaiting_fill',beforePositionIds:[],expiresAt:Date.now()+60000}],save:async v=>{stored=v;},positions:async()=>{reads++;return fail?{error:'Native data delayed'}:{ok:true,owner:'0x'+'1'.repeat(40),positions:[{market:'BTC',side:'short',positionId:'new',margin:20,leverage:531,entryPrice:83000}]};},close:async()=>({ok:true,clicked:true})});
 await engine.quote(tick(83010));await engine.settled();assert.equal(stored[0].status,'awaiting_fill');fail=false;await engine.request({type:'positionsChanged',market:'BTC'});await engine.settled();assert.equal(stored[0].status,'exits_armed');assert.equal(reads,2);
});
test('late observation cannot reactivate cancelled exits',async()=>{
 const gate=deferred();let stored=[];const engine=createEngine({load:async()=>[{...armed('waiting'),status:'awaiting_fill',beforePositionIds:[],expiresAt:Date.now()+60000}],save:async v=>{stored=v;},positions:()=>gate.promise});
 await engine.quote(tick(83010));await engine.request({type:'cancelExits',id:'waiting'});gate.resolve({ok:true,owner:'0x'+'1'.repeat(40),positions:[{market:'BTC',side:'short',positionId:'new',margin:20,leverage:531}]});await engine.settled();assert.equal(stored[0].status,'exits_disabled');
});
test('stale crossing does not submit a late price-based close; fresh adverse quote can close',async()=>{
 let closes=0;const engine=createEngine({load:async()=>[armed()],save:async()=>{},close:async()=>{closes++;return {ok:true,clicked:true};}});await engine.request({type:'state'});
 await engine.quote(tick(83018,Date.now()-2000));await engine.settled();assert.equal(closes,0);await engine.quote(tick(83018));await engine.settled();assert.equal(closes,1);
});
test('explicit no-click TP deferral restores SL protection, which can then close once',async()=>{
 let stored=[],clicks=0;const engine=createEngine({load:async()=>[{...armed(),takeProfit:83000}],save:async value=>{stored=value;},close:async order=>{if(order.exitReason==='take profit')return {ok:true,clicked:false,deferred:true};clicks++;return {ok:true,clicked:true};}});
 await engine.quote(tick(83002));await engine.settled();assert.equal(stored[0].status,'exits_armed');assert.equal(clicks,0);await engine.quote(tick(83018));await engine.settled();assert.equal(clicks,1);assert.equal(stored[0].exitReason,'stop loss');
});
