import test from 'node:test';import assert from 'node:assert/strict';
import {manualSnapshot} from '../extension/manual-native.js';
const owner='0x'+'1'.repeat(40);
function fixture({wallet=owner,delayed=false,partial=false,pending=false}={}){
 const go={disabled:false,textContent:'Place Trade',getAttribute:()=> 'open'};
 const row={getAttribute:name=>name==='aria-label'?(pending?'BTC pending trade':'BTC long position 42'):(partial?'2':'1'),querySelector:()=>({textContent:'400× LONG'}),querySelectorAll:()=>Array.from({length:9},(_,i)=>({textContent:i===2?'83,000':i===3?'83,001':i===8?'25.00':'0'}))};
 const panel={textContent:'positions',querySelector:()=>delayed?{}:null,querySelectorAll:()=>[row]};
 return {querySelector:s=>s==='#connectBtn'?{getAttribute:()=>wallet}:s==='#postable.active'?panel:s==='#acct_avail'?{textContent:'$50.00'}:s==='#assetPill .prw.numeric'?{textContent:'$83,000'}:s==='#page-trade #im'?{type:'number',value:'25'}:s==='#page-trade #il'?{type:'number',value:'400'}:go,querySelectorAll:()=>[row]};
}
async function withLocation(fn,href='https://exchange.papertrade.xyz/trade/btc'){const previous=globalThis.location;globalThis.location={href,pathname:new URL(href).pathname};try{return await fn();}finally{globalThis.location=previous;}}
test('manual preflight reads native owner, current ticket, available balance, price and exact positions',()=>withLocation(()=>{
 const s=manualSnapshot(fixture(),'BTC');assert.equal(s.owner,owner);assert.equal(s.ticket.margin,25);assert.equal(s.ticket.leverage,400);assert.equal(s.available,50);assert.equal(s.price,83000);assert.equal(s.positions[0].positionId,'42');
}));
test('manual preflight rejects disconnected, stale, partially rendered or wrong-wallet views',async()=>{
 for(const options of [{wallet:null},{delayed:true},{partial:true}])await withLocation(()=>assert.throws(()=>manualSnapshot(fixture(options),'BTC')));
 await withLocation(()=>assert.throws(()=>manualSnapshot(fixture(),'BTC'),/own wallet/),'https://exchange.papertrade.xyz/trade/btc?view=0x'+'2'.repeat(40));
 await withLocation(()=>assert.throws(()=>manualSnapshot(fixture(),'ETH'),/market/));
});
test('pending entry rows are counted without pretending they are filled positions',()=>withLocation(()=>{
 const s=manualSnapshot(fixture({pending:true}),'BTC');assert.equal(s.pending,1);assert.equal(s.positions.length,0);
}));

import {validateManualTicket} from '../extension/manual-limits.js';
test('manual ticket checks fresh venue constraints before either leg is clicked',()=>{
 const venue={schemaVersion:1,tradingPaused:false,receivedAt:Date.now(),minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'1000000000000000000000',instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']]};
 const snapshot={market:'BTC',ticket:{margin:25,leverage:140}};
 assert.doesNotThrow(()=>validateManualTicket(snapshot,venue));
 for(const bad of [{...venue,tradingPaused:true},{...venue,receivedAt:Date.now()-70000},null])assert.throws(()=>validateManualTicket(snapshot,bad));
 assert.throws(()=>validateManualTicket({...snapshot,ticket:{margin:5,leverage:140}},venue),/Each leg/);
 assert.throws(()=>validateManualTicket({...snapshot,ticket:{margin:25,leverage:1001}},venue),/limit/);
});
