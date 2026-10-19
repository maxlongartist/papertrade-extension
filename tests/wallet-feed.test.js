import test from 'node:test';import assert from 'node:assert/strict';
import {startWalletFeed} from '../extension/wallet-feed.js';
const address='0x'+'1'.repeat(40),instruments=new Map([[0,{symbol:'BTC',scale:10}]]);
const snapshot={address,walletRevision:123,openPositions:[['5',0,true,false,'830001','20000000000000000000',300,'827500',1000]]};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('public live stream uses omitted credentials, projects positions and hides disconnected data',async()=>{
 let push,options,canceled=false;const updates=[];const body=new ReadableStream({start(c){push=c;},cancel(){canceled=true;}});
 const stop=startWalletFeed(address,instruments,s=>updates.push(s),{fetcher:async(url,o)=>{assert.equal(url,'/state/user/live?wallet='+address);options=o;return new Response(body,{headers:{'content-type':'text/event-stream'}});}});
 push.enqueue(new TextEncoder().encode('event: wallet\ndata: '+JSON.stringify(snapshot)+'\n\n'));await flush();assert.equal(options.credentials,'omit');assert.equal(updates.at(-1).status,'live');assert.equal(updates.at(-1).positions[0].entry,83000.1);assert.equal(updates.at(-1).sessionKeys,undefined);
 push.close();await flush();assert.equal(updates.at(-1).status,'retrying');assert.equal(updates.at(-1).positions,undefined);stop();assert.equal(options.signal.aborted,true);
});
test('rate limit honors Retry-After and disposal cancels pending retries',async()=>{let scheduled,canceled;const updates=[];const stop=startWalletFeed(address,instruments,s=>updates.push(s),{fetcher:async()=>new Response('',{status:429,headers:{'Retry-After':'90'}}),setTimer:(fn,delay)=>{scheduled={fn,delay};return 7;},clearTimer:id=>{canceled=id;}});await flush();assert.equal(scheduled.delay,90000);assert.equal(updates.at(-1).status,'retrying');assert.match(updates.at(-1).error,/Rate limited/);stop();assert.equal(canceled,7);});
test('invalid and regressing snapshots terminate the stream without retaining live positions',async()=>{
 let push;const updates=[];const stop=startWalletFeed(address,instruments,s=>updates.push(s),{fetcher:async()=>new Response(new ReadableStream({start(c){push=c;}}),{headers:{'content-type':'text/event-stream'}})});
 push.enqueue(new TextEncoder().encode('event: wallet\ndata: '+JSON.stringify(snapshot)+'\n\n'));await flush();assert.equal(updates.at(-1).status,'live');push.enqueue(new TextEncoder().encode('event: wallet\ndata: '+JSON.stringify({...snapshot,walletRevision:122})+'\n\n'));await flush();assert.equal(updates.at(-1).status,'retrying');assert.match(updates.at(-1).error,/Out-of-order/);assert.equal(updates.at(-1).positions,undefined);stop();
});
