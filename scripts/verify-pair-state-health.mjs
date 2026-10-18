// Localhost simulation: state transport failure must stay visible without blocking Close.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'pair-state-health-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1250}});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4320'?route.continue():route.abort());const page=await context.newPage();
 await page.goto('http://127.0.0.1:4320/trade/btc?scenario=pair&pairStateFailure=1');await page.locator('#pairOpen:enabled').waitFor();await page.locator('#pairOpen').click();await page.locator('#pairStatus').filter({hasText:'Both legs visible'}).waitFor({timeout:8000});assert.doesNotMatch(await page.locator('#pairMetrics').innerText(),/Gross PnL estimate —/);
 await page.evaluate(()=>{globalThis.fixturePairStateFailure=true;});await page.locator('#pairHealth').filter({hasText:'Simulated pair-state transport failure'}).waitFor();assert.match(await page.locator('#pairMetrics').innerText(),/Gross PnL estimate —/);assert.equal(await page.locator('#pairClose').isEnabled(),true);
 await page.evaluate(()=>{globalThis.fixturePairStateFailure=false;globalThis.fixturePairStateHold=true;});await page.waitForFunction(()=>typeof globalThis.fixtureReleasePairState==='function');await page.waitForTimeout(2100);assert.match(await page.locator('#pairHealth').innerText(),/Simulated pair-state transport failure/);assert.match(await page.locator('#pairMetrics').innerText(),/Gross PnL estimate —/);
 const host=await page.locator('#pairOpen').evaluateHandle(el=>el.getRootNode().host);await host.asElement().screenshot({path:join(out,'state-error-close-available.png')});await page.locator('#pairClose').click();await page.waitForFunction(()=>document.querySelectorAll('#postable .pt-card').length===0);assert.match(await page.locator('#fixtureStatus').innerText(),/^2 simulated entries · 2 simulated closes/);assert.match(await page.locator('#pairHealth').innerText(),/Simulated pair-state transport failure/);
 await page.evaluate(()=>{globalThis.fixturePairStateHold=false;globalThis.fixtureReleasePairState();});await page.locator('#pairStatus').filter({hasText:'Pair closed in two complete'}).waitFor({timeout:8000});assert.doesNotMatch(await page.locator('#pairHealth').innerText(),/Simulated pair-state transport failure/);
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,errorSurvivesRedraws:true,estimatesHiddenImmediately:true,closeWorksDuringHeldStateRead:true,successfulReadClearsError:true,simulatedEntries:2,simulatedCloses:2,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
