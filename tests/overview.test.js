import test from 'node:test';import assert from 'node:assert/strict';
import {overview,manageRecord} from '../extension/overview.js';
const record={id:'one',owner:'private-wallet',targetTabId:11,targetTabKey:'private-session',market:'BTC',status:'open',observedAt:10000,legs:[{side:'long',positionId:'1'},{side:'short',positionId:'2'}]};
const state=()=>({pairs:[record],orders:[],ticks:{BTC:{sourceAt:9900,receivedAt:9950}},feed:'Live',tabs:[{id:11,url:'https://exchange.papertrade.xyz/trade/btc'}],bindings:{11:'private-session'},now:10000});
test('overview includes active pairs and watches without private wallet/browser binding data',()=>{
 const s=state();s.orders=[{...record,id:'watch',status:'exits_armed',side:'long',positionId:'3'},{...record,id:'closed',status:'closed'}];
 const result=overview(s);assert.equal(result.items.length,2);assert.equal(result.items[0].warning,null);assert.deepEqual(result.items[0].positionIds,['1','2']);assert.equal(result.items[1].title,'SL / TP');
 assert.equal(result.quotes[0].ageMs,100);assert.doesNotMatch(JSON.stringify(result),/private-|targetTab|owner/);
});
test('overview flags closed/changed tabs, expired sessions, missing observations and uncertain requests',()=>{
 for(const change of [s=>s.tabs=[],s=>s.bindings={},s=>s.tabs[0].url='https://example.com',s=>s.pairs=[{...record,observedAt:1}],s=>s.pairs=[{...record,observedAt:20000}],s=>s.pairs=[{...record,legs:[{entry:'uncertain'}]}]]){
  const s=state();change(s);assert.ok(overview(s).items[0].warning);
 }
 const s=state();s.orders=[{...record,status:'watching',side:'short'}];s.ticks={};assert.match(overview(s).items[1].warning,/Quote unavailable/);
});
function navigation({missing=false,session='private-session',url='https://exchange.papertrade.xyz/trade/btc'}={}){
 const calls=[];const tabs={get:async()=>{if(missing)throw Error('No tab');return {id:11,url};},update:async(id,options)=>{calls.push(['update',id,options]);return {windowId:4};},create:async options=>calls.push(['create',options])};const windows={update:async(id,options)=>calls.push(['focus',id,options])};return {calls,tabs,windows,bindings:{11:session}};
}
test('Manage focuses original market tab without reloading its query or hash',async()=>{
 const n=navigation({url:'https://exchange.papertrade.xyz/trade/btc?view=wallet#positions'});await manageRecord(record,n);
 assert.deepEqual(n.calls,[['update',11,{active:true}],['focus',4,{focused:true}]]);
});
test('Manage returns a changed bound page to saved market; closed or expired bindings open a new market tab',async()=>{
 const n=navigation({url:'https://exchange.papertrade.xyz/trade/eth'});await manageRecord(record,n);assert.equal(n.calls[0][2].url,'https://exchange.papertrade.xyz/trade/btc');
 for(const options of [{missing:true},{session:'new-session'}]){const n=navigation(options);const r=await manageRecord(record,n);assert.equal(r.opened,true);assert.deepEqual(n.calls,[['create',{url:'https://exchange.papertrade.xyz/trade/btc',active:true}]]);}
});
test('invalid saved markets cannot navigate to caller-controlled destinations',async()=>{
 const n=navigation();await assert.rejects(manageRecord({...record,market:'https://example.com'},n));assert.equal(n.calls.length,0);
});
