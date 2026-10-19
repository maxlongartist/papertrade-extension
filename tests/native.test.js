globalThis.location={pathname:'/trade/btc',href:'https://exchange.papertrade.xyz/trade/btc'};
import {test} from 'node:test';import assert from 'node:assert/strict';import {executeNative,probeNative} from '../extension/native.js';
function fixture({action='open',disabled=false,revert=false,delayDeadline=false,nativePrice=83000,throwAfterClick=false}={}){
 let clicks=0,side='long';
 class Input{constructor(value){this.type='number';this._value=String(value);}get value(){return this._value;}set value(value){this._value=String(value);}dispatchEvent(){if(revert)this._value='1';}}
 const margin=new Input(1),lev=new Input(10);
 const go={disabled,textContent:action==='open'?'Open Long':'Connect wallet',getAttribute:()=>action,click(){clicks++;if(throwAfterClick)throw Error('handler failed after dispatch');}};
 const directions=['long','short'].map(value=>({textContent:value==='long'?'⬈ Long':'⬊ Short',getAttribute:()=>String(side===value),click(){side=value;}}));
 const document={querySelector:selector=>selector==='#connectBtn'?{getAttribute:()=> '0x'+'1'.repeat(40)}:selector.endsWith('#im')?margin:selector.endsWith('#il')?lev:go,querySelectorAll:selector=>selector==='#assetPill .prw.numeric'?[{get textContent(){return '$'+nativePrice;}}]:directions};
 return {document,Input,clicks:()=>clicks,side:()=>side,price:value=>{nativePrice=value;}};
}
const order={owner:'0x'+'1'.repeat(40),market:'BTC',side:'short',margin:25,leverage:400};
async function run(f,extra={},guard={}){const prior={location:globalThis.location,HTMLInputElement:globalThis.HTMLInputElement};globalThis.location={pathname:'/trade/btc',href:'https://exchange.papertrade.xyz/trade/btc'};globalThis.HTMLInputElement=f.Input;try{return await executeNative(f.document,{...order,deadline:Date.now()+2000,...extra},guard);}finally{globalThis.location=prior.location;globalThis.HTMLInputElement=prior.HTMLInputElement;}}
test('native adapter sets and verifies ticket, then clicks submit exactly once',async()=>{const f=fixture();const result=await run(f);assert.equal(result.clicked,true);assert.ok(Number.isFinite(result.clickedAt));assert.equal(f.clicks(),1);assert.equal(f.side(),'short');});
test('connect wallet, disabled submit, reverted inputs, wrong market and expired action never click',async()=>{for(const options of [{action:'connect'},{disabled:true},{revert:true}]){const f=fixture(options);await assert.rejects(run(f));assert.equal(f.clicks(),0);}for(const extra of [{market:'ETH'},{deadline:Date.now()-1}]){const f=fixture();await assert.rejects(run(f,extra));assert.equal(f.clicks(),0);}});
test('deadline checked after native preparation prevents a late click',async()=>{const f=fixture();await assert.rejects(run(f,{deadline:Date.now()+20}),/timed out/);assert.equal(f.clicks(),0);});
import {closeNative,assertFullPositions} from '../extension/native.js';
test('native close targets exact bound position and refuses wrong, pending or expired controls',async()=>{
 for(const mode of ['correct','wrong','pending','expired']){
  let clicks=0;const button={disabled:mode==='pending',textContent:'Close',getAttribute:()=> 'Close BTC position 123',click(){clicks++;}};
  const row={getAttribute:()=>mode==='wrong'?'BTC long position 999':'BTC long position 123',querySelector:()=>button};
  const document={querySelectorAll:()=>[row],querySelector:s=>s==='#connectBtn'?{getAttribute:()=> '0x'+'1'.repeat(40)}:({textContent:"$83,000"})};const input={owner:'0x'+'1'.repeat(40),market:'BTC',side:'long',positionId:'123',exitReason:'stop loss',triggeredExitAt:Date.now()-15,triggerQuoteSourceAt:Date.now()-50,deadline:mode==='expired'?Date.now()-1:Date.now()+2000};
  if(mode==='correct'){const result=await closeNative(document,input);assert.equal(clicks,1);assert.equal(result.executionCheck.nativePrice,83000);assert.ok(result.executionCheck.triggerToClickMs>=15);assert.ok(result.executionCheck.sourceToClickMs>=50);}else{await assert.rejects(closeNative(document,input));assert.equal(clicks,0);}
 }
});
test('brackets refuse hidden, delayed, pending and partially rendered position lists',()=>{
 assert.throws(()=>assertFullPositions({querySelector:()=>null}),/Positions/);
 for(const mode of ['delayed','pending','partial']){
  const row={getAttribute:name=>name==='aria-label'?(mode==='pending'?'BTC pending trade':'BTC long position 123'):(mode==='partial'?'3':'1')};
  const panel={textContent:'positions',querySelector:()=>mode==='delayed'?{}:null,querySelectorAll:()=>[row]};
  assert.throws(()=>assertFullPositions({querySelector:()=>panel}));
 }
});
test('pending entry rows may be observed while waiting for fill without claiming protection',()=>{const row={getAttribute:name=>name==='aria-label'?'BTC pending trade':'1'};const panel={textContent:'positions',querySelector:()=>null,querySelectorAll:()=>[row]};assert.doesNotThrow(()=>assertFullPositions({querySelector:()=>panel},{allowPending:true}));});

test('precision adapter checks native price, quote age and movement during preparation before click',async()=>{
 for(const mode of ['near','far','stale','moves']) {
  const f=fixture({nativePrice:mode==='far'?83015:83000});
  if(mode==='moves')setTimeout(()=>f.price(83015),20);
  const stamp=Date.now()-(mode==='stale'?700:0);
  const result=await run(f,{price:83000,entryTolerance:2,referenceQuote:{market:'BTC',bid:83000,ask:83001,sourceAt:stamp,receivedAt:stamp}});
  if(mode==='near'){assert.equal(f.clicks(),1);assert.equal(result.executionCheck.nativePrice,83000);}
  else {assert.equal(f.clicks(),0);assert.equal(result.deferred,true);assert.equal(result.clicked,false);}
 }
});
test('TP pre-click guard rejects a reversal outside the early allowance for both directions',async()=>{
 for(const [side,price,allowed] of [['long',97,false],['long',98,true],['short',103,false],['short',102,true]]){
  let clicks=0;const id='42';const button={disabled:false,textContent:'Close',getAttribute:()=>`Close BTC position ${id}`,click(){clicks++;}};const row={getAttribute:()=>`BTC ${side} position ${id}`,querySelector:()=>button};const document={querySelectorAll:()=>[row],querySelector:s=>s==='#connectBtn'?{getAttribute:()=> '0x'+'1'.repeat(40)}:({textContent:String(price)})};
  const result=await closeNative(document,{owner:'0x'+'1'.repeat(40),market:'BTC',side,positionId:id,exitReason:'take profit',takeProfit:100,exitLead:2,deadline:Date.now()+750});assert.equal(clicks,allowed?1:0);assert.equal(result.clicked,allowed);if(!allowed){assert.equal(result.deferred,true);assert.equal(result.executionCheck.clickedAt,undefined);assert.equal(result.executionCheck.triggerToClickMs,undefined);}
 }
});

test('limit mode accepts a favorable native price but refuses adverse native slippage',async()=>{
 for(const [side,price,allowed] of [['long',82980,true],['short',83020,true],['long',83003,false],['short',82997,false]]){
  const f=fixture({nativePrice:price}),stamp=Date.now(),mid=allowed?price:83000;
  const result=await run(f,{side,price:83000,entryTolerance:2,entryMode:'limit',priceMode:'papertrade',referenceQuote:{market:'BTC',price:mid,mid,bid:mid-1,ask:mid+1,sourceAt:stamp,receivedAt:stamp}});
  assert.equal(f.clicks(),allowed?1:0);assert.equal(result.clicked,allowed);
 }
});

test('manual pair checks the connected wallet again immediately before a native entry click',async()=>{
 const f=fixture(),prior={location:globalThis.location,HTMLInputElement:globalThis.HTMLInputElement};const query=f.document.querySelector;
 let owner='0x'+'1'.repeat(40);
 f.document.querySelector=selector=>selector==='#connectBtn'?{getAttribute:()=>owner}:query(selector);
 globalThis.location={pathname:'/trade/btc',href:'https://exchange.papertrade.xyz/trade/btc'};globalThis.HTMLInputElement=f.Input;
 try{
  setTimeout(()=>{owner='0x'+'2'.repeat(40);},20);
  await assert.rejects(executeNative(f.document,{...order,owner:'0x'+'1'.repeat(40),manualPairId:'pair',deadline:Date.now()+2000}),/Wallet changed/);
  assert.equal(f.clicks(),0);
 }finally{globalThis.location=prior.location;globalThis.HTMLInputElement=prior.HTMLInputElement;}
});
test('ordinary limit entry checks wallet again after preparing the ticket',async()=>{
 const f=fixture(),query=f.document.querySelector;let owner='0x'+'1'.repeat(40);
 f.document.querySelector=s=>s==='#connectBtn'?{getAttribute:()=>owner}:query(s);
 setTimeout(()=>{owner='0x'+'2'.repeat(40);},20);
 await assert.rejects(run(f),/Wallet changed/);assert.equal(f.clicks(),0);
});
test('ordinary position Close refuses a switched wallet before clicking its exact native button',async()=>{
 let clicks=0;const button={disabled:false,textContent:'Close',getAttribute:()=> 'Close BTC position 42',click(){clicks++;}};
 const row={getAttribute:()=> 'BTC long position 42',querySelector:()=>button};
 const document={querySelectorAll:()=>[row],querySelector:s=>s==='#connectBtn'?{getAttribute:()=> '0x'+'2'.repeat(40)}:({textContent:'83000'})};
 await assert.rejects(closeNative(document,{market:'BTC',side:'long',owner:'0x'+'1'.repeat(40),positionId:'42',exitReason:'stop loss',deadline:Date.now()+750}),/Wallet changed/);assert.equal(clicks,0);
});
test('entry click exception reports unknown outcome instead of a definite no-click',async()=>{
 const f=fixture({throwAfterClick:true});const result=await run(f);
 assert.equal(f.clicks(),1);assert.equal(result.ok,false);assert.equal(result.clicked,null);assert.ok(Number.isFinite(result.clickAttemptedAt));assert.equal(result.clickedAt,undefined);assert.match(result.error,/uncertain/i);
});
test('Close click exception reports unknown outcome without a confirmed click timestamp',async()=>{
 let clicks=0;const button={disabled:false,textContent:'Close',getAttribute:()=> 'Close BTC position 42',click(){clicks++;throw Error('handler failed after dispatch');}};
 const row={getAttribute:()=> 'BTC long position 42',querySelector:()=>button};const document={querySelectorAll:()=>[row],querySelector:s=>s==='#connectBtn'?{getAttribute:()=>order.owner}:({textContent:'83000'})};
 const result=await closeNative(document,{...order,side:'long',positionId:'42',exitReason:'manual pair',deadline:Date.now()+2000});
 assert.equal(clicks,1);assert.equal(result.clicked,null);assert.equal(result.ok,false);assert.ok(Number.isFinite(result.clickAttemptedAt));assert.equal(result.executionCheck.clickedAt,undefined);assert.match(result.error,/uncertain/i);
});
test('Close rechecks deadline after final wallet verification',async t=>{
 t.mock.timers.enable({apis:['Date'],now:100000});let clicks=0;
 const button={disabled:false,textContent:'Close',getAttribute:()=> 'Close BTC position 42',click(){clicks++;}};
 const row={getAttribute:()=> 'BTC long position 42',querySelector:()=>button};const document={querySelectorAll:()=>[row],querySelector:s=>s==='#connectBtn'?{getAttribute:()=>{t.mock.timers.setTime(100006);return order.owner;}}:({textContent:'83000'})};
 await assert.rejects(closeNative(document,{...order,side:'long',positionId:'42',exitReason:'manual pair',deadline:100005}),/deadline expired before click/);assert.equal(clicks,0);
});

test('a blocked page instance cannot prepare or click the native entry ticket',async()=>{
 const f=fixture();await assert.rejects(run(f,{}, {assertEntry:()=>{throw Error('Duplicate extension entry blocked');}}),/Duplicate/);assert.equal(f.clicks(),0);assert.equal(f.side(),'long');
});
test('page instance is rechecked after native preparation and before its only click',async()=>{
 const f=fixture();let checks=0;await assert.rejects(run(f,{}, {assertEntry:()=>{if(++checks===2)throw Error('Duplicate appeared during preparation');}}),/Duplicate appeared/);assert.equal(checks,2);assert.equal(f.clicks(),0);
});

import {updateNativeTicket} from '../extension/native.js';
test('compact sizing updates native fields without clicking trade or direction controls',async()=>{
 const f=fixture(),prior=globalThis.HTMLInputElement;globalThis.HTMLInputElement=f.Input;
 try{const result=await updateNativeTicket(f.document,{margin:40,leverage:300});assert.equal(result.margin,40);assert.equal(result.leverage,300);assert.equal(f.clicks(),0);assert.equal(f.side(),'long');await assert.rejects(updateNativeTicket(f.document,{margin:0,leverage:300}));await assert.rejects(updateNativeTicket(f.document,{margin:40,leverage:1.5}));const reverted=fixture({revert:true});await assert.rejects(updateNativeTicket(reverted.document,{margin:40,leverage:300}),/did not retain/);assert.equal(reverted.clicks(),0);}finally{globalThis.HTMLInputElement=prior;}
});
