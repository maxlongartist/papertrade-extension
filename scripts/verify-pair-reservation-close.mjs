// Localhost only: Close interrupts a held pre-click reservation for either leg.
import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'pair-reservation-close-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1250}});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4320'?route.continue():route.abort());
 for(const side of ['long','short']){
  const page=await context.newPage();await page.goto('http://127.0.0.1:4320/trade/btc?scenario=pair&pairStorageFailure=1');await page.locator('#pairOpen:enabled').waitFor();await page.evaluate(side=>{globalThis.fixtureHoldPairReservationSide=side;},side);await page.locator('#pairOpen').click();await page.waitForFunction(()=>globalThis.fixturePairReservationHeld===true);await page.locator('#pairClose:enabled').waitFor();
  assert.match(await page.locator('#fixtureStatus').innerText(),side==='long'?/^0 native submissions/:/^1 simulated entries · 0 simulated closes/);await page.locator('#pairClose').click();await page.locator('#pairClose:disabled').waitFor();await page.waitForTimeout(100);await page.evaluate(()=>globalThis.fixtureReleasePairReservation());
  if(side==='long')await page.locator('#pairStatus').filter({hasText:'No entries submitted'}).waitFor({timeout:8000});else await page.locator('#pairStatus').filter({hasText:'Pair closed in two complete'}).waitFor({timeout:8000});
  await page.locator('#pairOpen:enabled').waitFor();assert.equal(await page.locator('#postable .pt-card').count(),0);assert.equal(await page.locator(side==='long'?'#pairLong':'#pairShort').innerText(),'Not sent');assert.match(await page.locator('#fixtureStatus').innerText(),side==='long'?/^0 native submissions/:/^1 simulated entries · 1 simulated closes/);
  const host=await page.locator('#pairOpen').evaluateHandle(el=>el.getRootNode().host);await host.asElement().screenshot({path:join(out,side+'-reservation-cancelled.png')});await page.close();
 }
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,closeDuringLongSaveSendsNothing:true,closeDuringShortSaveSkipsShortAndClosesLong:true,explicitOpenAvailableAfterResolution:true,simulatedEntries:1,simulatedCloses:1,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
