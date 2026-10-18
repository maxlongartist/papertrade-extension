// Optional read-only verification against public data in an ephemeral browser profile.
// PLAYWRIGHT_MODULE must point to an installed Playwright module; no runtime dependency.
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const modulePath=process.env.PLAYWRIGHT_MODULE;
if(!modulePath)throw Error('Set PLAYWRIGHT_MODULE to the installed playwright index.mjs path.');
const {chromium}=await import(pathToFileURL(resolve(modulePath)).href);
const extension=resolve('dist'),out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'browser-verification');
await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'papertrade-extension-check-'));
let context;const browserErrors=[];
try{
 context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:380,height:790}});
 context.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text());});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:15000});
 const extensionId=new URL(worker.url()).host;
 const host=context.pages()[0]??await context.newPage();
 const second=await context.newPage();
 await Promise.all([host.goto('https://exchange.papertrade.xyz/trade/btc',{waitUntil:'domcontentloaded',timeout:30000}),second.goto('https://exchange.papertrade.xyz/trade/eth',{waitUntil:'domcontentloaded',timeout:30000})]);
 await Promise.all([host.setViewportSize({width:1280,height:1000}),second.setViewportSize({width:1280,height:1000})]);
 await host.bringToFront();
 const cdp=await context.newCDPSession(host);
 const nativeUiChecks={};
 for(const [market,page] of [['BTC',host],['ETH',second]]){
  const session=market==='BTC'?cdp:await context.newCDPSession(page);let tree,pairNode,entryNode,queueNode;
  for(let i=0;i<30;i++){
   tree=(await session.send('DOM.getDocument',{depth:-1,pierce:true})).root;
   pairNode=findId(tree,'paperpilot-manual-pair');entryNode=findId(tree,'paperpilot-extension');queueNode=findId(tree,'paperpilot-network-queue');
   if(pairNode&&entryNode&&queueNode&&findId(pairNode,'pairOpen')&&findId(entryNode,'form'))break;
   await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(pairNode&&entryNode&&queueNode,market+' native page must contain the injected panels');
  const open=findId(pairNode,'pairOpen');assert.ok(open,market+' manual Open must render');assert.ok((open.attributes??[]).includes('disabled'),market+' signed-out manual Open must remain disabled');
  assert.ok(findId(entryNode,'price')&&findId(entryNode,'sl')&&findId(entryNode,'tp'),market+' entry and optional exits must render');
  nativeUiChecks[market]={manualPairInjected:true,limitsInjected:true,queueInjected:true,signedOutOpenDisabled:true};
  if(market!=='BTC')await session.detach();
 }
 await worker.evaluate(()=>chrome.action.openPopup());
 let target;
 for(let i=0;i<20;i++){
  const {targetInfos}=await cdp.send('Target.getTargets');target=targetInfos.find(t=>t.url===`chrome-extension://${extensionId}/popup.html`);
  if(target)break;await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(target,'actual toolbar popup target must be open');
 const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
 let seq=0;
 const command=(method,params={},sid=sessionId)=>new Promise((resolve,reject)=>{
  const id=++seq;const timer=setTimeout(()=>{cdp.off('Target.receivedMessageFromTarget',listener);reject(Error('Popup CDP command timed out: '+method));},10000);
  const listener=event=>{if(event.sessionId!==sid)return;const message=JSON.parse(event.message);if(message.id!==id)return;clearTimeout(timer);cdp.off('Target.receivedMessageFromTarget',listener);message.error?reject(Error(message.error.message)):resolve(message.result);};
  cdp.on('Target.receivedMessageFromTarget',listener);
  cdp.send('Target.sendMessageToTarget',{sessionId:sid,message:JSON.stringify({id,method,params})}).catch(error=>{clearTimeout(timer);cdp.off('Target.receivedMessageFromTarget',listener);reject(error);});
 });
 const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const read=type=>evaluate(`chrome.runtime.sendMessage({type:${JSON.stringify(type)}})`);
 const workerTarget=(await cdp.send('Target.getTargets')).targetInfos.find(t=>t.type==='service_worker'&&t.url===worker.url());
 const workerSession=(await cdp.send('Target.attachToTarget',{targetId:workerTarget.targetId,flatten:false})).sessionId;
 cdp.on('Target.receivedMessageFromTarget',event=>{if(event.sessionId!==workerSession)return;const m=JSON.parse(event.message);if(['Network.webSocketFrameError','Network.loadingFailed'].includes(m.method))browserErrors.push(m.params);});
 await command('Network.enable',{},workerSession);
 let bindingCheck;
 for(let i=0;i<30;i++){
  bindingCheck=await worker.evaluate(async()=>{const [saved,tabs]=await Promise.all([chrome.storage.session.get('tabBindings'),chrome.tabs.query({})]);const native=tabs.filter(t=>/^https:\/\/exchange\.papertrade\.xyz\/trade\/(btc|eth)(\/|$)/.test(t.url??''));const keys=native.map(t=>saved.tabBindings?.[t.id]);return {nativeTabs:native.length,allPersisted:keys.every(k=>typeof k==='string'&&k.length>0),uniqueKeys:new Set(keys.filter(Boolean)).size};});
  if(bindingCheck.nativeTabs===2&&bindingCheck.allPersisted&&bindingCheck.uniqueKeys===2)break;await new Promise(r=>setTimeout(r,250));
 }
 assert.deepEqual(bindingCheck,{nativeTabs:2,allPersisted:true,uniqueKeys:2});
 const overview=await read('overview');assert.ok(!overview.error,overview.error);assert.equal(overview.items.length,0,'profile must have no active orders or pairs');
 const samples=[],priceSamples=[];
 for(let i=0;i<Number(process.env.BROWSER_SAMPLE_LIMIT??25);i++){
  const sample=await read('congestion');samples.push(sample);
  const prices=await read('state');priceSamples.push({feed:prices.feed,ticks:prices.ticks});
  if(samples.filter(s=>s.live&&s.source==='public-stream'&&s.transport==='native-page').length>=4&&new Set(samples.filter(s=>s.live).map(s=>s.sourceAt)).size>=3&&['BTC','ETH'].every(m=>new Set(priceSamples.map(s=>s.ticks[m]?.sourceAt).filter(Number.isFinite)).size>=3))break;
  await new Promise(r=>setTimeout(r,1000));
 }
 const live=samples.filter(s=>s.live&&s.source==='public-stream'&&s.transport==='native-page');
 await writeFile(join(out,'samples.json'),JSON.stringify(samples,null,2));
 await writeFile(join(out,'price-samples.json'),JSON.stringify(priceSamples,null,2));
 for(const market of ['BTC','ETH'])assert.ok(new Set(priceSamples.map(s=>s.ticks[market]?.sourceAt).filter(Number.isFinite)).size>=3,market+' price timestamps must advance');
 await writeFile(join(out,'network-errors.json'),JSON.stringify(browserErrors,null,2));
 assert.ok(live.length>=4,'expected multiple fresh public stream samples');assert.ok(new Set(live.map(s=>s.sourceAt)).size>=3,'public snapshots must advance');
 // Both isolated signed-out native pages can publish queue data in headless Chrome.
 const secondCdp=await context.newCDPSession(second);
 async function pausePage(session){await session.send('Debugger.enable');const paused=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native page pause timed out')),5000);session.once('Debugger.paused',()=>{clearTimeout(timer);resolve();});});await session.send('Debugger.pause');await paused;}
 await pausePage(cdp);await new Promise(r=>setTimeout(r,6500));
 const onePagePaused=await read('congestion');
 await pausePage(secondCdp);await new Promise(r=>setTimeout(r,6500));
 const interrupted=await read('congestion');await writeFile(join(out,'interrupted.json'),JSON.stringify(interrupted,null,2));assert.equal(interrupted.live,false,'stopped page publications must expire');
 for(const session of [cdp,secondCdp]){await session.send('Debugger.resume');await session.send('Debugger.disable');}
 let recovered;
 for(let i=0;i<15;i++){recovered=await read('congestion');if(recovered.live&&recovered.transport==='native-page')break;await new Promise(r=>setTimeout(r,1000));}
 assert.ok(recovered.live&&recovered.transport==='native-page','native page relay must recover after resuming');
 const state=await read('state');assert.equal(state.orders.length,0);assert.equal(state.feed,'Live');
 for(const market of ['BTC','ETH']){assert.ok(state.ticks[market]);assert.ok(Date.now()-state.ticks[market].sourceAt<=2000,market+' quote must be current');}
 const nativePageQuotes={};
 for(const [market,page] of [['BTC',host],['ETH',second]]){
  const session=market==='BTC'?cdp:secondCdp;
  let rendered='';
  for(let i=0;i<15;i++){
   const tree=(await session.send('DOM.getDocument',{depth:-1,pierce:true})).root,entry=findId(tree,'paperpilot-extension'),liveNode=entry&&findId(entry,'live');
   rendered=(liveNode?.children??[]).filter(n=>n.nodeType===3).map(n=>n.nodeValue).join('');
   if(/Chart \$[\d,]+.*Mark \$[\d,]+/.test(rendered))break;
   await new Promise(r=>setTimeout(r,250));
  }
  assert.match(rendered,/Chart \$[\d,]+.*Mark \$[\d,]+/,market+' injected limit panel must render live prices');nativePageQuotes[market]=rendered;
 }
 const stored=await evaluate('chrome.storage.local.get(null)');assert.equal((stored.manualPairsV1??[]).length,0);assert.equal((stored.limitOrdersV3??[]).length,0);
 // Allow the popup's own one-second poll to render the recovered reading.
 await new Promise(r=>setTimeout(r,1500));
 const dom=await command('DOM.getDocument',{depth:-1,pierce:true});
 function findId(node,id){const attrs=node.attributes??[];if(attrs.some((v,i)=>i%2===0&&v==='id'&&attrs[i+1]===id))return node;for(const child of [...(node.children??[]),...(node.shadowRoots??[])]){const found=findId(child,id);if(found)return found;}}
 const levelNode=findId(dom.root,'queueLevel');const renderedQueueLevel=levelNode?.children?.find(n=>n.nodeType===3)?.nodeValue;
 assert.ok(['LOW','MEDIUM','HIGH'].includes(renderedQueueLevel),'actual popup must render the recovered queue level');
 const manifestVersion=await evaluate('chrome.runtime.getManifest().version');
 const versionNode=findId(dom.root,'queueVersion');const renderedVersion=versionNode?.children?.find(n=>n.nodeType===3)?.nodeValue;
 assert.equal(renderedVersion,'Extension v'+manifestVersion);assert.equal(overview.extensionVersion,manifestVersion);
 const shot=await command('Page.captureScreenshot',{captureBeyondViewport:true});await writeFile(join(out,'popup.png'),Buffer.from(shot.data,'base64'));
 const report={passed:true,version:await evaluate('chrome.runtime.getManifest().version'),browser:context.browser()?.version()??'persistent Chromium',profile:'ephemeral, removed after verification',renderedVersion,workerVersion:overview.extensionVersion,bindingCheck,nativeUiChecks,nativePageQuotes,interruptionMethod:'Debugger pause of both isolated signed-out native pages',onePagePausedStillLive:onePagePaused.live,renderedQueueLevel,publicStreamSamples:live.length,distinctPublicSnapshotTimes:new Set(live.map(s=>s.sourceAt)).size,interrupted,recovered,samples,priceFeed:state.feed,priceTimestampCounts:Object.fromEntries(['BTC','ETH'].map(m=>[m,new Set(priceSamples.map(s=>s.ticks[m]?.sourceAt).filter(Number.isFinite)).size])),activeOrders:state.orders.length,activePairs:(stored.manualPairsV1??[]).length,fundedExecutionVerified:false};
 await writeFile(join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,version:report.version,publicStreamSamples:live.length,distinctPublicSnapshotTimes:report.distinctPublicSnapshotTimes,output:out}));
}finally{await context?.close();await rm(profile,{recursive:true,force:true});}
