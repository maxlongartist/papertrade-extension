// All UI and native trade controls in this test are the localhost simulation.
import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE to the installed Playwright index.mjs path.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'position-health-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1100}});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4320'?route.continue():route.abort());
 const page=await context.newPage();await page.goto('http://127.0.0.1:4320/trade/btc?scenario=manual');
 await page.getByRole('button',{name:'Add SL / TP',exact:true}).click();await page.locator('#existingSL').fill('84000');await page.getByRole('button',{name:'Arm SL / TP on selected position',exact:true}).click();
 const card=page.locator('#orders article.order');const health=card.getByRole('status');
 await health.filter({hasText:'visible in a recent native check'}).waitFor({timeout:5000});
 await page.evaluate(()=>{globalThis.savedFixturePosition=document.querySelector('#postable .pt-card');document.querySelector('#postable').textContent='No Open Positions';});
 await health.filter({hasText:'not visible. Watch retained'}).waitFor({timeout:5000});assert.equal(await card.getByRole('button',{name:'Remove SL / TP',exact:true}).isEnabled(),true);assert.match(await card.locator('.state').getAttribute('class'),/err/);await card.screenshot({path:join(out,'position-absent.png')});
 await page.evaluate(()=>{const row=globalThis.savedFixturePosition;row.setAttribute('aria-setsize','2');document.querySelector('#postable').replaceChildren(row);});
 await health.filter({hasText:'check unavailable. Keep the original wallet'}).waitFor({timeout:5000});
 await page.evaluate(()=>globalThis.savedFixturePosition.setAttribute('aria-setsize','1'));
 await health.filter({hasText:'visible in a recent native check'}).waitFor({timeout:5000});
 assert.doesNotMatch(await page.locator('#fixtureStatus').innerText(),/Close submitted/);
 await page.locator('#tpCross').click();await card.getByText('Close pending',{exact:true}).waitFor({timeout:5000});
 await page.waitForTimeout(2000);assert.equal(await page.locator('#postable .pt-card').count(),0);assert.match(await page.locator('#fixtureStatus').innerText(),/^0 native submissions · 1 simulated native Close submitted$/);
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,missingPositionWarned:true,partialViewWarned:true,visibilityRecovered:true,watchRetainedUntilTrigger:true,simulatedEntries:0,simulatedCloses:1,boundPositionId:'101862',fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
