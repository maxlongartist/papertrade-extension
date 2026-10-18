// Uses only the localhost simulated native ticket and blocks all remote browser requests.
import {mkdir,writeFile,readFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE to the installed Playwright index.mjs path.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const out=resolve(process.env.BROWSER_VERIFY_OUTPUT??'pair-ui-verification');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1100}});
 await context.route('**/*',route=>{const url=new URL(route.request().url());return url.origin==='http://127.0.0.1:4320'?route.continue():route.abort();});
 const page=await context.newPage();await page.goto('http://127.0.0.1:4320/trade/btc?scenario=pair&delay=1');
 const open=page.getByRole('button',{name:'Open long + short',exact:true}),close=page.getByRole('button',{name:'Close pair',exact:true}),health=page.locator('#pairHealth'),status=page.locator('#pairStatus');
 await open.click();await health.filter({hasText:'Only one leg visible'}).waitFor({timeout:10000});
 assert.equal(await health.getAttribute('data-warning'),'true');assert.equal(await close.isEnabled(),true);
 assert.match(await page.locator('#pairMetrics').innerText(),/Gross PnL estimate .*visible legs only/);assert.match(await page.locator('#pairMetrics').innerText(),/Net exposure estimate .*visible legs only/);assert.match(await page.locator('#pairMetrics').innerText(),/Pair totals unavailable · 1 leg unconfirmed/);
 const partialHealth=await health.innerText();await health.locator('..').screenshot({path:join(out,'partial-pair.png')});
 await close.click();await status.filter({hasText:'Pair closed in two complete native position observations.'}).waitFor({timeout:10000});
 assert.match(await page.locator('#fixtureStatus').innerText(),/2 simulated entries · 2 simulated closes/);assert.equal(await page.locator('#postable .pt-card').count(),0);
 await open.click();await page.locator('#pairShort').filter({hasText:'#4'}).waitFor({timeout:10000});assert.equal(await health.getAttribute('data-warning'),'false');assert.doesNotMatch(await health.innerText(),/Only one/);assert.doesNotMatch(await page.locator('#pairMetrics').innerText(),/only|totals unavailable|unconfirmed/);
 await close.click();await status.filter({hasText:'Pair closed in two complete native position observations.'}).waitFor({timeout:10000});
 assert.match(await page.locator('#fixtureStatus').innerText(),/4 simulated entries · 4 simulated closes/);assert.equal(await page.locator('#postable .pt-card').count(),0);
 await page.getByText('Pair history & details',{exact:true}).click();
 assert.match(await page.locator('#pairActivity').innerText(),/Queue before entry:/);assert.match(await page.locator('#pairActivity').innerText(),/Queue at Close request:/);
 await health.locator('..').screenshot({path:join(out,'queue-history.png')});
 // Invalidate the simulated tab/session binding after both pairs have closed.
 await page.getByRole('button',{name:'Simulate original tab closed',exact:true}).click();
 await page.locator('#pairHistory').filter({hasText:'No pairs in this tab yet.'}).waitFor({timeout:5000});
 await page.getByRole('button',{name:'Saved closed BTC history',exact:true}).click();
 await page.locator('#pairHistoryScope').filter({hasText:'2 saved closed BTC pairs'}).waitFor({timeout:5000});
 assert.equal(await page.getByRole('button',{name:'Close pair',exact:true}).isEnabled(),false);
 await health.locator('..').screenshot({path:join(out,'closed-history.png')});
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export pair history',exact:true}).click();const download=await downloading;await download.saveAs(join(out,'pair-history.json'));
 const exported=JSON.parse(await readFile(join(out,'pair-history.json'),'utf8'));assert.equal(exported.pairs.length,2);assert.ok(exported.pairs.every(p=>p.entryQueue&&p.closeQueue));assert.match(exported.note,/not a fill-time prediction/);
 await page.getByRole('button',{name:'Back to this tab',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Export pair history',exact:true}).isEnabled(),false);
 assert.doesNotMatch(JSON.stringify(exported),/0x111111|targetTabKey|targetTabId/);
 assert.match(await page.locator('#fixtureStatus').innerText(),/4 simulated entries · 4 simulated closes/);assert.equal(await page.locator('#postable .pt-card').count(),0);
 const availableQueueContexts=exported.pairs.flatMap(p=>[p.entryQueue,p.closeQueue]).filter(q=>q.available).length;
 await writeFile(join(out,'verification.json'),JSON.stringify({passed:true,simulated:true,partialHealth,partialEstimatesExplicitlyScoped:true,unconfirmedPairTotalsUnavailable:true,completePairClearsScopeQualifier:true,closeAvailableDuringPartialFill:true,lateFillClosed:true,warningClearedForTwoVisibleLegs:true,simulatedEntries:4,simulatedCloses:4,recordedQueueContexts:4,availableQueueContexts,crossTabClosedHistoryRecovered:true,remainingNativeRows:0,fundedExecutionVerified:false},null,2)+'\n');console.log(JSON.stringify({passed:true,simulated:true,output:out}));
}finally{await browser.close();}
