import test from 'node:test';import assert from 'node:assert/strict';
import {createEngine} from '../extension/engine.js';import {readAccount,verifyAccount} from '../extension/account.js';
const owner='0x'+'1'.repeat(40),other='0x'+'2'.repeat(40),stamp=Date.now();
const row=[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0'];
const venue={schemaVersion:1,tradingPaused:false,receivedAt:stamp,instruments:[row],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
const order={market:'BTC',side:'long',price:83000,entryMode:'limit',entryTolerance:2,margin:25,leverage:400};
const tick=(price,at=stamp)=>({market:'BTC',price,bid:price-1,ask:price+1,sourceAt:at,receivedAt:at});
function fixture(stored=[],probeHook){
 let account=owner,clock=stamp,entries=0,closes=0,saved=stored,visible=[];
 const engine=createEngine({load:async()=>stored,save:async v=>{saved=v;},probe:async order=>probeHook?probeHook(order,account):({ok:true,precisionSupported:true,owner:account}),execute:async()=>{entries++;return {ok:true,clicked:true};},positions:async()=>({ok:true,owner:account,positions:visible}),close:async()=>{closes++;return {ok:true,clicked:true};},now:()=>clock});engine.setVenue(venue);
 return {engine,owner:v=>account=v,advance:ms=>clock+=ms,quote:price=>engine.quote(tick(price,clock)),entries:()=>entries,closes:()=>closes,saved:()=>saved,visible:v=>visible=v};
}
test('entry watch binds observed wallet rather than a caller-supplied owner and refuses a later switch',async()=>{
 const f=fixture();await f.quote(83100);const result=await f.engine.request({type:'create',order:{...order,owner:other}});assert.equal(result.order.owner,owner);
 f.owner(other);await f.quote(82999);await f.engine.settled();assert.equal(f.entries(),0);assert.match(f.saved()[0].message,/Wallet changed/);
});
test('legacy watches without wallet identity stop for explicit re-arming instead of trading',async()=>{
 for(const status of ['watching','awaiting_fill','submitted','exits_armed','close_submitted']){
  const f=fixture([{...order,id:'old',status,stopLoss:82900,positionId:'42',expiresAt:stamp+60000}]);await f.quote(82900);await f.engine.settled();
  assert.equal(f.saved()[0].status,'attention');assert.match(f.saved()[0].message,/wallet binding/);assert.equal(f.entries(),0);assert.equal(f.closes(),0);
 }
});
test('existing-position protection binds snapshot wallet and cannot use another wallet to confirm a close',async()=>{
 const f=fixture();f.visible([{market:'BTC',side:'long',positionId:'42',entryPrice:83000,margin:25,leverage:400}]);await f.quote(83000);
 const r=await f.engine.request({type:'protectPosition',market:'BTC',positionId:'42',stopLoss:82900,owner:other});assert.equal(r.order.owner,owner);
 await f.quote(82899);await f.engine.settled();assert.equal(f.closes(),1);
 f.owner(other);f.visible([]);for(let i=0;i<3;i++){f.advance(1001);await f.engine.pulse();await f.engine.settled();}
 assert.equal(f.saved()[0].status,'close_submitted');assert.equal(f.saved()[0].absentCount,0);assert.match(f.saved()[0].message,/Wallet changed/);
 f.owner(owner);for(let i=0;i<2;i++){f.advance(1001);await f.engine.pulse();await f.engine.settled();}
 assert.equal(f.saved()[0].status,'closed');
});
test('account checks reject disconnected, read-only, wrong-market and mismatched-wallet pages',()=>{
 const prior=globalThis.location;let connected=owner;const doc={querySelector:()=>({getAttribute:()=>connected})};
 try{
  globalThis.location={pathname:'/trade/btc',href:'https://exchange.papertrade.xyz/trade/btc'};assert.equal(readAccount(doc,'BTC'),owner);
  assert.throws(()=>verifyAccount(doc,{market:'BTC',owner:other}),/Wallet changed/);assert.throws(()=>verifyAccount(doc,{market:'BTC'}),/wallet binding/);
  connected=null;assert.throws(()=>readAccount(doc,'BTC'),/Connect/);connected=owner;assert.throws(()=>readAccount(doc,'ETH'),/Wrong market/);
  globalThis.location.href+='?view='+other;assert.throws(()=>readAccount(doc,'BTC'),/own wallet/);
 }finally{globalThis.location=prior;}
});
import {exportExecutionHistory} from '../extension/history.js';
test('exported execution evidence omits wallet and browser binding identifiers at every level',()=>{
 const report=exportExecutionHistory([{id:'entry',owner,targetTabId:11,targetTabKey:'private-session',fillPrice:83001,events:[{at:1,type:'created',owner,targetTabKey:'nested-secret'}]}]);
 assert.equal(report[0].fillPrice,83001);assert.equal(report[0].events[0].type,'created');assert.doesNotMatch(JSON.stringify(report),/0x1111|targetTab|private-session|nested-secret/);
});

test('entry edits reject a different wallet without changing the watch or tab binding',async()=>{
 const f=fixture();await f.quote(83100);const {order:created}=await f.engine.request({type:'create',order:{...order,targetTabId:11,targetTabKey:'original'}});
 f.owner(other);
 await assert.rejects(f.engine.request({type:'editWatch',id:created.id,price:82000,owner:other,targetTabId:22,targetTabKey:'other'}),/Wallet changed/);
 const current=(await f.engine.request({type:'state'})).orders[0];assert.deepEqual(current,created);assert.equal(f.entries(),0);
});
test('same-wallet entry edits verify the destination tab and preserve the original owner',async()=>{
 const probes=[],f=fixture([],async(o,account)=>{probes.push(structuredClone(o));return {ok:true,precisionSupported:true,owner:account};});await f.quote(83100);
 const {order:created}=await f.engine.request({type:'create',order:{...order,targetTabId:11,targetTabKey:'original'}});
 const {order:edited}=await f.engine.request({type:'editWatch',id:created.id,price:82000,owner:other,targetTabId:22,targetTabKey:'destination'});
 assert.equal(probes.length,2);assert.equal(probes[1].owner,owner);assert.equal(probes[1].targetTabId,22);assert.equal(probes[1].targetTabKey,'destination');assert.equal(edited.owner,owner);assert.equal(edited.targetTabId,22);assert.equal(edited.price,82000);assert.equal(edited.expiresAt,created.expiresAt);assert.equal(edited.createdAt,created.createdAt);assert.equal(f.entries(),0);
});
test('unavailable or outdated entry edit probes leave the original watch unchanged',async()=>{
 for(const ready of [{ok:false,error:'Adapter unavailable'},{ok:true,owner,precisionSupported:false},{ok:true,precisionSupported:true}]){
  let editing=false;const f=fixture([],async()=>editing?ready:{ok:true,owner,precisionSupported:true});await f.quote(83100);
  const {order:created}=await f.engine.request({type:'create',order});editing=true;
  await assert.rejects(f.engine.request({type:'editWatch',id:created.id,price:82000}),/Adapter unavailable|Reload Papertrade|wallet identity/);
  assert.deepEqual((await f.engine.request({type:'state'})).orders[0],created);assert.equal(f.entries(),0);
 }
});
test('a slow entry edit probe does not block submission or overwrite a submitted watch',async()=>{
 let release,entered;const waiting=new Promise(r=>entered=r);let editing=false;
 const f=fixture([],async(o)=>{if(editing&&o.targetTabId===22){entered();await new Promise(r=>release=r);}return {ok:true,owner,precisionSupported:true};});await f.quote(83100);
 const {order:created}=await f.engine.request({type:'create',order});editing=true;
 const pending=f.engine.request({type:'editWatch',id:created.id,price:82000,targetTabId:22,targetTabKey:'destination'});await waiting;
 await f.quote(83000);await f.engine.settled();assert.equal(f.entries(),1);release();await assert.rejects(pending,/Only watching entries/);
 const current=(await f.engine.request({type:'state'})).orders[0];assert.equal(current.price,created.price);assert.equal(current.targetTabId,created.targetTabId);
});
test('position-list responses include the verified wallet for editor binding',async()=>{
 const f=fixture();f.visible([{market:'BTC',side:'short',positionId:'42',entryPrice:83000,margin:25,leverage:400}]);const listed=await f.engine.request({type:'listPositions',market:'BTC'});assert.equal(listed.owner,owner);f.owner(other);assert.equal((await f.engine.request({type:'listPositions',market:'BTC'})).owner,other);assert.equal(f.entries(),0);assert.equal(f.closes(),0);
});
test('a wallet change after selecting an unprotected position cannot arm exits on another wallet',async()=>{
 const f=fixture();f.visible([{market:'BTC',side:'short',positionId:'42',entryPrice:83000,margin:25,leverage:400}]);await f.quote(83000);const selected=await f.engine.request({type:'listPositions',market:'BTC'});f.owner(other);await assert.rejects(f.engine.request({type:'protectPosition',market:'BTC',positionId:'42',expectedOwner:selected.owner??owner,stopLoss:84000}),/Wallet changed after position selection/);assert.equal((await f.engine.request({type:'state'})).orders.length,0);assert.equal(f.closes(),0);
});
test('explicit selected-wallet checks reject malformed identity and permit the matching wallet',async()=>{
 const f=fixture();f.visible([{market:'BTC',side:'short',positionId:'42',entryPrice:83000,margin:25,leverage:400}]);await f.quote(83000);for(const expectedOwner of ['invalid',{}])await assert.rejects(f.engine.request({type:'protectPosition',market:'BTC',positionId:'42',expectedOwner,stopLoss:84000}),/Wallet changed after position selection/);const result=await f.engine.request({type:'protectPosition',market:'BTC',positionId:'42',expectedOwner:owner,stopLoss:84000});assert.equal(result.order.owner,owner);assert.equal(result.order.status,'exits_armed');assert.equal(f.closes(),0);
});
