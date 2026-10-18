import test from 'node:test';import assert from 'node:assert/strict';import {createEngine} from '../extension/engine.js';
const stamp=Date.now(),owner='0x'+'1'.repeat(40),base={market:'BTC',side:'long',price:83000,entryMode:'limit',entryTolerance:2,margin:25,leverage:400,targetTabId:11,targetTabKey:'original'};
const venue={schemaVersion:1,tradingPaused:false,receivedAt:stamp,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
function fixture(){
 let clock=stamp,release,decline,entered,visible=[],closes=0;const held=new Promise(r=>entered=r),probes=[],entries=[];
 const engine=createEngine({load:async()=>[],save:async()=>{},probe:async order=>{probes.push(structuredClone(order));if(probes.length===2){entered();return new Promise((resolve,reject)=>{release=()=>resolve({ok:true,precisionSupported:true,owner});decline=()=>reject(Error('Old tab disappeared'));});}return {ok:true,precisionSupported:true,owner};},execute:async order=>{entries.push(structuredClone(order));return {ok:true,clicked:true,...(order.stopLoss!=null||order.takeProfit!=null?{beforePositionIds:[],bindingSnapshotComplete:true}:{})};},positions:async()=>({ok:true,owner,positions:structuredClone(visible)}),close:async()=>{closes++;return {ok:true,clicked:true};},now:()=>clock});engine.setVenue(venue);
 return {engine,held,release:()=>release(),decline:()=>decline(),probes,entries,closes:()=>closes,visible:v=>visible=v,quote:async price=>{clock+=1100;await engine.quote({market:'BTC',price,bid:price-1,ask:price+1,sourceAt:clock,receivedAt:clock});},settle:async()=>{for(let i=0;i<5;i++)await engine.settled();}};
}
for(const action of ['add','remove'])test(`${action} exits during a held entry preflight uses the submitted revision`,async()=>{
 const f=fixture();await f.quote(83100);const {order}=await f.engine.request({type:'create',order:{...base,...(action==='remove'?{stopLoss:82900}:{})}});await f.quote(83000);await f.held;
 await f.engine.request({type:'editWatch',id:order.id,expectedRevision:0,stopLoss:action==='add'?82900:null,takeProfit:null});f.release();await f.settle();
 assert.equal(f.entries.length,1);assert.equal(f.entries[0].stopLoss,action==='add'?82900:null);assert.equal(f.entries[0].editRevision,1);
 const current=(await f.engine.request({type:'state'})).orders[0];assert.equal(current.status,action==='add'?'awaiting_fill':'submitted');assert.equal(f.probes.length,4,'creation, old entry preflight, edit check, fresh entry preflight');
 if(action==='add'){
  f.visible([{market:'BTC',side:'long',positionId:'42',entryPrice:83000,margin:25,leverage:400}]);await f.quote(83000);await f.settle();assert.equal((await f.engine.request({type:'state'})).orders[0].status,'exits_armed');
  await f.quote(82890);await f.settle();assert.equal(f.closes(),1);assert.equal((await f.engine.request({type:'state'})).orders[0].positionId,'42');
 }
});
test('an obsolete preflight rejection cannot fail a watch edited onto a different tab',async()=>{
 const f=fixture();await f.quote(83100);const {order}=await f.engine.request({type:'create',order:base});await f.quote(83000);await f.held;
 await f.engine.request({type:'editWatch',id:order.id,expectedRevision:0,targetTabId:22,targetTabKey:'destination'});f.decline();await f.settle();
 assert.equal(f.entries.length,1);assert.equal(f.entries[0].targetTabId,22);assert.equal(f.entries[0].targetTabKey,'destination');assert.equal(f.probes.at(-1).targetTabId,22);assert.equal((await f.engine.request({type:'state'})).orders[0].status,'submitted');
});
test('discarding an obsolete preflight preserves an edited watch outside its new entry window',async()=>{
 const f=fixture();await f.quote(83100);const {order}=await f.engine.request({type:'create',order:base});await f.quote(83000);await f.held;
 await f.engine.request({type:'editWatch',id:order.id,expectedRevision:0,price:82000});f.decline();await f.settle();
 assert.equal(f.entries.length,0);assert.equal((await f.engine.request({type:'state'})).orders[0].status,'watching');
 await f.quote(82000);await f.settle();assert.equal(f.entries.length,1);assert.equal(f.entries[0].price,82000);
});
