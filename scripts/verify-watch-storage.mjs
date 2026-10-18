// Localhost simulation only: Chrome storage failure must not activate unsaved settings.
import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'watch-storage-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1300}});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4320'?route.continue():route.abort());
 for(const exits of [false,true]){
  const page=await context.newPage();await page.goto('http://127.0.0.1:4320/trade/btc?storageFailure=1'+(exits?'&scenario=manual':''));
  const input=page.locator(exits?'#existingSL':'#price'),save=page.locator(exits?'#protect':'#submit'),notice=page.locator('#notice'),card=page.locator('#orders article.order');
  if(exits){await page.locator('[aria-label="BTC short position 101862"]').getByRole('button',{name:'Add SL / TP',exact:true}).click();await page.locator('#protect:enabled').waitFor();}
  await input.fill(exits?'84000':'80000');await page.evaluate(()=>{globalThis.fixtureFailWatchSave=true;});await save.click();await notice.filter({hasText:'This watch was not armed'}).waitFor();assert.equal(await card.count(),0,'failed initial arming must leave no active card');assert.equal(await input.inputValue(),exits?'84000':'80000');await page.waitForTimeout(1100);assert.equal(await card.count(),0);assert.match(await page.locator('#fixtureStatus').innerText(),/^0 native submissions/);
  await page.evaluate(()=>{globalThis.fixtureFailWatchSave=false;});await save.click();await card.waitFor();await card.getByRole('button',{name:'Edit',exact:true}).click();
  await page.waitForFunction(exits=>!document.querySelector('#panel').shadowRoot.querySelector(exits?'#protect':'#submit').disabled,exits);
  await input.fill(exits?'84100':'79900');await page.evaluate(()=>{globalThis.fixtureFailWatchSave=true;});await save.click();
  await notice.filter({hasText:'Previous settings remain active'}).waitFor();assert.equal(await input.inputValue(),exits?'84100':'79900');assert.match(await card.innerText(),exits?/SL \$84000/:/80,000/);
  await page.locator('#panel').screenshot({path:join(out,exits?'exit-edit-failed.png':'entry-edit-failed.png')});
  await page.evaluate(()=>{globalThis.fixtureFailWatchSave=false;});await save.click();await card.getByText(exits?/SL \$84100/:/79,900/).waitFor();
  const cancel=card.getByRole('button',{name:exits?'Remove SL / TP':'Cancel order',exact:true});await page.evaluate(()=>{globalThis.fixtureFailWatchSave=true;});await cancel.click();
  await notice.filter({hasText:'Previous settings remain active'}).waitFor();assert.equal(await card.count(),1);await cancel.waitFor();assert.match(await card.innerText(),exits?/TP \/ SL armed/:/Watching/);
  await page.evaluate(()=>{globalThis.fixtureFailWatchSave=false;});await cancel.click();await card.waitFor({state:'detached'});assert.match(await page.locator('#fixtureStatus').innerText(),/^0 native submissions/);await page.close();
 }
 const recovery=await context.newPage();await recovery.goto('http://127.0.0.1:4320/trade/btc?scenario=recovery&storageFailure=1');
 await recovery.getByRole('button',{name:'Attach exits to existing position',exact:true}).click();const attach=recovery.getByRole('button',{name:'Arm exits on selected position',exact:true});
 await recovery.evaluate(()=>{globalThis.fixtureFailWatchSave=true;});await attach.click();await recovery.locator('#notice').filter({hasText:'Previous settings remain active'}).waitFor();assert.equal(await recovery.locator('#orders [data-order-part="state"]').innerText(),'attention');assert.equal(await recovery.locator('#postable .pt-card').count(),1);assert.equal(await attach.isVisible(),true);
 await recovery.evaluate(()=>{globalThis.fixtureFailWatchSave=false;});await attach.click();await recovery.locator('#postable .pt-card').waitFor({state:'detached'});assert.match(await recovery.locator('#fixtureStatus').innerText(),/^0 native submissions.*1 simulated native Close submitted/);await recovery.close();
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,failedInitialArmingLeavesNoWatch:true,failedAttachmentRetainsRecovery:true,attachmentRetrySucceeds:true,failedEntryEditRetainsDraft:true,failedExitEditRetainsDraft:true,failedCancellationsRemainActive:true,retriesSucceed:true,simulatedNativeEntries:0,simulatedNativeCloses:1,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
