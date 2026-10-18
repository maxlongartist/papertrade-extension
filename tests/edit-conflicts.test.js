import test from 'node:test';import assert from 'node:assert/strict';import {createEngine} from '../extension/engine.js';
const owner='0x'+'1'.repeat(40),stamp=Date.now();
const venue={schemaVersion:1,tradingPaused:false,receivedAt:stamp,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
const ticket={market:'BTC',side:'long',price:83000,entryMode:'limit',entryTolerance:2,margin:25,leverage:400};
function fixture(stored=[]){
 let saved=structuredClone(stored),actions=0,release,entered;const held=new Promise(r=>entered=r);
 const wait=async o=>{if(o?.targetTabId===22){entered();await new Promise(r=>release=r);}};
 const engine=createEngine({load:async()=>structuredClone(stored),save:async v=>{saved=structuredClone(v);},probe:async o=>{await wait(o);return {ok:true,precisionSupported:true,owner};},positions:async o=>{await wait(o);return {ok:true,owner,positions:[{...ticket,entryPrice:83000,positionId:'42'}]};},execute:async()=>{actions++;return {ok:true,clicked:true};},close:async()=>{actions++;return {ok:true,clicked:true};},now:()=>stamp});engine.setVenue(venue);
 return {engine,held,release:()=>release(),saved:()=>saved,actions:()=>actions,quote:()=>engine.quote({market:'BTC',price:83100,bid:83099,ask:83101,sourceAt:stamp,receivedAt:stamp})};
}
for(const kind of ['entry','exits'])test(`a delayed ${kind} save cannot overwrite a newer edit`,async()=>{
 const f=fixture();await f.quote();const {order}=await f.engine.request(kind==='entry'?{type:'create',order:ticket}:{type:'protectPosition',market:'BTC',positionId:'42',stopLoss:82000});
 const slow=f.engine.request({type:'editWatch',id:order.id,expectedRevision:0,price:82000,stopLoss:81000,targetTabId:22,targetTabKey:'slow'});await f.held;
 const newer=await f.engine.request({type:'editWatch',id:order.id,expectedRevision:0,price:82500,stopLoss:81500,targetTabId:33,targetTabKey:'newer'});
 f.release();await assert.rejects(slow,/changed since.*opened|changed while/i);
 const current=(await f.engine.request({type:'state'})).orders[0];assert.deepEqual(current,newer.order);assert.equal(current.stopLoss,81500);assert.equal(current.targetTabId,33);assert.equal(current.editRevision,1);assert.equal(f.actions(),0);
});
test('a stale editor cannot overwrite a saved change after worker restart; a refreshed editor can save',async()=>{
 const f=fixture();await f.quote();const {order}=await f.engine.request({type:'create',order:ticket});
 await f.engine.request({type:'editWatch',id:order.id,expectedRevision:0,price:82500});
 const restored=fixture(f.saved());await restored.quote();
 await assert.rejects(restored.engine.request({type:'editWatch',id:order.id,expectedRevision:0,price:82000}),/changed since.*opened/i);
 assert.equal(restored.saved()[0].price,82500);
 const {order:updated}=await restored.engine.request({type:'editWatch',id:order.id,expectedRevision:1,price:82400});assert.equal(updated.editRevision,2);assert.equal(updated.price,82400);assert.equal(restored.actions(),0);
});
test('legacy saved watches start at revision zero and reject invalid revision tokens',async()=>{
 const f=fixture([{...ticket,id:'legacy',owner,status:'watching',expiresAt:stamp+60000}]);await f.quote();
 for(const expectedRevision of [-1,'0',NaN,1.5])await assert.rejects(f.engine.request({type:'editWatch',id:'legacy',expectedRevision,price:82000}),/changed since.*opened|revision/i);
 const {order}=await f.engine.request({type:'editWatch',id:'legacy',expectedRevision:0,price:82000});assert.equal(order.editRevision,1);assert.equal(f.actions(),0);
});
