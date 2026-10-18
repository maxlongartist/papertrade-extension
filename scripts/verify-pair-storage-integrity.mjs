// Localhost only: unreadable saved tracking stays visible and is never overwritten.
import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'pair-storage-integrity-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1250}});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4320'?route.continue():route.abort());const errors=[];
 for(const mode of ['root','record']){
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:4320/trade/btc?scenario=pair&pairCorruptStorage='+mode);await page.locator('#pairHealth').filter({hasText:'Saved manual pair tracking is unreadable'}).waitFor();await page.waitForTimeout(2200);
  assert.match(await page.locator('#pairHealth').innerText(),/New entries are blocked.*Saved tracking was not changed/);assert.equal(await page.locator('#pairOpen').isDisabled(),true);assert.equal(await page.locator('#pairClose').isDisabled(),true);assert.equal(await page.locator('#pairLong').innerText(),'Tracking unavailable');assert.equal(await page.locator('#pairShort').innerText(),'Tracking unavailable');assert.match(await page.locator('#pairStatus').innerText(),/Pair status unavailable/);assert.match(await page.locator('#fixtureStatus').innerText(),/^0 native submissions/);assert.deepEqual(await page.evaluate(()=>globalThis.fixtureReadPairStorage()),mode==='root'?null:[null]);
  const host=await page.locator('#pairOpen').evaluateHandle(el=>el.getRootNode().host);await host.asElement().screenshot({path:join(out,mode+'-unreadable.png')});await page.close();
 }
 assert.deepEqual(errors,[]);const healthy=await context.newPage();await healthy.goto('http://127.0.0.1:4320/trade/btc?scenario=pair');await healthy.locator('#pairOpen:enabled').waitFor();assert.match(await healthy.locator('#fixtureStatus').innerText(),/^0 native submissions/);
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,malformedRootBlocked:true,malformedRecordBlocked:true,errorSurvivesRedraws:true,savedValuesPreserved:true,noFalseNotOpenedClaims:true,noUnhandledPageErrors:true,healthyStorageStillReady:true,simulatedEntries:0,simulatedCloses:0,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
