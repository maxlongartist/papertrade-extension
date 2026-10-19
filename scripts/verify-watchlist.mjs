// Isolated UI fixture. No wallets, remote endpoints or trading authority.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href),out=resolve('watchlist-verification');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}});
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4320'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:4320/');
 await page.evaluate(async()=>{
  document.body.innerHTML='<div id="watch" style="width:460px;margin:20px"></div>';
  const a='0x'+'a'.repeat(40),b='0x'+'b'.repeat(40),c='0x'+'c'.repeat(40);
  globalThis.watchFixture={requests:[],saved:{publicWalletWatchV1:{enabled:true,chart:false,drafts:false,wallets:[{address:a,name:'Manual',alias:'My friend',selected:true,alerts:false},{address:b,name:'Old venue name',alias:'Custom name',selected:false,alerts:false}]}},ranked:[{address:b,leaderboardName:'Updated venue name'},{address:c,leaderboardName:'New ranked wallet'}]};
  const original=fetch;
  globalThis.fetch=async(url,options={})=>{
   const path=new URL(url,location.origin);
   if(!path.pathname.startsWith('/state/'))return original(url,options);
   watchFixture.requests.push({url:String(url),method:options.method??'GET'});
   if(path.pathname==='/state/trading')return Response.json({instruments:[[0,'BTC',0,'10']]});
   if(path.pathname==='/state/leaderboard/accounts'){
    const accounts=structuredClone(watchFixture.ranked);
    if(watchFixture.hold){watchFixture.pending=true;await new Promise(r=>watchFixture.release=r);}
    return Response.json({ok:true,accounts});
   }
   if(path.pathname==='/state/user/live')return new Response(new ReadableStream({start(controller){
    options.signal.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')));
    controller.enqueue(new TextEncoder().encode('event: wallet\ndata: '+JSON.stringify({address:path.searchParams.get('wallet'),walletRevision:1,accountRevision:1,openPositions:[]})+'\n\n'));
   }}),{headers:{'content-type':'text/event-stream'}});
   throw Error('Unexpected public request '+path.pathname);
  };
  const {mountWalletPanel}=await import('/extension/wallet-panel.js');
  const storage={get:async()=>structuredClone(watchFixture.saved),set:async value=>{watchFixture.saved={...watchFixture.saved,...structuredClone(value)};}};
  const root=document.querySelector('#watch').attachShadow({mode:'open'});
  watchFixture.mount=()=>{watchFixture.dispose=mountWalletPanel(root,{market:'BTC',storage});};watchFixture.mount();
 });
 const root=page.locator('#watch'),a='0x'+'a'.repeat(40),b='0x'+'b'.repeat(40);
 await root.locator('#status').filter({hasText:'1/1 wallet feeds live'}).waitFor();
 await root.getByText('Wallets & filters',{exact:true}).click();
 await page.evaluate(()=>watchFixture.hold=true);await root.locator('#load').click();await page.waitForFunction(()=>watchFixture.pending);
 // A name being edited when the delayed leaderboard arrives must also survive.
 await root.locator(`input[aria-label="Display name for ${a}"]`).fill('My edited friend');await page.evaluate(()=>watchFixture.release());
 await root.locator('#watchNotice').filter({hasText:'1 added · 1 already saved'}).waitFor();await root.locator('#status').filter({hasText:'2/2 wallet feeds live'}).waitFor();
 assert.equal(await root.locator(`input[aria-label="Display name for ${a}"]`).inputValue(),'My edited friend');
 assert.equal(await root.locator(`input[aria-label="Display name for ${b}"]`).inputValue(),'Custom name');
 assert.equal(await root.locator(`input[aria-label="Watch positions for ${b}"]`).isChecked(),false);
 assert.equal(await root.locator(`input[aria-label="Alerts for ${a}"]`).isChecked(),false);
 assert.equal(await root.locator(`input[aria-label="Alerts for ${b}"]`).isChecked(),false);
 const count=await page.evaluate(()=>watchFixture.requests.filter(r=>r.url.startsWith('/state/user/live')).length);
 await page.evaluate(()=>{watchFixture.hold=false;});await root.locator('#load').click();await root.locator('#watchNotice').filter({hasText:'0 added · 2 already saved'}).waitFor();
 assert.equal(await page.evaluate(()=>watchFixture.requests.filter(r=>r.url.startsWith('/state/user/live')).length),count,'name-only discovery must not restart live feeds');
 await page.evaluate(()=>{watchFixture.ranked=Array.from({length:10},(_,i)=>({address:'0x'+String(i+1).padStart(40,'0'),leaderboardName:'Rank '+i}));});
 await root.locator('#load').click();await root.locator('#watchNotice').filter({hasText:'7 added · 0 already saved · 3 did not fit'}).waitFor();
 assert.equal(await root.locator('#wallets .wallet-row').count(),10);
 await page.waitForFunction(()=>watchFixture.saved.publicWalletWatchV1.wallets.length===10);
 await page.evaluate(()=>{watchFixture.dispose();watchFixture.mount();});await root.locator('#status').filter({hasText:'9/9 wallet feeds live'}).waitFor();await root.getByText('Wallets & filters',{exact:true}).click();
 assert.equal(await root.locator(`input[aria-label="Display name for ${a}"]`).inputValue(),'My edited friend');assert.equal(await root.locator(`input[aria-label="Watch positions for ${b}"]`).isChecked(),false);assert.equal(await root.locator('#wallets .wallet-row').count(),10);
 await root.locator('#load').click();await root.locator('#watchNotice').filter({hasText:'0 added · 7 already saved · 3 did not fit'}).waitFor();
 assert.equal(await page.evaluate(()=>watchFixture.requests.some(r=>r.method!=='GET')),false);
 await page.screenshot({path:resolve(out,'watchlist.png')});await page.evaluate(()=>watchFixture.dispose());
 await writeFile(resolve(out,'verification.json'),JSON.stringify({passed:true,simulated:true,manualWalletPreserved:true,optOutsPreserved:true,alertsPreserved:true,pendingAliasPreserved:true,nameOnlyRefreshDoesNotRestartFeeds:true,tenWalletLimit:true,choicesSurviveRemount:true,venueWrites:0,fundedExecutionVerified:false},null,2));
 console.log('Watchlist preservation fixture passed.');
}finally{await browser.close();}
