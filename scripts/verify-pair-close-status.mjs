// Localhost simulation: lost short Close response must be visible and never replayed.
import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'pair-close-status-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1250}});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4320'?route.continue():route.abort());const page=await context.newPage();
 await page.goto('http://127.0.0.1:4320/trade/btc?scenario=pair&closeUncertain=1');await page.locator('#pairOpen:enabled').waitFor();await page.locator('#pairOpen').click();await page.locator('#pairStatus').filter({hasText:'Both legs visible'}).waitFor({timeout:8000});
 await page.locator('#pairClose').click();await page.locator('#pairClose').filter({hasText:'Close needs attention'}).waitFor();assert.equal(await page.locator('#pairClose').isDisabled(),true);
 const health=page.locator('#pairHealth');assert.match(await health.innerText(),/Short Close unconfirmed/);assert.equal(await health.getAttribute('data-warning'),'true');assert.match(await page.locator('#pairShort').innerText(),/Close unconfirmed/);
 await page.waitForTimeout(2200);assert.deepEqual(await page.evaluate(()=>globalThis.fixturePairCloseRequests),['long','short']);assert.equal(await page.locator('#postable .pt-card').count(),1);assert.equal(await page.locator('#pairOpen').isDisabled(),true);
 const host=await page.locator('#pairClose').evaluateHandle(el=>el.getRootNode().host);await host.asElement().screenshot({path:join(out,'unconfirmed-short-close.png')});
 // Simulate the user resolving the remaining position using native Close.
 await page.locator('#postable .pt-close-btn').click();await page.locator('#pairStatus').filter({hasText:'Pair closed in two complete'}).waitFor({timeout:8000});await page.locator('#pairOpen:enabled').waitFor();assert.equal(await page.locator('#pairClose').innerText(),'Close pair');assert.equal(await page.locator('#pairShortError').innerText(),'');assert.deepEqual(await page.evaluate(()=>globalThis.fixturePairCloseRequests),['long','short']);
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,uncertainSideNamed:true,warningVisible:true,duplicateCloseBlocked:true,engineCloseRequests:2,manuallyResolvedFakePosition:true,closedWarningClears:true,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
