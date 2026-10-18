import test from 'node:test';import assert from 'node:assert/strict';
import {startPagePressureRelay} from '../extension/congestion-relay.js';
function fixture({sendFailure=false}={}){
 let active=true,onPublication,tick,reads=0,stops=0,cancels=0;const messages=[];
 const relay=startPagePressureRelay(message=>{messages.push(message);if(sendFailure)throw Error('worker unavailable');},{isActive:()=>active,makeFeed:options=>{onPublication=options.onPublication;return {get:()=>{reads++;},stop:()=>{stops++;}};},schedule:fn=>{tick=fn;return 42;},cancel:id=>{assert.equal(id,42);cancels++;}});
 return {relay,tick:()=>tick(),publish:p=>onPublication(p),active:v=>active=v,messages,reads:()=>reads,stops:()=>stops,cancels:()=>cancels};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('visible native page forwards only publications; hidden pages stop and clear their reading',async()=>{
 const f=fixture();assert.equal(f.reads(),1);const publication={snapshot:{public:true}};f.publish(publication);await flush();assert.deepEqual(f.messages,[{type:'pagePressure',publication}]);
 f.active(false);f.tick();await flush();assert.equal(f.stops(),1);assert.equal(f.messages.at(-1).publication,null);
 const count=f.messages.length;f.publish(publication);f.tick();await flush();assert.equal(f.messages.length,count);assert.equal(f.stops(),1);
 f.active(true);f.tick();assert.equal(f.reads(),2);f.publish(publication);await flush();assert.equal(f.messages.length,count+1);f.relay.dispose();
});
test('disposed relay closes transport and timer once and ignores late publications',async()=>{
 const f=fixture();f.relay.dispose();f.relay.dispose();f.tick();f.publish({late:true});await flush();assert.equal(f.cancels(),1);assert.equal(f.stops(),1);assert.deepEqual(f.messages,[{type:'pagePressure',publication:null}]);assert.equal(f.reads(),1);
});
test('worker message rejection does not break relay polling or cleanup',async()=>{
 const f=fixture({sendFailure:true});f.publish({public:true});await flush();f.tick();assert.equal(f.reads(),2);f.relay.dispose();await flush();assert.equal(f.cancels(),1);
});
