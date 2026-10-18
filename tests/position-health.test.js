import test from 'node:test';import assert from 'node:assert/strict';
import {createEngine} from '../extension/engine.js';import {positionHealth} from '../extension/position-health.js';import {overview} from '../extension/overview.js';
const owner='0x'+'1'.repeat(40),row={market:'BTC',side:'long',positionId:'42',margin:25,leverage:400,entryPrice:83000};
const armed={...row,owner,id:'watch',status:'exits_armed',price:83000,stopLoss:82000,exitLead:2,exitPriceMode:'mark'};
const tick=(clock,price=83000)=>({market:'BTC',bid:price-1,ask:price+1,price,sourceAt:clock,receivedAt:clock});
test('position health never turns missing, stale or future observations into a visible-position claim',()=>{
 assert.equal(positionHealth({...armed,positionObservation:'visible',positionCheckedAt:100000},100100).warning,false);
 for(const change of [{positionObservation:'absent',positionCheckedAt:100000},{positionObservation:'unavailable',positionCheckedAt:100000},{positionObservation:'visible',positionCheckedAt:94000},{positionObservation:'visible',positionCheckedAt:101101},{}])assert.equal(positionHealth({...armed,...change},100100).warning,true);
 assert.equal(positionHealth({...armed,status:'closed'},100100),null);
});
test('armed position health follows valid page visibility, rejects wrong wallet and never disarms or writes per poll',async()=>{
 let clock=100000,rows=[row],account=owner,writes=0,closes=0;
 const engine=createEngine({load:async()=>[armed],save:async()=>{writes++;},positions:async()=>({ok:true,owner:account,positions:rows}),close:async()=>{closes++;return {ok:true,clicked:true};},now:()=>clock});
 const state=async()=>(await engine.request({type:'state'})).orders[0];assert.equal((await state()).positionObservation,'unknown');
 await engine.quote(tick(clock));await engine.settled();assert.equal((await state()).positionObservation,'visible');
 rows=[];for(let i=0;i<3;i++){clock+=1100;await engine.pulse();await engine.settled();}assert.equal((await state()).positionObservation,'absent');assert.equal((await state()).status,'exits_armed');assert.equal(writes,0);assert.equal(closes,0);
 account='0x'+'2'.repeat(40);clock+=1100;await engine.pulse();await engine.settled();assert.equal((await state()).positionObservation,'unavailable');
 account=owner;rows=[row];clock+=1100;await engine.pulse();await engine.settled();assert.equal((await state()).positionObservation,'visible');assert.equal(writes,0);
});
test('an unresolved armed position read cannot delay a stop or later reactivate its submitted close',async()=>{
 let release,closes=0;const gate=new Promise(r=>release=r);let clock=100000;
 const engine=createEngine({load:async()=>[armed],save:async()=>{},positions:()=>gate,close:async o=>{assert.equal(o.positionId,'42');closes++;return {ok:true,clicked:true};},now:()=>clock});
 await engine.quote(tick(clock));await engine.settled();clock+=100;await engine.quote(tick(clock,81999));await engine.settled();assert.equal(closes,1);
 release({ok:true,owner,positions:[row]});await engine.settled();assert.equal((await engine.request({type:'state'})).orders[0].status,'close_submitted');
});
test('late health response cannot rearm removed exits',async()=>{
 let release;const engine=createEngine({load:async()=>[armed],save:async()=>{},positions:()=>new Promise(r=>release=r),now:()=>100000});
 await engine.quote(tick(100000));await engine.settled();await engine.request({type:'cancelExits',id:'watch'});release({ok:true,owner,positions:[row]});await engine.settled();const order=(await engine.request({type:'state'})).orders[0];assert.equal(order.status,'exits_disabled');assert.notEqual(order.positionObservation,'visible');
});
test('restart never presents saved visibility as a current check',async()=>{
 const engine=createEngine({load:async()=>[{...armed,positionObservation:'visible',positionCheckedAt:100000}],save:async()=>{},now:()=>100000});const order=(await engine.request({type:'state'})).orders[0];assert.equal(order.positionObservation,'unknown');assert.equal(order.positionCheckedAt,null);assert.equal(order.status,'exits_armed');
});
test('toolbar reports missing position health even when quotes and tab bindings are fresh',()=>{
 const s={pairs:[],orders:[{...armed,targetTabId:1,targetTabKey:'tab',positionObservation:'absent',positionCheckedAt:100000}],ticks:{BTC:tick(100000)},feed:'Live',tabs:[{id:1,url:'https://exchange.papertrade.xyz/trade/btc'}],bindings:{1:'tab'},now:100000};
 assert.match(overview(s).items[0].warning,/not visible/);s.orders[0].positionObservation='visible';assert.equal(overview(s).items[0].warning,null);s.now=106000;assert.match(overview(s).items[0].warning,/stale/);
});
