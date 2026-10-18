import test from 'node:test';import assert from 'node:assert/strict';import {createEngine} from '../extension/engine.js';
const stamp=Date.now(),owner='0x'+'1'.repeat(40);
const base={id:'watch',owner,market:'BTC',side:'long',price:80000,margin:25,leverage:400,entryTolerance:2,entryMode:'limit',priceMode:'papertrade',status:'watching',expiresAt:stamp+60000};
const venue={schemaVersion:1,tradingPaused:false,receivedAt:stamp,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
function fixture(order){
 let stored=[structuredClone(order)],fail=false,actions=0;
 const options={load:async()=>structuredClone(stored),save:async v=>{if(fail)throw Error('quota exceeded');stored=structuredClone(v);},probe:async()=>({ok:true,precisionSupported:true,owner}),positions:async()=>({ok:true,owner,positions:[{...base,positionId:'42',entryPrice:83000}]}),execute:async()=>{actions++;return {ok:true,clicked:true};},close:async()=>{actions++;return {ok:true,clicked:true};},now:()=>stamp};
 const make=()=>{const engine=createEngine(options);engine.setVenue(venue);return engine;};
 return {engine:make(),restart:make,fail:value=>fail=value,stored:()=>structuredClone(stored),actions:()=>actions};
}
const quote=(engine,price=83100)=>engine.quote({market:'BTC',price,bid:price-1,ask:price+1,sourceAt:stamp,receivedAt:stamp});
for(const operation of ['entry edit','exit edit','cancel entry','cancel exits'])test(`failed ${operation} keeps live and saved settings identical and allows retry`,async()=>{
 const exits=operation==='exit edit'||operation==='cancel exits',initial=exits?{...base,status:'exits_armed',positionId:'42',stopLoss:82000,exitLead:0,exitPriceMode:'mark'}:base;
 const f=fixture(initial);await quote(f.engine);await f.engine.settled();const before=(await f.engine.request({type:'state'})).orders[0];
 const message=operation==='entry edit'?{type:'editWatch',id:base.id,expectedRevision:0,price:84000}:operation==='exit edit'?{type:'editWatch',id:base.id,expectedRevision:0,stopLoss:83200,exitLead:0}:{type:exits?'cancelExits':'cancel',id:base.id};
 f.fail(true);await assert.rejects(f.engine.request(message),/quota exceeded/);
 const after=(await f.engine.request({type:'state'})).orders[0];assert.deepEqual(after,before,'failed storage must not activate an uncommitted edit or cancellation');assert.equal(f.stored()[0].status,initial.status);assert.equal(f.stored()[0].price,initial.price);assert.equal(f.stored()[0].stopLoss,initial.stopLoss);
 await f.engine.pulse();await f.engine.settled();assert.equal(f.actions(),0,'unsaved trigger changes must never execute later');
 f.fail(false);const restored=f.restart();await quote(restored);await restored.settled();const restoredOrder=(await restored.request({type:'state'})).orders[0];assert.equal(restoredOrder.status,initial.status);assert.equal(restoredOrder.price,initial.price);assert.equal(restoredOrder.stopLoss,initial.stopLoss);
 // Retry on the original worker, using safe thresholds, must remain possible.
 const retry={...message,...(operation==='entry edit'?{price:79000}:operation==='exit edit'?{stopLoss:81000}:{})};await f.engine.request(retry);
 const saved=f.stored()[0],live=(await f.engine.request({type:'state'})).orders[0];assert.deepEqual(saved,live);assert.equal(saved.status,operation==='cancel entry'?'cancelled':operation==='cancel exits'?'exits_disabled':initial.status);assert.equal(f.actions(),0);
});

for(const exits of [false,true])test(`failed cancellation preserves the original ${exits?'stop loss':'entry'} trigger`,async()=>{
 const f=fixture(exits?{...base,status:'exits_armed',positionId:'42',stopLoss:82000,exitLead:0,exitPriceMode:'mark'}:base);await quote(f.engine);await f.engine.settled();
 f.fail(true);await assert.rejects(f.engine.request({type:exits?'cancelExits':'cancel',id:base.id}),/Previous settings remain active/);
 f.fail(false);await quote(f.engine,exits?81999:79999);await f.engine.settled();assert.equal(f.actions(),1);
 assert.equal((await f.engine.request({type:'state'})).orders[0].status,exits?'close_submitted':'submitted');
});
