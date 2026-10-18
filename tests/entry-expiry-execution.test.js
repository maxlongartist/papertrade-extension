import test from 'node:test';import assert from 'node:assert/strict';import {createEngine} from '../extension/engine.js';
const stamp=Date.now(),owner='0x'+'1'.repeat(40);
const venue={schemaVersion:1,tradingPaused:false,receivedAt:stamp,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
function fixture({hold,expiresIn=100}={}){
 let clock=stamp,release,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r),entries=[];
 const watch={id:'short-lived',owner,market:'BTC',side:'long',price:83000,priceMode:'papertrade',entryMode:'limit',entryTolerance:2,margin:25,leverage:400,status:'watching',createdAt:stamp-86399900,expiresAt:stamp+expiresIn};
 const engine=createEngine({load:async()=>[structuredClone(watch)],save:async orders=>{if(hold==='save'&&orders[0].status==='submitting'){entered();await gate;}},probe:async()=>{if(hold==='probe'){entered();await gate;}return {ok:true,precisionSupported:true,owner};},execute:async order=>{entries.push(structuredClone(order));return {ok:true,clicked:true};},now:()=>clock});engine.setVenue(venue);
 return {engine,watch,entries,started,release,advance:ms=>clock+=ms,quote:()=>engine.quote({market:'BTC',price:83000,bid:82999,ask:83001,sourceAt:stamp,receivedAt:stamp}),settle:async()=>{for(let i=0;i<3;i++)await engine.settled();}};
}
for(const hold of ['probe','save'])test(`expiry during a pending ${hold} prevents native entry without waiting for another quote`,async()=>{
 const f=fixture({hold}),quoting=f.quote();await f.started;f.advance(100);f.release();await quoting;await f.settle();assert.equal(f.entries.length,0);const current=(await f.engine.request({type:'state'})).orders[0];assert.equal(current.status,'expired');assert.match(current.message,/Nothing submitted/);await f.engine.pulse();await f.settle();assert.equal(f.entries.length,0);
});
test('native dispatch deadline cannot extend past the saved entry expiry',async()=>{const f=fixture();await f.quote();await f.settle();assert.equal(f.entries.length,1);assert.ok(f.entries[0].deadline<f.watch.expiresAt);assert.equal(f.entries[0].expiresAt,f.watch.expiresAt);});
test('entry expiry never lengthens the existing native dispatch time allowance',async()=>{const f=fixture({expiresIn:10000});await f.quote();await f.settle();assert.equal(f.entries.length,1);assert.equal(f.entries[0].deadline,stamp+750);});
