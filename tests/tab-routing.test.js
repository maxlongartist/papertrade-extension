import {test,after} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
const venue={schemaVersion:1,tradingPaused:false,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
async function harness({stored={},session={},sessionWrite,pageHook,pageTimeout}={}){
 const timers=new Set();after(()=>{for(const timer of timers)clearTimeout(timer);timers.clear();});
 let handler,socket,accountOwner='0x'+'1'.repeat(40);const sends=[],navigation=[],manualPositions=[],tabs=new Map([[11,{id:11,url:'https://exchange.papertrade.xyz/trade/btc'}],[22,{id:22,url:'https://exchange.papertrade.xyz/trade/btc'}]]);
 const chrome={runtime:{id:'extension',onMessage:{addListener(fn){handler=fn;}}},storage:{local:{get:async()=>structuredClone(stored),set:async v=>{stored={...stored,...structuredClone(v)};}},session:{get:async()=>structuredClone(session),set:async v=>{const value=structuredClone(v);if(sessionWrite)await sessionWrite(value);session={...session,...value};}}},alarms:{create(){},onAlarm:{addListener(){}}},action:{setBadgeText:async()=>{}},tabs:{update:async(id,options)=>{navigation.push({type:'update',id,options});return {id,...options};},create:async options=>{navigation.push({type:'create',options});return {id:33,...options};},query:async()=>[...tabs.values()],get:async id=>{if(!tabs.has(id))throw Error('No tab');return tabs.get(id);},sendMessage:async(id,message)=>{sends.push({id,type:message.type,order:message.order});if(pageHook){const result=await pageHook(id,message);if(result!==undefined)return result;}if(message.type==='pairIdentity')return {ok:true,owner:accountOwner,market:message.order.market};if(message.type==='pairSnapshot')return {ok:true,owner:accountOwner,market:message.order.market,ticket:{ok:true,ready:true,margin:25,leverage:400},available:1000,pending:0,price:83000,positions:structuredClone(manualPositions)};if(message.order.manualPairId && message.type==='execute'){manualPositions.push({market:message.order.market,side:message.order.side,positionId:String(900+sends.length),margin:message.order.margin,leverage:message.order.leverage,entryPrice:83000});return {ok:true,clicked:true};}if(message.order.manualPairId && message.type==='close'){const index=manualPositions.findIndex(p=>p.positionId===message.order.positionId);if(index>=0)manualPositions.splice(index,1);return {ok:true,clicked:true};}if(message.type==='probe')return {ok:true,precisionSupported:true,owner:accountOwner};if(message.type==='positions')return {ok:true,owner:accountOwner,positions:[{market:'BTC',side:'short',positionId:'42',margin:20,leverage:531,entryPrice:83000}]};return {ok:true,clicked:true,beforePositionIds:[]};}}};
 class Socket{constructor(){socket=this;this.readyState=1;}send(){}close(){this.readyState=3;this.onclose?.();}}
 const built=await build({entryPoints:['extension/worker.js'],bundle:true,write:false,format:'iife',platform:'browser'});
 vm.runInNewContext(built.outputFiles[0].text,{chrome,WebSocket:Socket,fetch:async()=>({ok:true,json:async()=>venue}),AbortSignal,crypto:webcrypto,structuredClone,URL,console,setTimeout:(fn,ms)=>{const timer=setTimeout(()=>{timers.delete(timer);fn();},ms);timers.add(timer);if(ms===4500&&pageTimeout)pageTimeout(()=>{if(!timers.has(timer))return;clearTimeout(timer);timers.delete(timer);fn();});if(ms>=60000)timer.unref();return timer;},clearTimeout:timer=>{timers.delete(timer);clearTimeout(timer);},Date});
 const call=(message,id)=>new Promise(resolve=>handler(message,id==null?{id:'extension'}:{id:'extension',url:'https://exchange.papertrade.xyz/trade/btc',tab:{id}},resolve));
 await call({type:'state'});await new Promise(r=>setTimeout(r,0));
 const quote=async price=>{socket.onmessage({data:JSON.stringify({channel:'bbo',data:{coin:'BTC',time:Date.now(),bbo:[{px:String(price-1),sz:'1'},{px:String(price+1),sz:'1'}]}})});await new Promise(r=>setTimeout(r,0));};
 return {dispose:()=>{for(const timer of timers)clearTimeout(timer);timers.clear();},owner:value=>accountOwner=value,call,quote,sends,navigation,tabs,manualPositions,state:()=>stored,session:()=>session};
}
test('two market tabs: entry is bound to its originating tab and caller cannot override it',async()=>{
 const h=await harness();await h.quote(83000);const result=await h.call({type:'create',order:{market:'BTC',side:'short',price:83000,margin:20,leverage:531,targetTabId:22,targetTabKey:'spoof'}},11);
 assert.equal(result.order.status,'submitted');assert.equal(result.order.targetTabId,11);assert.notEqual(result.order.targetTabKey,'spoof');assert.deepEqual(h.sends.filter(s=>s.type==='execute').map(s=>s.id),[11]);assert.ok(h.session().tabBindings[11]);
});
test('existing-position stop uses the tab where protection was armed despite duplicate market tabs',async()=>{
 const h=await harness();await h.quote(83000);const result=await h.call({type:'protectPosition',market:'BTC',positionId:'42',stopLoss:83005,exitLead:2},22);assert.equal(result.order.targetTabId,22);
 await h.quote(83003);await new Promise(r=>setTimeout(r,0));assert.deepEqual(h.sends.filter(s=>s.type==='close').map(s=>s.id),[22]);
});
test('closed or changed bound tab never falls back to another matching tab',async()=>{
 for(const mode of ['closed','changed']){
  const h=await harness();await h.quote(83000);await h.call({type:'protectPosition',market:'BTC',positionId:'42',stopLoss:83005},22);
  if(mode==='closed')h.tabs.delete(22);else h.tabs.set(22,{id:22,url:'https://exchange.papertrade.xyz/trade/eth'});
  await h.quote(83003);await new Promise(r=>setTimeout(r,0));const state=await h.call({type:'state'});assert.equal(state.orders[0].status,'attention');assert.equal(h.sends.filter(s=>s.type==='close').length,0);
 }
});
test('browser session loss invalidates saved tab IDs; worker restart in same session retains binding',async()=>{
 const order={owner:'0x'+'1'.repeat(40),id:'saved',status:'exits_armed',market:'BTC',side:'short',positionId:'42',price:83000,stopLoss:83005,exitLead:2,priceMode:'papertrade',targetTabId:22,targetTabKey:'original-session'};
 for(const retainSession of [false,true]){
  const h=await harness({stored:{limitOrdersV3:[order]},session:retainSession?{tabBindings:{22:'original-session'}}:{}});await h.quote(83003);await new Promise(r=>setTimeout(r,0));const state=await h.call({type:'state'});
  assert.equal(h.sends.filter(s=>s.type==='close').length,retainSession?1:0);assert.equal(state.orders[0].status,retainSession?'close_submitted':'attention');
 }
});

test('manual pair messages bind both entries and exact closes to the originating tab; popup cannot trade',async()=>{
 const h=await harness();const refused=await h.call({type:'pairOpen',market:'BTC'});assert.match(refused.error,/Papertrade page/);
 const opened=await h.call({type:'pairOpen',market:'BTC',targetTabId:22,targetTabKey:'spoof'},11);assert.equal(opened.pair.status,'open');
 assert.deepEqual(h.sends.filter(s=>s.type==='execute').map(s=>s.id),[11,11]);
 const wrong=await h.call({type:'pairClose',market:'BTC',id:opened.pair.id},22);assert.match(wrong.error,/not found/);assert.equal(h.sends.filter(s=>s.type==='close').length,0);
 await h.call({type:'pairClose',market:'BTC',id:opened.pair.id},11);assert.deepEqual(h.sends.filter(s=>s.type==='close').map(s=>s.id),[11,11]);
});
test('manual pairs block competing extension entry watches and cross-tab pair creation',async()=>{
 const h=await harness();await h.call({type:'pairOpen',market:'BTC'},11);
 const other=await h.call({type:'pairOpen',market:'BTC'},22);assert.match(other.error,/tracked pair/);
 const entry=await h.call({type:'create',order:{market:'BTC',side:'long',price:83000,entryTolerance:2,margin:25,leverage:400}},11);assert.match(entry.error,/manual pair/);
 assert.equal(h.sends.filter(s=>s.type==='execute').length,2);
});
test('closed original pair tab can restore tracking in another tab; old binding and popup cannot act',async()=>{
 const h=await harness();const opened=await h.call({type:'pairOpen',market:'BTC'},11);
 const live=await h.call({type:'pairInspect',market:'BTC'},22);assert.equal(live.recovery.canRestore,false);
 h.tabs.delete(11);
 const orphan=await h.call({type:'pairInspect',market:'BTC'},22);assert.equal(orphan.recovery.canRestore,true);
 const noPopup=await h.call({type:'pairRestore',market:'BTC',id:opened.pair.id});assert.match(noPopup.error,/Papertrade page/);
 const restored=await h.call({type:'pairRestore',market:'BTC',id:opened.pair.id,targetTabId:11,targetTabKey:'spoof'},22);
 assert.equal(restored.pair.targetTabId,22);assert.equal(h.sends.filter(s=>['execute','close'].includes(s.type)).length,2,'Restore sends no trade');
 const old=await h.call({type:'pairClose',market:'BTC',id:opened.pair.id},11);assert.match(old.error,/not found/);
 await h.call({type:'pairClose',market:'BTC',id:opened.pair.id},22);assert.deepEqual(h.sends.filter(s=>s.type==='close').map(s=>s.id),[22,22]);
});
test('browser restart permits explicit recovery of saved native IDs without replaying entries',async()=>{
 const first=await harness();const {pair}=await first.call({type:'pairOpen',market:'BTC'},11);
 const next=await harness({stored:{manualPairsV1:[pair]},session:{}});
 const r=await next.call({type:'pairInspect',market:'BTC'},22);assert.equal(r.recovery.canRestore,true);
 await next.call({type:'pairRestore',market:'BTC',id:pair.id},22);
 assert.equal(next.sends.filter(s=>['execute','close'].includes(s.type)).length,0);
 assert.equal(next.state().manualPairsV1[0].targetTabId,22);
});
test('toolbar overview and Manage are navigation-only, use saved targets and reject page callers',async()=>{
 const h=await harness();const {pair}=await h.call({type:'pairOpen',market:'BTC'},11);const before=h.sends.length;
 const summary=await h.call({type:'overview'});assert.equal(summary.items[0].id,pair.id);assert.equal(h.sends.length,before);
 assert.doesNotMatch(JSON.stringify(summary),/targetTab|0x1111/);
 const manage=await h.call({type:'manageItem',kind:'pair',id:pair.id,targetTabId:22,url:'https://evil.example'});
 assert.equal(manage.ok,true);assert.equal(h.navigation[0].id,11);assert.equal(h.sends.length,before);
 const fromSite=await h.call({type:'manageItem',kind:'pair',id:pair.id},22);assert.match(fromSite.error,/toolbar/);
 const missing=await h.call({type:'manageItem',kind:'pair',id:'not-active'});assert.match(missing.error,/no longer active/);
});
test('bundled worker persists captured wallet and does not send an entry after a wallet switch',async()=>{
 const h=await harness();await h.quote(83000);
 const result=await h.call({type:'create',order:{market:'BTC',side:'long',price:80000,entryTolerance:2000,margin:25,leverage:400,owner:'0x'+'2'.repeat(40)}},11);
 assert.equal(result.order.owner,'0x'+'1'.repeat(40));h.owner('0x'+'2'.repeat(40));await h.quote(79000);await new Promise(r=>setTimeout(r,0));
 assert.equal(h.sends.filter(s=>s.type==='execute').length,0);const state=await h.call({type:'state'});assert.match(state.orders[0].message,/Wallet changed/);
});
test('native Status fallback is page-only, expires safely, and never changes pair execution authority',async t=>{
 const h=await harness();t.after(h.dispose);const reading={source:'status-page',level:'HIGH',pending:100,clearSeconds:9,avgTxPerBlock:3.8,sourceAt:Date.now()};
 const refused=await h.call({type:'statusPressure',reading});assert.match(refused.error,/native Papertrade page/);
 await h.call({type:'statusPressure',reading},11);const queue=await h.call({type:'congestion'});assert.equal(queue.level,'HIGH');assert.equal(queue.source,'status-page');assert.equal(h.sends.length,0);
 const opened=await h.call({type:'pairOpen',market:'BTC'},11);assert.equal(opened.pair.status,'open');assert.equal(h.sends.filter(s=>s.type==='execute').length,2,'advisory HIGH never becomes a trading gate');
 await h.call({type:'statusPressure',reading:null},11);const unavailable=await h.call({type:'congestion'});assert.equal(unavailable.live,false);
});
function publicQueue(ts=Date.now(),pending=4){return {queueRevision:'test',snapshot:{schemaVersion:1,source:'relayer-postgres',ok:true,stale:false,ts,blockGasLimit:'3000000',totalSubmittedGas:'3000000',totalQueuedGas:'3000000',totalPendingGas:'6000000',pendingCount:pending,chain:{source:'state-postgres',ok:true,stale:false,latestBlockNumber:1,latestBlockTimestampMs:ts,blocks:[{number:1,timestampMs:ts,transactionCount:4,gasLimit:'3000000',gasUsed:'1000000',papertradeGasUsed:'1000000'}]}}};}
test('native-page public queue relay verifies source, schema and timestamps without trading',async t=>{
 const h=await harness();t.after(h.dispose);const publication=publicQueue(Date.now()-10);
 assert.match((await h.call({type:'pagePressure',publication})).error,/native Papertrade page/);
 assert.equal((await h.call({type:'pagePressure',publication},11)).ok,true);
 let reading=await h.call({type:'congestion'});assert.equal(reading.live,true);assert.equal(reading.transport,'native-page');assert.equal(reading.pending,4);
 assert.ok((await h.call({type:'pagePressure',publication:{bad:true}},11)).error);assert.ok((await h.call({type:'pagePressure',publication:publicQueue(Date.now()-6000)},11)).error);
 await h.call({type:'pagePressure',publication:publicQueue(publication.snapshot.ts-1,99)},22);reading=await h.call({type:'congestion'});assert.equal(reading.pending,4);
 await h.call({type:'pagePressure',publication:null},22);assert.equal((await h.call({type:'congestion'})).live,true);
 await h.call({type:'pagePressure',publication:null},11);assert.equal((await h.call({type:'congestion'})).live,false);assert.equal(h.sends.length,0);
});
test('pair history takes queue context from the worker cache and ignores caller-provided evidence',async t=>{
 const h=await harness();t.after(h.dispose);const publication=publicQueue(Date.now()-100);
 await h.call({type:'pagePressure',publication},11);
 const opened=await h.call({type:'pairOpen',market:'BTC',entryQueue:{pending:999,owner:'secret-spoof'}},11);assert.equal(opened.pair.entryQueue.pending,4);assert.equal(opened.pair.entryQueue.source,'public-stream');assert.doesNotMatch(JSON.stringify(opened.pair.entryQueue),/secret-spoof/);
 const closed=await h.call({type:'pairClose',market:'BTC',id:opened.pair.id,closeQueue:{pending:999}},11);assert.equal(closed.pair.closeQueue.pending,4);assert.equal(h.sends.filter(s=>s.type==='execute').length,2);assert.equal(h.sends.filter(s=>s.type==='close').length,2);
});
test('saved closed history is available in another native tab through read-only wallet identity',async t=>{
 const h=await harness();t.after(h.dispose);const opened=await h.call({type:'pairOpen',market:'BTC'},11);await h.call({type:'pairClose',market:'BTC',id:opened.pair.id},11);await h.call({type:'pairTick',market:'BTC'},11);await h.call({type:'pairTick',market:'BTC'},11);
 const start=h.sends.length;const result=await h.call({type:'pairHistory',market:'BTC',owner:'0x'+'2'.repeat(40)},22);assert.equal(result.history.length,1);assert.equal(result.history[0].status,'closed');assert.equal(result.owner,'0x'+'1'.repeat(40));assert.deepEqual(h.sends.slice(start).map(m=>m.type),['pairIdentity']);
 const refused=await h.call({type:'pairHistory',market:'BTC'});assert.match(refused.error,/Papertrade page/);
});
test('same-tab registration requests wait for the single session write before returning',async t=>{
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let writes=0;
 const h=await harness({sessionWrite:async()=>{writes++;entered();await gate;}});t.after(h.dispose);
 const first=h.call({type:'state'},11);await started;let secondDone=false;const second=h.call({type:'state'},11).then(r=>{secondDone=true;return r;});
 try{await new Promise(r=>setImmediate(r));assert.equal(secondDone,false,'a binding must not escape before persistence');assert.equal(h.sends.length,0);}finally{release();await Promise.all([first,second]);}
 assert.equal(writes,1);assert.ok(h.session().tabBindings[11]);
});
test('failed session persistence cannot leave a usable uncommitted binding on retry',async t=>{
 let fail=true,writes=0;const h=await harness({sessionWrite:async()=>{writes++;if(fail)throw Error('session write failed');}});t.after(h.dispose);
 const failed=await h.call({type:'pairOpen',market:'BTC'},11);assert.match(failed.error,/session write failed/);assert.equal(h.sends.length,0);
 fail=false;const retried=await h.call({type:'pairOpen',market:'BTC'},11);assert.equal(retried.pair.status,'open');assert.equal(writes,2);assert.equal(h.session().tabBindings[11],retried.pair.targetTabKey);assert.equal(h.sends.filter(s=>s.type==='execute').length,2);
});
test('new bindings persist serially while a known tab can close its pair without waiting',async t=>{
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);const values=[];
 const h=await harness({session:{tabBindings:{22:'known-session'}},sessionWrite:async v=>{values.push(v);if(values.length===1){entered();await gate;}}});t.after(h.dispose);
 const opened=await h.call({type:'pairOpen',market:'BTC'},22);assert.equal(opened.pair.status,'open');const first=h.call({type:'state'},11);await started;const next=h.call({type:'state'},33);let closed=false;
 const closing=h.call({type:'pairClose',market:'BTC',id:opened.pair.id},22).then(r=>{closed=true;return r;});
 try{await new Promise(r=>setImmediate(r));assert.equal(values.length,1,'new session writes must not overlap');assert.equal(closed,true,'known-tab Close must not wait for another tab registration');assert.equal(h.sends.filter(s=>s.type==='close').length,2);}finally{release();await Promise.all([first,next,closing]);}
 assert.equal(values.length,2);assert.ok(h.session().tabBindings[11]);assert.ok(h.session().tabBindings[33]);assert.equal(h.session().tabBindings[22],'known-session');
});

const waitingEntry={market:'BTC',side:'long',price:80000,entryMode:'limit',entryTolerance:2,margin:25,leverage:400};
test('pair Open preflight reserves entry mode before an overlapping limit can arm',async t=>{
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let held=false;
 const h=await harness({pageHook:async(_id,m)=>{if(m.type==='pairSnapshot'&&!held){held=true;entered();await gate;}}});t.after(h.dispose);await h.quote(83000);const opening=h.call({type:'pairOpen',market:'BTC'},11);await started;
 try{const entry=await h.call({type:'create',order:waitingEntry},22);assert.match(entry.error,/manual pair.*progress/i);const inspect=await h.call({type:'pairInspect',market:'BTC'},22);assert.match(inspect.error,/manual pair.*progress/i);assert.equal(h.sends.filter(s=>s.type==='execute').length,0);}finally{release();await opening;}
 assert.equal(h.sends.filter(s=>s.type==='execute').length,2);assert.equal((await h.call({type:'state'})).orders.length,0);
});
test('limit arming preflight reserves entry mode before an overlapping pair can Open',async t=>{
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let held=false;
 const h=await harness({pageHook:async(_id,m)=>{if(m.type==='probe'&&!held){held=true;entered();await gate;}}});t.after(h.dispose);await h.quote(83000);const arming=h.call({type:'create',order:waitingEntry},11);await started;
 try{const pair=await h.call({type:'pairOpen',market:'BTC'},22);assert.match(pair.error,/entry operation.*progress/i);const inspect=await h.call({type:'pairInspect',market:'BTC'},22);assert.match(inspect.error,/entry operation.*progress/i);assert.equal(h.sends.filter(s=>s.type==='pairSnapshot').length,0);}finally{release();await arming;}
 assert.equal(h.sends.filter(s=>s.type==='execute').length,0);assert.equal((await h.call({type:'state'})).orders.length,1);
});
test('failed pair preflight releases the entry-mode reservation for explicit limit arming',async t=>{
 let fail=true;const h=await harness({pageHook:async(_id,m)=>{if(fail&&m.type==='pairSnapshot')throw Error('snapshot unavailable');}});t.after(h.dispose);await h.quote(83000);assert.match((await h.call({type:'pairOpen',market:'BTC'},11)).error,/snapshot unavailable/);fail=false;const result=await h.call({type:'create',order:waitingEntry},11);assert.equal(result.order.status,'watching');assert.equal(h.sends.filter(s=>s.type==='execute').length,0);
});
test('failed limit preflight releases the entry-mode reservation for explicit pair Open',async t=>{
 let fail=true;const h=await harness({pageHook:async(_id,m)=>{if(fail&&m.type==='probe')throw Error('ticket unavailable');}});t.after(h.dispose);await h.quote(83000);assert.match((await h.call({type:'create',order:waitingEntry},11)).error,/ticket unavailable/);fail=false;const result=await h.call({type:'pairOpen',market:'BTC'},11);assert.equal(result.pair.status,'open');assert.equal(h.sends.filter(s=>s.type==='execute').length,2);
});
test('entry-mode coordination never blocks Close intent during an in-flight pair entry',async t=>{
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let held=false;
 const h=await harness({pageHook:async(_id,m)=>{if(m.type==='execute'&&m.order.manualPairId&&!held){held=true;entered();await gate;}}});t.after(h.dispose);const opening=h.call({type:'pairOpen',market:'BTC'},11);await started;const current=(await h.call({type:'pairState',market:'BTC'},11)).pair;const closing=h.call({type:'pairClose',market:'BTC',id:current.id},11);await new Promise(r=>setImmediate(r));assert.equal((await h.call({type:'pairState',market:'BTC'},11)).pair.closeRequested,true);release();await Promise.all([opening,closing]);assert.equal(h.sends.filter(s=>s.type==='execute').length,1);assert.equal(h.sends.filter(s=>s.type==='close').length,1);
});
test('entry-mode reservation does not delay an existing-position stop',async t=>{
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let held=false;
 const h=await harness({pageHook:async(_id,m)=>{if(m.type==='pairSnapshot'&&!held){held=true;entered();await gate;}}});t.after(h.dispose);await h.quote(83000);await h.call({type:'protectPosition',market:'BTC',positionId:'42',stopLoss:83005,exitLead:2},22);const opening=h.call({type:'pairOpen',market:'BTC'},11);await started;
 try{await h.quote(83003);await new Promise(r=>setImmediate(r));assert.deepEqual(h.sends.filter(s=>s.type==='close').map(s=>[s.id,s.order.positionId]),[[22,'42']]);assert.equal(h.sends.filter(s=>s.type==='execute').length,0);}finally{release();await opening;}
});

test('worker entry timeout keeps unknown outcome, ignores late acknowledgement and closes one late fill without replay',async t=>{
 let release,entered;const started=new Promise(r=>entered=r),timeouts=[];
 const h=await harness({pageTimeout:fire=>timeouts.push(fire),pageHook:async(_id,m)=>{if(m.type==='execute'&&m.order.manualPairId){entered();return new Promise(r=>release=r);}}});t.after(h.dispose);
 const opening=h.call({type:'pairOpen',market:'BTC'},11);await started;const p=(await h.call({type:'pairState',market:'BTC'},11)).pair;
 const closing=h.call({type:'pairClose',market:'BTC',id:p.id},11);await new Promise(r=>setImmediate(r));timeouts.forEach(fire=>fire());await opening;await closing;
 let pair=(await h.call({type:'pairState',market:'BTC'},11)).pair;assert.equal(pair.legs[0].entry,'uncertain');assert.match(pair.legs[0].error,/entry acknowledgement timed out.*Outcome unknown.*no automatic repeat/);assert.equal(h.sends.filter(m=>m.type==='execute').length,1);assert.equal(h.sends.filter(m=>m.type==='close').length,0);
 release({clicked:true});await new Promise(r=>setImmediate(r));assert.equal((await h.call({type:'pairState',market:'BTC'},11)).pair.legs[0].entry,'uncertain');
 h.manualPositions.push({market:'BTC',side:'long',positionId:'late-1',margin:25,leverage:400,entryPrice:83000});await h.call({type:'pairTick',market:'BTC'},11);await h.call({type:'pairTick',market:'BTC'},11);await h.call({type:'pairTick',market:'BTC'},11);
 pair=(await h.call({type:'pairState',market:'BTC'},11)).pair;assert.equal(pair.status,'closed');assert.deepEqual(h.sends.filter(m=>m.type==='close').map(m=>m.order.positionId),['late-1']);assert.equal(h.sends.filter(m=>m.type==='execute').length,1);
});
test('worker Close timeout stays unconfirmed after late acknowledgement and never sends another Close',async t=>{
 let release,entered;const started=new Promise(r=>entered=r),timeouts=[];
 const h=await harness({pageTimeout:fire=>timeouts.push(fire),pageHook:async(_id,m)=>{if(m.type==='close'&&m.order.side==='long'){entered();return new Promise(r=>release=r);}}});t.after(h.dispose);
 const {pair:p}=await h.call({type:'pairOpen',market:'BTC'},11);const closing=h.call({type:'pairClose',market:'BTC',id:p.id},11);await started;await new Promise(r=>setImmediate(r));timeouts.forEach(fire=>fire());await closing;
 let pair=(await h.call({type:'pairState',market:'BTC'},11)).pair;assert.equal(pair.legs[0].close,'uncertain');assert.match(pair.legs[0].error,/Close acknowledgement timed out.*Outcome unknown.*no automatic repeat/);
 release({clicked:true});await new Promise(r=>setImmediate(r));await h.call({type:'pairTick',market:'BTC'},11);assert.equal((await h.call({type:'pairState',market:'BTC'},11)).pair.legs[0].close,'uncertain');assert.equal(h.sends.filter(m=>m.type==='close').length,2);
 h.manualPositions.splice(0,h.manualPositions.length);await h.call({type:'pairTick',market:'BTC'},11);await h.call({type:'pairTick',market:'BTC'},11);pair=(await h.call({type:'pairState',market:'BTC'},11)).pair;assert.equal(pair.status,'closed');assert.equal(h.sends.filter(m=>m.type==='close').length,2);assert.equal(h.sends.filter(m=>m.type==='execute').length,2);
});

test('unreadable manual tracking blocks new entries without disabling existing position protection',async t=>{
 const damaged=[null],protection={owner:'0x'+'1'.repeat(40),id:'existing-protection',status:'exits_armed',market:'BTC',side:'short',positionId:'42',price:83000,margin:20,leverage:531,stopLoss:83005,exitLead:2,priceMode:'papertrade',targetTabId:22,targetTabKey:'original-session'};
 const h=await harness({stored:{manualPairsV1:damaged,limitOrdersV3:[protection]},session:{tabBindings:{22:'original-session'}}});t.after(h.dispose);
 assert.match((await h.call({type:'pairOpen',market:'BTC'},22)).error,/tracking is unreadable/);assert.match((await h.call({type:'create',order:waitingEntry},22)).error,/tracking is unreadable/);assert.equal(h.sends.filter(m=>m.type==='execute').length,0);
 await h.quote(83003);await new Promise(r=>setImmediate(r));const state=await h.call({type:'state'});assert.equal(state.orders[0].status,'close_submitted');assert.deepEqual(h.sends.filter(m=>m.type==='close').map(m=>m.order.positionId),['42']);assert.deepEqual(h.state().manualPairsV1,damaged);
});
test('a saved null manual-tracking value remains unreadable instead of being replaced with empty history',async t=>{
 const h=await harness({stored:{manualPairsV1:null}});t.after(h.dispose);assert.match((await h.call({type:'pairOpen',market:'BTC'},11)).error,/tracking is unreadable/);assert.equal(h.sends.filter(m=>m.type==='execute').length,0);assert.equal(h.state().manualPairsV1,null);
});
