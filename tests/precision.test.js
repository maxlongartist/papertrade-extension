import {test} from 'node:test';import assert from 'node:assert/strict';import {entryWindow} from '../extension/core.js';import {createEngine} from '../extension/engine.js';
const now=Date.now();const order={owner:'0x'+'1'.repeat(40),entryMode:'near',market:'BTC',side:'short',price:83000,entryTolerance:2,margin:20,leverage:531};
const tick=(bid,stamp=now)=>({market:'BTC',bid,ask:bid+1,sourceAt:stamp,receivedAt:stamp});
const venue={schemaVersion:1,tradingPaused:false,receivedAt:now,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
test('entry window rejects $10-$20 overshoot and quotes older than 500ms for both sides',()=>{
 assert.equal(entryWindow(order,tick(83001),now),true);assert.equal(entryWindow(order,tick(83002),now),false);assert.equal(entryWindow(order,tick(83001.5),now),true);
 assert.equal(entryWindow(order,tick(83015),now),false);assert.equal(entryWindow(order,tick(83000,now-501),now),false);
 const long={...order,side:'long'};assert.equal(entryWindow(long,tick(82999),now),true);assert.equal(entryWindow(long,tick(82980),now),false);
});
test('gap skips entry; later valid window submits once',async()=>{
 let stored=[],clicks=0;const engine=createEngine({load:async()=>[],save:async v=>{stored=v;},probe:async()=>({ok:true,precisionSupported:true,owner:'0x'+'1'.repeat(40)}),execute:async()=>{clicks++;return {ok:true,clicked:true};},now:()=>now});engine.setVenue(venue);
 await engine.quote(tick(82990));await engine.request({type:'create',order});await engine.quote(tick(83015));assert.equal(clicks,0);assert.equal(stored[0].status,'watching');
 await engine.quote(tick(83001));await engine.quote(tick(83001));assert.equal(clicks,1);await engine.settled();assert.equal(stored[0].status,'submitted');
});
test('explicit no-click deferral resumes watching; uncertain failure still never retries',async()=>{
 let stored=[],calls=0;const engine=createEngine({load:async()=>[],save:async v=>{stored=v;},probe:async()=>({ok:true,precisionSupported:true,owner:'0x'+'1'.repeat(40)}),execute:async()=>++calls===1?{ok:true,clicked:false,deferred:true}:{ok:true,clicked:true},now:()=>now});engine.setVenue(venue);
 await engine.quote(tick(83001));await engine.request({type:'create',order});assert.equal(stored[0].status,'watching');await engine.quote(tick(83001));await engine.settled();assert.equal(stored[0].status,'submitted');assert.equal(calls,2);
});
test('old page adapter cannot arm new precision entries before page reload',async()=>{
 let calls=0;const engine=createEngine({load:async()=>[],save:async()=>{},probe:async()=>({ok:true}),execute:async()=>{calls++;},now:()=>now});engine.setVenue(venue);await engine.quote(tick(83001));await assert.rejects(engine.request({type:'create',order}),/Reload Papertrade/);assert.equal(calls,0);
});
