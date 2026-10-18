import {test} from 'node:test';import assert from 'node:assert/strict';import {exitReason,exitLevels,validateExits} from '../extension/core.js';import {createEngine} from '../extension/engine.js';
const time=Date.now();
const quote=price=>({market:'BTC',bid:price,ask:price,sourceAt:time,receivedAt:time});
test('long and short SL and TP trigger $2 early, not only after the requested price',()=>{
 for(const [side,stopLoss,takeProfit,slPrice,tpPrice] of [['long',83000,84000,83002,83998],['short',84000,83000,83998,83002]]) {
  const order={owner:'0x'+'1'.repeat(40),market:'BTC',side,stopLoss,takeProfit,exitLead:2};
  assert.deepEqual(exitLevels(order),{stopLoss:slPrice,takeProfit:tpPrice});
  assert.equal(exitReason(order,quote(slPrice),time),'stop loss');assert.equal(exitReason(order,quote(tpPrice),time),'take profit');
  assert.equal(exitReason(order,quote((stopLoss+takeProfit)/2),time),null);
 }
});
test('legacy exits retain original thresholds; overlapping early triggers rejected',()=>{
 const order={owner:'0x'+'1'.repeat(40),market:'BTC',side:'long',stopLoss:83000,takeProfit:84000};assert.equal(exitReason(order,quote(83001),time),null);
 assert.throws(()=>validateExits({side:'long',stopLoss:83000,takeProfit:83003,exitLead:2}),/overlap/);
 assert.throws(()=>validateExits({side:'short',stopLoss:84000,exitLead:-1}),/Early/);
 assert.throws(()=>validateExits({side:'long',takeProfit:1,exitLead:2}),/exceeds/);
});
function harness(){let entries=0,closes=0,stored=[];const position={market:'BTC',side:'short',positionId:'101862',margin:20,leverage:531,entryPrice:82993.5};
 const engine=createEngine({load:async()=>[],save:async v=>{stored=v;},probe:async()=>{throw Error('No entry probe permitted');},execute:async()=>{entries++;throw Error('No entry permitted');},positions:async()=>({ok:true,owner:'0x'+'1'.repeat(40),positions:[position]}),close:async o=>{assert.equal(o.positionId,'101862');closes++;return {ok:true,clicked:true};},now:()=>time});
 return {engine,entries:()=>entries,closes:()=>closes,stored:()=>stored};}
test('manually opened position accepts SL-only exits and closes once early without entry',async()=>{
 const h=harness();await h.engine.quote(quote(83014));const list=await h.engine.request({type:'listPositions',market:'BTC'});assert.equal(list.positions[0].positionId,'101862');
 await h.engine.request({type:'protectPosition',market:'BTC',positionId:'101862',stopLoss:83020,exitLead:2});assert.equal(h.stored()[0].status,'exits_armed');assert.equal(h.entries(),0);assert.equal(h.closes(),0);
 await assert.rejects(h.engine.request({type:'protectPosition',market:'BTC',positionId:'101862',stopLoss:83020}),/already/);
 await h.engine.quote(quote(83018));await h.engine.quote(quote(83021));assert.equal(h.closes(),1);assert.equal(h.entries(),0);assert.equal(h.stored()[0].exitReason,'stop loss');
});
test('external position can use TP-only exits and rejects invalid ID or empty protection',async()=>{
 const h=harness();await h.engine.quote(quote(83014));await assert.rejects(h.engine.request({type:'protectPosition',market:'BTC',positionId:'wrong',stopLoss:83020}),/available/);await assert.rejects(h.engine.request({type:'protectPosition',market:'BTC',positionId:'101862'}),/Enter/);
 await h.engine.request({type:'protectPosition',market:'BTC',positionId:'101862',takeProfit:83000,exitLead:1});await h.engine.quote(quote(83001));assert.equal(h.closes(),1);assert.equal(h.entries(),0);assert.equal(h.stored()[0].exitReason,'take profit');
});
