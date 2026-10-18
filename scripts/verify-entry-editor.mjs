// Localhost simulation: a delayed save must not turn a newer edit into Create.
import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE to the installed Playwright index.mjs path.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);const out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'entry-editor-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1100}});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4320'?route.continue():route.abort());
 const page=await context.newPage();await page.goto('http://127.0.0.1:4320/trade/btc?entryRace=1');const price=page.locator('#price'),submit=page.locator('#submit');
 for(const target of ['80000','81000']){await price.fill(target);await submit.click();await page.locator('#submit:enabled').waitFor();}
 const cards=page.locator('#orders article.order');assert.equal(await cards.count(),2);
 const first=cards.filter({hasText:'$80,000'}),second=cards.filter({hasText:'$81,000'});const firstId=await first.getAttribute('data-order-id'),secondId=await second.getAttribute('data-order-id');
 await first.getByRole('button',{name:'Edit',exact:true}).click();await price.fill('79990');await page.evaluate(()=>{globalThis.fixtureHoldEntryReply=true;});await submit.click();await page.waitForFunction(()=>globalThis.fixtureEntryReplyHeld===true);
 const pendingWrites=await page.evaluate(()=>globalThis.fixtureEntryWrites.length);await page.locator('#form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(await page.evaluate(()=>globalThis.fixtureEntryWrites.length),pendingWrites,'a pending entry request must not submit twice');
 await page.locator(`article[data-order-id="${secondId}"]`).getByRole('button',{name:'Edit',exact:true}).click();await price.fill('80990');
 await page.evaluate(()=>globalThis.fixtureReleaseEntryReply());await page.locator('#submit:enabled').waitFor();
 assert.equal(await submit.innerText(),'Save entry changes','late save acknowledgement must not reset another selected order into Create mode');assert.equal(await price.inputValue(),'80990');
 await page.locator('#form').screenshot({path:join(out,'pending-draft.png')});await submit.click();await page.locator('#submit:enabled').waitFor();assert.equal(await cards.count(),2);
 const writes=await page.evaluate(()=>globalThis.fixtureEntryWrites);assert.equal(writes.filter(w=>w.type==='create').length,2);assert.equal(writes.at(-1).type,'editWatch');assert.equal(writes.at(-1).id,secondId);assert.equal(writes.at(-1).price,80990);
 assert.match(await page.locator(`article[data-order-id="${firstId}"]`).innerText(),/79,990/);assert.match(await page.locator(`article[data-order-id="${secondId}"]`).innerText(),/80,990/);assert.match(await page.locator('#fixtureStatus').innerText(),/^0 native submissions/);
 // New fields for the same order must survive an earlier acknowledgement too.
 await page.locator(`article[data-order-id="${firstId}"]`).getByRole('button',{name:'Edit',exact:true}).click();await price.fill('79980');await page.evaluate(()=>{globalThis.fixtureHoldEntryReply=true;});await submit.click();await page.waitForFunction(()=>globalThis.fixtureEntryReplyHeld===true);
 await price.fill('79970');await page.evaluate(()=>globalThis.fixtureReleaseEntryReply());await page.locator('#submit:enabled').waitFor();assert.equal(await price.inputValue(),'79970');assert.equal(await submit.innerText(),'Save entry changes');
 await page.locator('#form').screenshot({path:join(out,'same-order-draft.png')});await submit.click();await page.locator('#submit:enabled').waitFor();
 const finalWrites=await page.evaluate(()=>globalThis.fixtureEntryWrites);assert.equal(finalWrites.at(-1).type,'editWatch');assert.equal(finalWrites.at(-1).id,firstId);assert.equal(finalWrites.at(-1).price,79970);assert.equal(finalWrites.filter(w=>w.type==='create').length,2);assert.equal(await cards.count(),2);assert.match(await page.locator('#fixtureStatus').innerText(),/^0 native submissions/);
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,newerOrderDraftPreserved:true,sameOrderDraftPreserved:true,duplicatePendingSubmitBlocked:true,watchCount:2,createRequests:2,secondOrderSaveTarget:secondId,finalSaveTarget:firstId,simulatedNativeEntries:0,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
