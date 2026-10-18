// Localhost simulation only: existing-position editors must not mix targets/drafts.
import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE to the installed Playwright index.mjs path.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'position-editor-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1100}});await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4320'?route.continue():route.abort());
 const page=await context.newPage();await page.goto('http://127.0.0.1:4320/trade/btc?scenario=manual&editorRace=1');
 await page.evaluate(()=>{const list=document.querySelector('#postable'),first=list.querySelector('.pt-card'),second=first.cloneNode(true);second.setAttribute('aria-label','BTC short position 101863');second.querySelector('[data-paperpilot-position]')?.remove();second.querySelector('.pt-close-btn').setAttribute('aria-label','Close BTC position 101863');first.setAttribute('aria-setsize','2');second.setAttribute('aria-setsize','2');list.append(second);globalThis.fixtureSimulatedNativeCloses=0;for(const row of list.querySelectorAll('.pt-card'))row.querySelector('.pt-close-btn').onclick=()=>{row.remove();const remaining=[...list.querySelectorAll('.pt-card')];for(const item of remaining)item.setAttribute('aria-setsize',String(remaining.length));if(!remaining.length)list.textContent='No Open Positions';document.querySelector('#fixtureStatus').textContent='0 native submissions · '+(++globalThis.fixtureSimulatedNativeCloses)+' simulated native Close submitted';};});
 const select=page.locator('#existingPosition'),sl=page.locator('#existingSL'),protect=page.locator('#protect');
 for(const [id,stop] of [['101862','84000'],['101863','85000']]){
  await page.locator(`[aria-label="BTC short position ${id}"]`).getByRole('button',{name:'Add SL / TP',exact:true}).click();await page.locator('#protect:enabled').waitFor();assert.equal(await select.inputValue(),id);await sl.fill(stop);await protect.click();await page.locator('#protect:enabled').waitFor();
 }
 assert.equal(await page.locator('#closePositionEditor').count(),1,'position editor must have an explicit Close editor control');
 await page.getByRole('button',{name:'Load open positions',exact:true}).click();await page.waitForTimeout(100);
 assert.equal(await select.inputValue(),'101863','refresh must retain the selected position');assert.equal(await sl.inputValue(),'85000');
 await select.selectOption('101862');await page.locator('#protect:enabled').waitFor();assert.equal(await sl.inputValue(),'84000','first position must not inherit the second position stop');assert.equal(await protect.innerText(),'Save SL / TP changes');
 await sl.fill('84050');await protect.click();
 const first=page.locator('#orders article.order').filter({hasText:'Exits · short #101862'}),second=page.locator('#orders article.order').filter({hasText:'Exits · short #101863'});
 await first.getByText(/SL \$84050/).waitFor({timeout:5000});assert.match(await second.innerText(),/SL \$85000/);assert.doesNotMatch(await page.locator('#fixtureStatus').innerText(),/Close submitted/);
 // Hold the first editor response, select another position, then release the old response.
 await page.evaluate(()=>{globalThis.fixtureHoldEditorState=true;});
 await page.locator('[aria-label="BTC short position 101862"]').getByRole('button',{name:'Edit SL / TP',exact:true}).click();
 await page.waitForFunction(()=>globalThis.fixtureEditorStateHeld===true);assert.equal(await protect.isDisabled(),true);
 const writes=await page.evaluate(()=>globalThis.fixtureEditorWrites.length);
 await page.locator('#existingForm').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(await page.evaluate(()=>globalThis.fixtureEditorWrites.length),writes,'a loading editor must not submit');
 await select.selectOption('101863');await page.locator('#protect:enabled').waitFor();assert.equal(await sl.inputValue(),'85000');
 await page.evaluate(()=>globalThis.fixtureReleaseEditorState());await page.waitForTimeout(200);
 assert.equal(await select.inputValue(),'101863');assert.equal(await sl.inputValue(),'85000','late editor response must not overwrite the latest position thresholds');
 await sl.fill('85050');await protect.click();await second.getByText(/SL \$85050/).waitFor({timeout:5000});assert.match(await first.innerText(),/SL \$84050/);
 assert.doesNotMatch(await page.locator('#fixtureStatus').innerText(),/Close submitted/);
 // A disappeared choice must fail rather than silently fall back to the first row.
 const beforeMissing=await page.evaluate(()=>globalThis.fixtureEditorWrites.length);
 await select.evaluate(el=>{const option=document.createElement('option');option.value='missing';option.textContent='Unavailable test position';el.append(option);});
 await select.selectOption('missing');await page.locator('#positionError').filter({hasText:'Selected native position is no longer available'}).waitFor({timeout:5000});await page.waitForTimeout(1100);assert.equal(await page.locator('#positionError').isVisible(),true);
 assert.equal(await protect.isDisabled(),true);assert.equal(await page.evaluate(()=>globalThis.fixtureEditorWrites.length),beforeMissing);
 await page.getByRole('button',{name:'Load open positions',exact:true}).click();await page.locator('#protect:enabled').waitFor();assert.equal(await select.inputValue(),'101862');assert.equal(await sl.inputValue(),'84050');assert.equal(await page.locator('#positionError').isVisible(),false);
 await page.locator('#existingForm').screenshot({path:join(out,'position-editor.png')});
 const closeEditor=page.locator('#closePositionEditor'),nativeFirst=page.locator('[aria-label="BTC short position 101862"]');
 const beforeClose=await page.evaluate(()=>globalThis.fixtureEditorWrites.length);await sl.fill('89999');await closeEditor.click();assert.equal(await page.locator('#existingForm').isVisible(),false);assert.equal(await closeEditor.isVisible(),false);assert.equal(await page.evaluate(()=>globalThis.fixtureEditorWrites.length),beforeClose);assert.match(await first.innerText(),/SL \$84050/);
 await nativeFirst.getByRole('button',{name:'Edit SL / TP',exact:true}).click();await page.locator('#protect:enabled').waitFor();assert.equal(await sl.inputValue(),'84050','reopening must read the saved stop rather than the discarded draft');
 await page.evaluate(()=>{globalThis.fixtureHoldEditorState=true;});await nativeFirst.getByRole('button',{name:'Edit SL / TP',exact:true}).click();await page.waitForFunction(()=>globalThis.fixtureEditorStateHeld===true);await closeEditor.click();await page.evaluate(()=>globalThis.fixtureReleaseEditorState());await page.waitForTimeout(200);assert.equal(await page.locator('#existingForm').isVisible(),false,'a read completed after Close editor must not reopen it');assert.equal(await closeEditor.isVisible(),false);assert.equal(await page.evaluate(()=>globalThis.fixtureEditorWrites.length),beforeClose);
 await nativeFirst.getByRole('button',{name:'Edit SL / TP',exact:true}).click();await page.locator('#protect:enabled').waitFor();await sl.fill('84060');await page.evaluate(()=>{globalThis.fixtureHoldPositionReply=true;});await protect.click();await page.waitForFunction(()=>globalThis.fixturePositionReplyHeld===true);assert.equal(await closeEditor.isDisabled(),true);await closeEditor.evaluate(el=>el.onclick());assert.equal(await page.locator('#existingForm').isVisible(),true);assert.equal(await sl.inputValue(),'84060');
 await page.evaluate(()=>globalThis.fixtureReleasePositionReply());await page.locator('#protect:enabled').waitFor();await first.getByText(/SL \$84060/).waitFor();await page.locator('#existingForm').locator('..').screenshot({path:join(out,'close-position-editor.png')});await closeEditor.click();assert.equal(await page.locator('#existingForm').isVisible(),false);assert.match(await first.innerText(),/SL \$84060/);assert.doesNotMatch(await page.locator('#fixtureStatus').innerText(),/Close submitted/);
 await page.locator('#tpCross').click();await nativeFirst.waitFor({state:'detached',timeout:5000});assert.equal(await page.locator('[aria-label="BTC short position 101863"]').count(),1);assert.equal(await page.evaluate(()=>globalThis.fixtureSimulatedNativeCloses),1);assert.match(await page.locator('#fixtureStatus').innerText(),/^0 native submissions.*1 simulated native Close submitted/);
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,reloadMatchesSelectedPosition:true,refreshPreservesSelection:true,firstPositionId:'101862',firstStop:84060,secondPositionId:'101863',secondStop:85050,lateResponseIgnored:true,localDraftDiscarded:true,lateReadAfterCloseIgnored:true,closeBlockedDuringSave:true,protectionRemainsArmedAfterClose:true,stopExecutesAfterEditorClosed:true,otherNativePositionUntouched:true,loadingSubmitBlocked:true,missingSelectionRefused:true,positionReadErrorPersistsUntilReload:true,simulatedEntries:0,simulatedCloses:1,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
