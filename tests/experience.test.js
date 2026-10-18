import {test} from 'node:test';import assert from 'node:assert/strict';import {decodeBbo,decodeBook,hit} from '../extension/core.js';import {createEngine} from '../extension/engine.js';
test('HL weighted BBO matches Papertrade frontend formula and ignores malformed sizes',()=>{
 const tick=decodeBbo({coin:'BTC',time:Date.now(),bbo:[{px:'83000',sz:'3'},{px:'83002',sz:'1'}]});assert.equal(tick.price,83001.5);assert.equal(tick.mid,83001);
 assert.equal(hit({market:'BTC',side:'short',price:83001.4,priceMode:'papertrade'},tick),true);
 assert.throws(()=>decodeBbo({coin:'BTC',time:Date.now(),bbo:[{px:'83000',sz:'bad'},{px:'83002',sz:'1'}]}));
});
function harness(){let clock=Date.now(),stored=[],visible=[{market:'BTC',side:'short',positionId:'42',margin:20,leverage:531,entryPrice:83000}],available=true,closes=0;
 const engine=createEngine({load:async()=>[],save:async v=>{stored=v;},positions:async()=>available?{ok:true,owner:'0x'+'1'.repeat(40),positions:visible}:{error:'partial positions'},close:async()=>{closes++;return {ok:true,clicked:true};},now:()=>clock});
 const quote=async price=>{clock+=1100;await engine.quote({market:'BTC',bid:price-1,ask:price+1,price,sourceAt:clock,receivedAt:clock});await engine.settled();};
 return {engine,quote,stored:()=>stored,visible:v=>{visible=v;},available:v=>{available=v;},closes:()=>closes};}
test('close remains pending while position exists; two complete absences confirm row closure',async()=>{
 const h=harness();await h.quote(83010);const protectedWatch=await h.engine.request({type:'protectPosition',market:'BTC',positionId:'42',stopLoss:83020,exitLead:2});await h.quote(83018);assert.equal(h.stored()[0].status,'close_submitted');await h.quote(83019);assert.equal(h.stored()[0].status,'close_submitted');
 h.visible([]);await h.quote(83019);assert.equal(h.stored()[0].status,'close_submitted');await h.quote(83019);assert.equal(h.stored()[0].status,'closed');assert.equal(h.closes(),1);assert.ok(h.stored()[0].events.some(e=>e.type==='position_absent'));assert.equal(h.stored()[0].exitFillPrice,undefined);
});
test('unavailable/partial positions reset absence count and cannot confirm close',async()=>{
 const h=harness();await h.quote(83010);await h.engine.request({type:'protectPosition',market:'BTC',positionId:'42',stopLoss:83020});await h.quote(83018);h.visible([]);await h.quote(83019);h.available(false);await h.quote(83019);assert.equal(h.stored()[0].absentCount,0);assert.equal(h.stored()[0].status,'close_submitted');
});
test('edit armed exits retains position binding and does not open another entry',async()=>{
 const h=harness();await h.quote(83010);const created=await h.engine.request({type:'protectPosition',market:'BTC',positionId:'42',stopLoss:83020});await h.engine.request({type:'editWatch',id:created.order.id,stopLoss:83030,takeProfit:82900,exitLead:1});assert.equal(h.stored()[0].positionId,'42');assert.equal(h.stored()[0].stopLoss,83030);assert.equal(h.closes(),0);await h.quote(83029);assert.equal(h.closes(),1);
});
test('entry fill observation records actual native price and target deviation without claiming exit settlement',async()=>{
 let clock=Date.now(),visible=[],stored=[];const venue={schemaVersion:1,tradingPaused:false,receivedAt:clock,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
 const engine=createEngine({load:async()=>[],save:async v=>{stored=v;},probe:async()=>({ok:true,precisionSupported:true,owner:'0x'+'1'.repeat(40)}),execute:async()=>({ok:true,clicked:true,bindingSnapshotComplete:true,beforePositionIds:[]}),positions:async()=>({ok:true,owner:'0x'+'1'.repeat(40),positions:visible}),now:()=>clock});engine.setVenue(venue);
 const quote=async()=>{clock+=1100;await engine.quote({market:'BTC',bid:83000,ask:83002,price:83001,sourceAt:clock,receivedAt:clock});await engine.settled();};await quote();await engine.request({type:'create',order:{market:'BTC',side:'short',price:83000,margin:20,leverage:531}});visible=[{market:'BTC',side:'short',positionId:'fill',entryPrice:83003.5,margin:20,leverage:531}];await quote();assert.equal(stored[0].status,'filled');assert.equal(stored[0].entryDeviation,3.5);assert.equal(stored[0].fillPrice,83003.5);assert.equal(stored[0].exitFillPrice,undefined);
});

test('book snapshot refreshes quote with server time and real top sizes when BBO is unchanged',()=>{
 const stamp=Date.now(),tick=decodeBook({coin:'BTC',time:stamp,levels:[[{px:'83000',sz:'3'}],[{px:'83002',sz:'1'}]]},stamp);
 assert.equal(tick.price,83001.5);assert.equal(tick.sourceAt,stamp);assert.equal(tick.feedSource,'l2Book');
 assert.throws(()=>decodeBook({coin:'BTC',time:stamp,levels:[[],[]]},stamp));assert.throws(()=>decodeBook({coin:'BTC',time:stamp},stamp));
});
