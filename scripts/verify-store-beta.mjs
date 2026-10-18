// Actual extension, temporary profile and fake native page. All exchange execution is intercepted.
import {html} from './fixtures/native-page.js';import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'store-beta-verification');await mkdir(out,{recursive:true});await rm(join(out,'verification.json'),{force:true});const profile=await mkdtemp(join(tmpdir(),'papertrade-store-beta-'));let context;
const venue={schemaVersion:1,tradingPaused:false,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1000000000000000000000000','1','1','1','0','0','0','0']],minimumTradeSizeRaw:'10000000000000000000',minimumOpenNotionalRaw:'10000000000000000000000'};
function find(node,id){const attrs=node?.attributes??[];if(attrs.some((v,i)=>i%2===0&&v==='id'&&attrs[i+1]===id))return node;for(const child of [...(node?.children??[]),...(node?.shadowRoots??[])]){const result=find(child,id);if(result)return result;}}
try{
 async function launchProfile(){
 context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:[`--disable-extensions-except=${resolve('dist')}`,'--enable-unsafe-extension-debugging'],viewport:{width:1280,height:800}});
 await context.route('**/*',route=>{const url=route.request().url();if(url==='https://exchange.papertrade.xyz/trade/btc')return route.fulfill({contentType:'text/html',body:html});if(url==='https://exchange.papertrade.xyz/state/trading')return route.fulfill({json:venue});if(url.startsWith('chrome-extension://'))return route.continue();return route.abort();});
 return context.browser().newBrowserCDPSession();
 }
 let install=await launchProfile();const {id}=await install.send('Extensions.loadUnpacked',{path:resolve('dist')}),origin='chrome-extension://'+id;
 let control=await context.newPage();await control.goto(origin+'/popup.html');let page=context.pages()[0];await page.goto('https://exchange.papertrade.xyz/trade/btc');await page.bringToFront();await page.locator('#paperpilot-setup').waitFor();assert.equal(await page.locator('#paperpilot-manual-pair').count(),0);assert.equal(await page.locator('#paperpilot-extension').count(),0);
 const tabId=await control.evaluate(async()=>((await chrome.tabs.query({url:'https://exchange.papertrade.xyz/trade/btc'}))[0]).id);
 const native=(type,order={})=>control.evaluate(({tabId,type,order})=>chrome.tabs.sendMessage(tabId,{type,order}),{tabId,type,order:{owner:'0x'+'1'.repeat(40),market:'BTC',side:'long',margin:25,leverage:300,deadline:Date.now()+3000,...order}});
 assert.match((await native('execute')).error,/first-run/);assert.equal(await page.evaluate(()=>globalThis.fakeEntries),0);assert.equal(await page.locator('#im').inputValue(),'1');
 assert.equal((await native('close',{side:'short',positionId:'123'})).clicked,true);assert.equal(await page.evaluate(()=>globalThis.fakeCloses),1);
 const session=await context.newCDPSession(page),tree=() => session.send('DOM.getDocument',{depth:-1,pierce:true}),click=async id=>{const node=find((await tree()).root,id);assert.ok(node,id);const {object}=await session.send('DOM.resolveNode',{backendNodeId:node.backendNodeId});await session.send('Runtime.callFunctionOn',{objectId:object.objectId,functionDeclaration:'function(){this.click();}'});};
 const before=find((await tree()).root,'setupContinue');assert.ok(before.attributes.includes('disabled'));await page.screenshot({path:join(out,'first-run-1280x800.png')});
 await click('setupConsent');await click('setupContinue');await page.locator('#paperpilot-manual-pair').waitFor();assert.equal(await page.locator('#paperpilot-setup').count(),0);assert.equal((await control.evaluate(()=>chrome.storage.local.get('setupAcknowledgementV1'))).setupAcknowledgementV1.version,1);
 assert.equal((await native('execute')).clicked,true);assert.equal(await page.evaluate(()=>globalThis.fakeEntries),1);
 const terminal={id:'migration-fixture',market:'BTC',side:'long',owner:'0x'+'1'.repeat(40),status:'cancelled',price:1,margin:25,leverage:300};
 await control.evaluate(record=>chrome.storage.local.set({limitOrdersV3:[record]}),terminal);
 async function restart(){
  await context.close();install=await launchProfile();const restored=await install.send('Extensions.loadUnpacked',{path:resolve('dist')});assert.equal(restored.id,id);
  control=await context.newPage();await control.goto(origin+'/popup.html');page=context.pages().find(p=>p!==control)??await context.newPage();await page.goto('https://exchange.papertrade.xyz/trade/btc');await page.locator('#paperpilot-manual-pair').waitFor();
 }

 await restart();
 let raw;for(let i=0;i<50;i++){raw=await control.evaluate(()=>chrome.storage.local.get(['limitOrdersV3','manualPairsV1']));if(raw.limitOrdersV3?.__papertradeEncrypted===1)break;await page.waitForTimeout(100);}
 assert.equal(raw.limitOrdersV3.__papertradeEncrypted,1);assert.doesNotMatch(JSON.stringify(raw),/1111111111|positionId|"margin"/);const cipher=raw.limitOrdersV3.ciphertext;
 await restart();await page.reload();await page.locator('#paperpilot-manual-pair').waitFor();
 const readSession=await context.newCDPSession(page),worlds=[];readSession.on('Runtime.executionContextCreated',event=>worlds.push(event.context));await readSession.send('Runtime.enable');let state;
 for(const world of worlds){try{const result=await readSession.send('Runtime.evaluate',{expression:'globalThis.chrome?.runtime?.id??null',contextId:world.id,returnByValue:true});if(result.result.value!==id)continue;const response=await readSession.send('Runtime.evaluate',{expression:"chrome.runtime.sendMessage({type:'state'})",contextId:world.id,returnByValue:true,awaitPromise:true});state=response.result.value;break;}catch{}}
 assert.ok(state?.orders?.some(o=>o.id==='migration-fixture'),'encrypted records must decrypt after browser restart');assert.equal((await control.evaluate(()=>chrome.storage.local.get('limitOrdersV3'))).limitOrdersV3.ciphertext,cipher);
 await page.reload();await page.locator('#paperpilot-manual-pair').waitFor();assert.equal(await page.locator('#paperpilot-setup').count(),0);assert.equal(await page.evaluate(()=>globalThis.fakeEntries),0,'page reload must not replay a saved entry');await page.screenshot({path:join(out,'controls-1280x800.png')});
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,firstRunBlocksEntryAndTicketPreparation:true,existingExactCloseAvailableBeforeAgreement:true,checkboxRequired:true,explicitAgreementPersists:true,encryptedLocalRecords:true,actualIndexedDBKeyReusedAfterBrowserRestart:true,reloadRetainsAcknowledgement:true,noEntryReplay:true,simulatedEntries:1,simulatedCloses:1,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,output:out}));
}finally{await context?.close();await rm(profile,{recursive:true,force:true});}
