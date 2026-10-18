import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine} from '../extension/engine.js';
const owner='0x'+'1'.repeat(40);
const position={market:'BTC',side:'long',positionId:'42',margin:25,leverage:400,entryPrice:83000};
const base={...position,owner,price:83000,stopLoss:82900,takeProfit:null,exitLead:2,exitPriceMode:'mark',expiresAt:200000};
function fixture(stored){
 let clock=100000,saved=structuredClone(stored),closes=0,entries=0,visible=[];
 const api={load:async()=>structuredClone(saved),save:async v=>{saved=structuredClone(v);},positions:async()=>({ok:true,owner,positions:visible}),close:async()=>{closes++;return {ok:true,clicked:true};},execute:async()=>{entries++;return {ok:true,clicked:true};},now:()=>clock};
 const engine=createEngine(api);
 return {engine,saved:()=>saved,visible:v=>visible=v,closes:()=>closes,entries:()=>entries,advance:ms=>clock+=ms,quote:async price=>{await engine.quote({market:'BTC',price,bid:price-1,ask:price+1,sourceAt:clock,receivedAt:clock});await engine.settled();},pulse:async()=>{clock+=1100;await engine.pulse();await engine.settled();}};
}
test('submitted SL/TP close needs two new absence observations after worker restart with no replay',async()=>{
 const f=fixture([{...base,id:'closing',status:'close_submitted',absentCount:1,closeSubmittedAt:99900,closeCheckAt:99999,closeObservation:'Position absent'}]);
 let {orders}=await f.engine.request({type:'state'});
 assert.equal(orders[0].status,'close_submitted');assert.equal(orders[0].absentCount,0);assert.equal(orders[0].closeCheckAt,null);assert.equal(orders[0].closeObservation,'Awaiting fresh observation');
 await f.pulse();assert.equal(f.saved()[0].status,'close_submitted');assert.equal(f.saved()[0].absentCount,1);
 await f.pulse();assert.equal(f.saved()[0].status,'closed');assert.equal(f.closes(),0);assert.equal(f.entries(),0);
});
test('attaching recovered exits refuses a position with a submitted close',async()=>{
 const f=fixture([{...base,id:'original',status:'close_submitted',closeSubmittedAt:99900},{...base,id:'recovery',positionId:null,status:'attention',beforePositionIds:[]}]);
 f.visible([position]);await f.quote(83000);
 await assert.rejects(f.engine.request({type:'attachExits',id:'recovery',positionId:'42'}),/active.*exit|submitted.*exit/);
 await f.quote(82899);const {orders}=await f.engine.request({type:'state'});assert.equal(orders.find(o=>o.id==='recovery').status,'attention');assert.equal(f.closes(),0);assert.equal(f.entries(),0);
});
test('recovery can arm another available position while the original close remains submitted',async()=>{
 const f=fixture([{...base,id:'original',status:'close_submitted',closeSubmittedAt:99900},{...base,id:'recovery',positionId:null,status:'attention',beforePositionIds:[]}]);
 f.visible([position,{...position,positionId:'43'}]);await f.quote(83000);
 await f.engine.request({type:'attachExits',id:'recovery',positionId:'43'});
 const {orders}=await f.engine.request({type:'state'});assert.equal(orders.find(o=>o.id==='recovery').positionId,'43');assert.equal(orders.find(o=>o.id==='recovery').status,'exits_armed');assert.equal(f.closes(),0);assert.equal(f.entries(),0);
});
test('concurrent recovery requests reserve one exit watch for a position',async()=>{
 const f=fixture([{...base,id:'first',positionId:null,status:'attention',beforePositionIds:[]},{...base,id:'second',positionId:null,status:'attention',beforePositionIds:[]}]);
 f.visible([position]);await f.quote(83000);
 const results=await Promise.allSettled(['first','second'].map(id=>f.engine.request({type:'attachExits',id,positionId:'42'})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 await f.quote(82899);assert.equal(f.closes(),1);assert.equal(f.entries(),0);
});
