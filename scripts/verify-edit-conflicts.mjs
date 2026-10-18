// Localhost simulation: another editor changes the same shared engine record.
import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'edit-conflicts-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1100}});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4320'?route.continue():route.abort());
 for(const kind of ['entry','exits']){
  const page=await context.newPage();await page.goto('http://127.0.0.1:4320/trade/btc?editConflict=1'+(kind==='exits'?'&scenario=manual':''));
  const input=page.locator(kind==='entry'?'#price':'#existingSL'),save=page.locator(kind==='entry'?'#submit':'#protect');
  if(kind==='entry'){await input.fill('80000');await save.click();await page.locator('#submit:enabled').waitFor();}
  else{await page.locator('[aria-label="BTC short position 101862"]').getByRole('button',{name:'Add SL / TP',exact:true}).click();await page.locator('#protect:enabled').waitFor();await input.fill('84000');await save.click();await page.locator('#protect:enabled').waitFor();}
  const card=page.locator('#orders article.order');await card.getByRole('button',{name:'Edit',exact:true}).click();await save.waitFor({state:'visible'});await page.waitForFunction(kind=>!document.querySelector('#panel').shadowRoot.querySelector(kind==='entry'?'#submit':'#protect').disabled,kind);
  await input.fill(kind==='entry'?'79900':'84100');const id=await card.getAttribute('data-order-id');
  await page.evaluate(async({id,kind})=>globalThis.fixtureConcurrentEdit({id,...(kind==='entry'?{price:79800}:{stopLoss:84200})}),{id,kind});
  const errorBox=page.locator(kind==='entry'?'#entryError':'#positionError');await save.click();await errorBox.filter({hasText:'changed since you opened Edit'}).waitFor();await page.waitForTimeout(1100);assert.match(await errorBox.innerText(),/changed since you opened Edit/);
  assert.equal(await input.inputValue(),kind==='entry'?'79900':'84100','conflict must retain the unsaved draft');await card.getByText(kind==='entry'?/79,800/:/SL \$84200/).waitFor();
  await page.locator(kind==='entry'?'#form':'#existingForm').screenshot({path:join(out,kind+'-conflict.png')});
  await card.getByRole('button',{name:'Edit',exact:true}).click();await page.waitForFunction(kind=>!document.querySelector('#panel').shadowRoot.querySelector(kind==='entry'?'#submit':'#protect').disabled,kind);
  assert.equal(await errorBox.isVisible(),false);assert.equal(await input.inputValue(),kind==='entry'?'79800':'84200');await input.fill(kind==='entry'?'79700':'84300');await save.click();await card.getByText(kind==='entry'?/79,700/:/SL \$84300/).waitFor();assert.match(await page.locator('#fixtureStatus').innerText(),/^0 native submissions/);await page.close();
 }
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,entryConflictRetainsDraft:true,rejectionMessagesSurviveLiveUpdates:true,reopenClearsOldErrors:true,exitsConflictRetainsDraft:true,reopenLoadsLatest:true,refreshedSaveSucceeds:true,simulatedNativeEntries:0,simulatedNativeCloses:0,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
