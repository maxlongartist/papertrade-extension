import test from 'node:test';import assert from 'node:assert/strict';
import {startWalletFeed,createWalletRetryCoordinator} from '../extension/wallet-feed.js';
const address='0x'+'1'.repeat(40),instruments=new Map([[0,{symbol:'BTC',scale:10}]]);
const snapshot={address,walletRevision:123,accountRevision:1,openPositions:[['5',0,true,false,'830001','20000000000000000000',300,'827500',1000]]};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('public live stream uses omitted credentials, projects positions and hides disconnected data',async()=>{
 let push,options,canceled=false;const updates=[];const body=new ReadableStream({start(c){push=c;},cancel(){canceled=true;}});
 const stop=startWalletFeed(address,instruments,s=>updates.push(s),{fetcher:async(url,o)=>{assert.equal(url,'/state/user/live?wallet='+address);options=o;return new Response(body,{headers:{'content-type':'text/event-stream'}});}});
 push.enqueue(new TextEncoder().encode('event: wallet\ndata: '+JSON.stringify(snapshot)+'\n\n'));await flush();assert.equal(options.credentials,'omit');assert.equal(updates.at(-1).status,'live');assert.equal(updates.at(-1).positions[0].entry,83000.1);assert.equal(updates.at(-1).sessionKeys,undefined);
 push.close();await flush();assert.equal(updates.at(-1).status,'retrying');assert.equal(updates.at(-1).positions,undefined);stop();assert.equal(options.signal.aborted,true);
});
test('rate limit honors Retry-After and disposal cancels pending retries',async()=>{let scheduled,canceled;const updates=[];const stop=startWalletFeed(address,instruments,s=>updates.push(s),{random:()=>0,fetcher:async()=>new Response('',{status:429,headers:{'Retry-After':'90'}}),setTimer:(fn,delay)=>{scheduled={fn,delay};return 7;},clearTimer:id=>{canceled=id;}});await flush();assert.equal(scheduled.delay,90000);assert.equal(updates.at(-1).status,'retrying');assert.match(updates.at(-1).error,/Rate limited/);stop();assert.equal(canceled,7);});
test('invalid and regressing snapshots terminate the stream without retaining live positions',async()=>{
 let push;const updates=[];const stop=startWalletFeed(address,instruments,s=>updates.push(s),{fetcher:async()=>new Response(new ReadableStream({start(c){push=c;}}),{headers:{'content-type':'text/event-stream'}})});
 push.enqueue(new TextEncoder().encode('event: wallet\ndata: '+JSON.stringify(snapshot)+'\n\n'));await flush();assert.equal(updates.at(-1).status,'live');push.enqueue(new TextEncoder().encode('event: wallet\ndata: '+JSON.stringify({...snapshot,walletRevision:122})+'\n\n'));await flush();assert.equal(updates.at(-1).status,'retrying');assert.match(updates.at(-1).error,/Out-of-order/);assert.equal(updates.at(-1).positions,undefined);stop();
});
test('live wallet delta frames update the existing stream instead of reconnecting after every move',async()=>{
 let push,requests=0;const updates=[];const stop=startWalletFeed(address,instruments,s=>updates.push(s),{fetcher:async()=>{requests++;return new Response(new ReadableStream({start(c){push=c;}}),{headers:{'content-type':'text/event-stream'}});}});
 const frame=data=>push.enqueue(new TextEncoder().encode('event: wallet\ndata: '+JSON.stringify(data)+'\n\n'));
 frame(snapshot);await flush();frame({address,baseAccountRevision:1,accountRevision:2,state:{},addedPositions:[['6',0,false,false,'831000','10000000000000000000',200,'835000',2000]],removedPositionIds:['5']});await flush();
 assert.equal(updates.at(-1).status,'live');assert.equal(updates.at(-1).positions[0].id,'6');assert.equal(updates.at(-1).positions[0].side,'short');assert.equal(requests,1);assert.ok(!updates.some(u=>u.status==='retrying'));
 frame({address,baseAccountRevision:9,accountRevision:10,state:{},addedPositions:[],removedPositionIds:[]});await flush();assert.equal(updates.at(-1).status,'retrying');assert.match(updates.at(-1).error,/revision gap/);stop();
});

test('one-snapshot flapping preserves exponential backoff; a sustained stream resets it',async t=>{
 let at=0,push,scheduled,requests=0;const updates=[];
 const stop=startWalletFeed(address,instruments,s=>updates.push(s),{now:()=>at,random:()=>0,setWatchdog:()=>1,clearWatchdog:()=>{},setTimer:(fn,delay)=>{scheduled={fn,delay};return 1;},clearTimer:()=>{},fetcher:async()=>{requests++;return new Response(new ReadableStream({start(c){push=c;}}),{headers:{'content-type':'text/event-stream'}});}});t.after(stop);
 const frame=()=>push.enqueue(new TextEncoder().encode('event: wallet\ndata: '+JSON.stringify(snapshot)+'\n\n'));
 await flush();frame();await flush();push.close();await flush();assert.equal(scheduled.delay,1000);
 at+=scheduled.delay;scheduled.fn();await flush();frame();await flush();push.close();await flush();assert.equal(scheduled.delay,2000,'one valid snapshot does not erase the prior failure');
 at+=scheduled.delay;scheduled.fn();await flush();frame();await flush();at+=30000;push.enqueue(new TextEncoder().encode(': heartbeat\n\n'));await flush();push.close();await flush();assert.equal(scheduled.delay,1000,'30 seconds of observed stream health resets failures');
 stop();scheduled.fn();await flush();assert.equal(requests,3,'a late retry callback after disposal cannot fetch');
});

test('shared rate-limit cooldown survives watch restarts and leaves healthy streams running',async t=>{
 let at=0,healthyPush,healthyOptions,scheduledB,requestsA=0,requestsB=0;const coordinator=createWalletRetryCoordinator(()=>at),healthy=[],waiting=[];
 const common={now:()=>at,random:()=>0,retryCoordinator:coordinator,setWatchdog:()=>1,clearWatchdog:()=>{},clearTimer:()=>{}};
 const healthyStop=startWalletFeed(address,instruments,s=>healthy.push(s),{...common,setTimer:()=>1,fetcher:async(_url,options)=>{healthyOptions=options;return new Response(new ReadableStream({start(c){healthyPush=c;}}),{headers:{'content-type':'text/event-stream'}});}});t.after(healthyStop);await flush();healthyPush.enqueue(new TextEncoder().encode('event: wallet\ndata: '+JSON.stringify(snapshot)+'\n\n'));await flush();
 const stopA=startWalletFeed(address,instruments,()=>{},{...common,setTimer:()=>1,fetcher:async()=>{requestsA++;return new Response('',{status:429,headers:{'Retry-After':'90'}});}});t.after(stopA);await flush();assert.equal(coordinator.remaining(),90000);assert.equal(healthyOptions.signal.aborted,false);assert.equal(healthy.at(-1).status,'live');
 const options={...common,setTimer:(fn,delay)=>{scheduledB={fn,delay};return 2;},fetcher:async()=>{requestsB++;return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('event: wallet\ndata: '+JSON.stringify(snapshot)+'\n\n'));}}),{headers:{'content-type':'text/event-stream'}});}};
 const stopB=startWalletFeed(address,instruments,s=>waiting.push(s),options);await flush();assert.equal(requestsB,0);assert.equal(scheduledB.delay,90000);assert.match(waiting.at(-1).error,/cooling down/);stopB();
 const restarted=startWalletFeed(address,instruments,s=>waiting.push(s),options);t.after(restarted);await flush();assert.equal(requestsB,0,'disable/re-enable cannot bypass Retry-After');at=89999;scheduledB.fn();await flush();assert.equal(requestsB,0);assert.equal(scheduledB.delay,1);at=90000;scheduledB.fn();await flush();assert.equal(requestsB,1);assert.equal(requestsA,1);assert.equal(waiting.at(-1).status,'live');assert.equal(healthyOptions.signal.aborted,false);
});

test('heartbeats cannot keep an initial snapshot lookup pending forever',async t=>{
 let at=0,push,tick,signal,scheduled;const updates=[];
 const stop=startWalletFeed(address,instruments,s=>updates.push(s),{now:()=>at,random:()=>0,setWatchdog:fn=>{tick=fn;return 1;},clearWatchdog:()=>{},setTimer:(fn,delay)=>{scheduled={fn,delay};return 1;},clearTimer:()=>{},fetcher:async(_url,options)=>{signal=options.signal;return new Response(new ReadableStream({start(c){push=c;signal.addEventListener('abort',()=>c.error(new DOMException('Aborted','AbortError')));}}),{headers:{'content-type':'text/event-stream'}});}});t.after(stop);
 await flush();at=25000;push.enqueue(new TextEncoder().encode(': heartbeat\n\n'));await flush();assert.equal(signal.aborted,false);at=30000;tick();await flush();assert.equal(signal.aborted,true);assert.equal(updates.at(-1).status,'retrying');assert.match(updates.at(-1).error,/No initial wallet snapshot/);assert.equal(scheduled.delay,1000);
});

test('retry jitter staggers failures without shortening Retry-After and bare 429s back off at least five seconds',async t=>{
 for(const [random,status,header,expected]of [[0,500,null,1000],[1,500,null,1200],[1,429,'90',91000],[0,429,null,5000]]){
  let scheduled;const stop=startWalletFeed(address,instruments,()=>{},{random:()=>random,setTimer:(fn,delay)=>{scheduled={fn,delay};return 1;},clearTimer:()=>{},fetcher:async()=>new Response('',{status,headers:header?{'Retry-After':header}:{}})});t.after(stop);await flush();assert.equal(scheduled.delay,expected);
 }
});
