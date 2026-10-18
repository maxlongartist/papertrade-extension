// Localhost simulation only: preserve a chosen native ID across live-price redraws.
import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE to the installed Playwright index.mjs path.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'recovery-selection-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1100}});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4320'?route.continue():route.abort());
 const page=await context.newPage();await page.goto('http://127.0.0.1:4320/trade/btc?scenario=recovery');
 await page.evaluate(()=>{
  const list=document.querySelector('#postable'),first=list.querySelector('.pt-card'),second=first.cloneNode(true);second.setAttribute('aria-label','BTC short position 101863');second.querySelector('[data-paperpilot-position]')?.remove();
  const close=second.querySelector('.pt-close-btn');close.setAttribute('aria-label','Close BTC position 101863');close.onclick=()=>{second.remove();for(const r of list.querySelectorAll('.pt-card'))r.setAttribute('aria-setsize','1');document.querySelector('#fixtureStatus').textContent='0 native submissions · 1 simulated targeted Close for 101863';};
  first.setAttribute('aria-setsize','2');second.setAttribute('aria-setsize','2');list.append(second);
 });
 await page.getByRole('button',{name:'Attach exits to existing position',exact:true}).click();
 const select=page.locator('select[id^="attach-"]');await select.selectOption('101863');const handle=await select.elementHandle();await select.focus();
 await page.locator('#pauseQuotes').evaluate(node=>node.click());await page.waitForTimeout(1800);
 assert.equal(await handle.evaluate(el=>el.isConnected),true,'live-price repaint detached the chosen position selector');assert.equal(await select.inputValue(),'101863');assert.equal(await handle.evaluate(el=>el.getRootNode().activeElement===el),true,'selection lost focus during repaint');
 await page.locator('#pauseQuotes').evaluate(node=>node.click());await page.waitForTimeout(1800);
 assert.equal(await select.inputValue(),'101863');assert.equal(await handle.evaluate(el=>el.isConnected),true);assert.equal(await handle.evaluate(el=>el.getRootNode().activeElement===el),true);
 await select.locator('xpath=ancestor::article').screenshot({path:join(out,'selected-position.png')});
 await page.getByRole('button',{name:'Arm exits on selected position',exact:true}).click();await page.locator('#fixtureStatus').filter({hasText:'1 simulated targeted Close for 101863'}).waitFor({timeout:5000});
 assert.equal(await page.locator('[aria-label="BTC short position 101862"]').count(),1);assert.equal(await page.locator('[aria-label="BTC short position 101863"]').count(),0);assert.equal(await page.locator('.recovery').count(),0);
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,selectionPreserved:true,focusPreserved:true,selectedPositionId:'101863',unrelatedPositionId:'101862',simulatedEntries:0,simulatedTargetedCloses:1,recoveryRemovedAfterArming:true,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
