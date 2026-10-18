// Localhost simulated native ticket: modify exits while an entry preflight is pending.
import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'preflight-edits-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1250}});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4320'?route.continue():route.abort());
 for(const action of ['add','remove']){
  const page=await context.newPage();await page.goto('http://127.0.0.1:4320/trade/btc?preflightEdit=1');
  const price=page.locator('#price'),sl=page.locator('#sl'),save=page.locator('#submit'),card=page.locator('#orders article.order');
  await price.fill('82000');await page.locator('#entryMode').selectOption('limit');await sl.evaluate(el=>el.closest('details').open=true);if(action==='remove')await sl.fill('81000');
  await save.click();await card.waitFor();await page.evaluate(()=>{globalThis.fixtureHoldNextEntryProbe=true;});await page.locator('#reportedLow').click();await page.waitForFunction(()=>globalThis.fixtureEntryProbeHeld===true);
  await card.getByRole('button',{name:'Edit',exact:true}).click();await sl.evaluate(el=>el.closest('details').open=true);await sl.fill(action==='add'?'81000':'');await save.click();await page.locator('#submit:enabled').waitFor();
  assert.match(await page.locator('#fixtureStatus').innerText(),/^0 native submissions/);await page.evaluate(()=>globalThis.fixtureReleaseEntryProbe());
  if(action==='add')await card.getByText('TP / SL armed',{exact:true}).waitFor({timeout:5000});else await page.locator('#notice').filter({hasText:'Entry observed in native position'}).waitFor({timeout:5000});assert.equal(await page.locator('#postable .pt-card').count(),1);assert.match(await page.locator('#fixtureStatus').innerText(),/^1 simulated native submission/);
  assert.deepEqual(await page.evaluate(()=>globalThis.fixtureProbeRevisions),[0,0,0,1],'edited entry must receive a fresh preflight for the submitted revision');
  await page.locator('#panel').screenshot({path:join(out,action+'-exits-after-preflight.png')});
  await page.locator('#stopCross').click();
  if(action==='add'){await page.locator('#postable .pt-card').waitFor({state:'detached'});assert.match(await page.locator('#fixtureStatus').innerText(),/1 simulated native Close submitted/);}
  else{await page.waitForTimeout(1100);assert.equal(await page.locator('#postable .pt-card').count(),1);assert.doesNotMatch(await page.locator('#fixtureStatus').innerText(),/Close submitted/);}
  await page.close();
 }
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,addedExitsArmAndClose:true,removedExitsStayRemoved:true,freshPreflightForSubmittedRevision:true,simulatedEntries:2,simulatedCloses:1,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
