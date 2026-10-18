import test from 'node:test';import assert from 'node:assert/strict';
import {nativeClick,legTiming,timingLabel,recentTimings} from '../extension/execution-timing.js';
test('native click timestamp must be inside the request/acknowledgement interval',()=>{
 assert.equal(nativeClick(120,100,200),120);for(const value of [99,201,NaN,null,'120'])assert.equal(nativeClick(value,100,200),null);
});
test('observed durations use native clicks rather than delayed acknowledgements',()=>{
 const leg={entry:'filled',positionId:'1',clickTimeSource:'native',clickedAt:1000,entryAcknowledgedAt:1600,filledAt:2000,closeTimeSource:'native',closeClickedAt:2500,closeAcknowledgedAt:3000,closedObservedAt:4000,closed:true};
 const t=legTiming(leg,5000);assert.equal(t.entryMs,1000);assert.equal(t.closeMs,1500);assert.equal(t.entryWaitMs,null);assert.equal(t.closeWaitMs,null);
 assert.equal(timingLabel(t.closeMs),'1.5s');assert.equal(timingLabel(null),'unavailable');
});
test('interrupted, legacy, negative and unrecorded samples cannot become latency estimates',()=>{
 const leg={clickedAt:1000,filledAt:2000,closeClickedAt:3000,closedObservedAt:4000};assert.equal(legTiming(leg).entryMs,null);assert.equal(legTiming(leg).closeMs,null);
 assert.equal(legTiming({...leg,clickTimeSource:'native',entryObservationInterrupted:true}).entryMs,null);
 assert.equal(legTiming({...leg,closeTimeSource:'native',closeObservationInterrupted:true}).closeMs,null);
 assert.equal(legTiming({...leg,clickTimeSource:'native',filledAt:999}).entryMs,null);
});
test('waiting duration keeps advancing only for unresolved requests and medians use bounded valid samples',()=>{
 assert.equal(legTiming({entry:'submitted',entryRequestedAt:1000},2500).entryWaitMs,1500);
 assert.equal(legTiming({closed:false,close:'uncertain',closeRequestedAt:2000},2500).closeWaitMs,500);
 const pairs=[{legs:[{clickTimeSource:'native',clickedAt:100,filledAt:200},{clickTimeSource:'native',clickedAt:100,filledAt:400},{clickedAt:1,filledAt:10000}]}];
 assert.deepEqual(recentTimings(pairs).entry,{samples:2,medianMs:200});assert.deepEqual(recentTimings(pairs,1).entry,{samples:1,medianMs:100});
});
import {createEngine} from '../extension/engine.js';
test('ordinary entry history stores the native click separately from its later acknowledgement',async()=>{
 let clock=Date.now(),stored=[],expectedClick;const owner='0x'+'1'.repeat(40),row=[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0'];
 const engine=createEngine({load:async()=>[],save:async v=>{stored=v;},now:()=>clock,probe:async()=>({ok:true,precisionSupported:true,owner}),execute:async()=>{expectedClick=clock+10;clock+=100;return {ok:true,clicked:true,clickedAt:expectedClick};}});
 engine.setVenue({schemaVersion:1,tradingPaused:false,receivedAt:clock,instruments:[row],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'});
 await engine.quote({market:'BTC',price:83000,bid:82999,ask:83001,sourceAt:clock,receivedAt:clock});
 await engine.request({type:'create',order:{market:'BTC',side:'long',price:83000,entryTolerance:2,entryMode:'limit',margin:25,leverage:400}});
 assert.equal(stored[0].entryClickedAt,expectedClick);assert.equal(stored[0].submittedAt,expectedClick+90);
});
