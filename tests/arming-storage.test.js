import test from 'node:test';import assert from 'node:assert/strict';import {createEngine} from '../extension/engine.js';
const stamp=Date.now(),owner='0x'+'1'.repeat(40),ticket={market:'BTC',side:'long',price:84000,entryMode:'limit',entryTolerance:2,margin:25,leverage:400};
const venue={schemaVersion:1,tradingPaused:false,receivedAt:stamp,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
function fixture(initial=[]){
 let stored=structuredClone(initial),fail=false,entries=0,closes=0;
 const options={load:async()=>structuredClone(stored),save:async v=>{if(fail)throw Error('storage full');stored=structuredClone(v);},probe:async()=>({ok:true,precisionSupported:true,owner}),positions:async()=>({ok:true,owner,positions:[{...ticket,positionId:'42',entryPrice:83000}]}),execute:async()=>{entries++;return {ok:true,clicked:true};},close:async()=>{closes++;return {ok:true,clicked:true};},now:()=>stamp};
 const make=()=>{const engine=createEngine(options);engine.setVenue(venue);return engine;};return {engine:make(),restart:make,fail:value=>fail=value,stored:()=>structuredClone(stored),entries:()=>entries,closes:()=>closes};
}
const quote=engine=>engine.quote({market:'BTC',price:82800,bid:82799,ask:82801,sourceAt:stamp,receivedAt:stamp});
for(const operation of ['create','protectPosition','attachExits'])test(`failed ${operation} leaves no newly armed watch or future click and can be retried`,async()=>{
 const original={...ticket,id:'inactive',owner,status:'attention',stopLoss:82900,expiresAt:stamp+60000,beforePositionIds:[]};
 const initial=operation==='attachExits'?[original]:[],f=fixture(initial);await quote(f.engine);await f.engine.settled();
 const request=operation==='create'?{type:operation,order:ticket}:{type:operation,id:'inactive',market:'BTC',positionId:'42',stopLoss:82900};
 f.fail(true);await assert.rejects(f.engine.request(request),/storage full/);assert.deepEqual((await f.engine.request({type:'state'})).orders,initial);assert.deepEqual(f.stored(),initial);
 f.fail(false);await f.engine.pulse();await f.engine.settled();assert.equal(f.entries(),0);assert.equal(f.closes(),0);
 const restarted=f.restart();await quote(restarted);await restarted.settled();assert.deepEqual((await restarted.request({type:'state'})).orders,initial);
 const retry=operation==='create'?{...request,order:{...ticket,price:80000}}:operation==='protectPosition'?{...request,stopLoss:82000}:request;
 await f.engine.request(retry);await f.engine.settled();const orders=(await f.engine.request({type:'state'})).orders;assert.equal(orders.length,1);assert.equal(f.stored().length,1);assert.equal(f.entries(),0);assert.equal(f.closes(),operation==='attachExits'?1:0);assert.equal(orders[0].status,operation==='create'?'watching':operation==='protectPosition'?'exits_armed':'close_submitted');
});
test('failed creation preserves retained history and existing active watches',async()=>{
 const initial=[{...ticket,owner,id:'active',price:80000,status:'watching',expiresAt:stamp+60000},...Array.from({length:201},(_,i)=>({...ticket,owner,id:'done-'+i,status:'cancelled'}))];
 const f=fixture(initial);await quote(f.engine);await f.engine.settled();const before=(await f.engine.request({type:'state'})).orders;f.fail(true);await assert.rejects(f.engine.request({type:'create',order:ticket}),/storage full/);assert.deepEqual((await f.engine.request({type:'state'})).orders,before);assert.equal(f.stored().length,202);assert.equal(f.entries(),0);
});
