import test from 'node:test';import assert from 'node:assert/strict';
import {createMarketFeed} from '../extension/market-feed.js';
function fixture({throwSocket=false,quoteReject=false}={}){
 let clock=100000,seq=0;const timers=new Map(),sockets=[],quotes=[],statuses=[];
 const feed=createMarketFeed({now:()=>clock,schedule:(fn,ms)=>{const id=++seq;timers.set(id,{fn,due:clock+ms});return id;},cancel:id=>timers.delete(id),socket:url=>{if(throwSocket)throw Error('blocked');const s={url,readyState:0,sent:[],send(v){this.sent.push(JSON.parse(v));},close(){this.readyState=3;this.onclose?.();}};sockets.push(s);return s;},onQuote:q=>{quotes.push(q);if(quoteReject)return Promise.reject(Error('storage failed'));},onStatus:s=>statuses.push(s)});
 const advance=ms=>{const end=clock+ms;while(true){const due=[...timers].filter(([,t])=>t.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!due)break;clock=due[1].due;timers.delete(due[0]);due[1].fn();}clock=end;};
 const publish=(coin='BTC',{time=clock,channel='bbo',ws=sockets.at(-1)}={})=>ws.onmessage({data:JSON.stringify({channel,data:channel==='l2Book'?{coin,time,levels:[[{px:'83000',sz:'3'}],[{px:'83002',sz:'1'}]]}:{coin,time,bbo:[{px:'83000',sz:'3'},{px:'83002',sz:'1'}]}})});
 return {feed,timers,sockets,quotes,statuses,advance,publish,clock:()=>clock,open:()=>{const s=sockets.at(-1);s.readyState=1;s.onopen();}};
}
test('price feed subscribes both symbols to BBO and book; Live requires advancing valid data for both',()=>{
 const f=fixture();f.feed.start();f.feed.start();assert.equal(f.sockets.length,1);f.open();assert.equal(f.sockets[0].sent.length,4);assert.match(f.statuses.at(-1),/Waiting/);
 f.publish();assert.notEqual(f.statuses.at(-1),'Live');f.publish('ETH',{channel:'l2Book'});assert.equal(f.statuses.at(-1),'Live');assert.equal(f.quotes[1].feedSource,'l2Book');assert.equal(f.quotes[0].price,83001.5);f.feed.stop();assert.equal(f.timers.size,0);
});
test('one stale symbol retires an otherwise active transport; late old frames never revive it',()=>{
 const f=fixture();f.feed.start();f.open();f.publish();f.publish('ETH');const old=f.sockets[0];
 f.advance(9000);f.publish();f.advance(1000);assert.equal(old.readyState,3);assert.match(f.statuses.at(-1),/ETH feed stalled/);
 const count=f.quotes.length;f.publish('ETH',{ws:old});assert.equal(f.quotes.length,count);f.feed.start();assert.equal(f.sockets.length,1);
 f.advance(2000);assert.equal(f.sockets.length,2);f.open();f.publish();f.publish('ETH');assert.equal(f.statuses.at(-1),'Live');f.feed.stop();assert.equal(f.timers.size,0);
});
test('malformed, stale, future, duplicate-time and ping frames cannot extend feed progress indefinitely',()=>{
 const f=fixture();f.feed.start();f.open();f.publish();f.publish('ETH');const time=f.clock();
 f.advance(9000);const count=f.quotes.length;f.publish('BTC',{time:time-1});f.publish('ETH',{time:f.clock()+1001});f.sockets[0].onmessage({data:'malformed'});f.sockets[0].onmessage({data:'{"channel":"pong"}'});assert.equal(f.quotes.length,count);
 f.advance(1000);assert.equal(f.sockets[0].readyState,3);f.feed.stop();
 const duplicate=fixture();duplicate.feed.start();duplicate.open();duplicate.publish();duplicate.publish('ETH');const original=duplicate.clock();duplicate.advance(4000);duplicate.publish('BTC',{time:original});duplicate.publish('ETH',{time:original});duplicate.advance(6000);assert.equal(duplicate.sockets[0].readyState,3);duplicate.feed.stop();
});
test('constructor failures and socket errors back off without overlapping connections',()=>{
 const failed=fixture({throwSocket:true});assert.doesNotThrow(()=>failed.feed.start());for(let i=0;i<6;i++)failed.feed.start();assert.equal(failed.timers.size,1);failed.advance(2000);assert.equal([...failed.timers.values()][0].due,106000);failed.feed.stop();assert.equal(failed.timers.size,0);
 const f=fixture();f.feed.start();f.open();f.sockets[0].onerror();assert.equal(f.sockets[0].readyState,3);f.advance(1999);assert.equal(f.sockets.length,1);f.advance(1);assert.equal(f.sockets.length,2);f.feed.stop();
});
test('hung handshake expires and stopped feed cannot be revived by delayed callbacks',()=>{
 const f=fixture();f.feed.start();const old=f.sockets[0];f.advance(10000);assert.equal(old.readyState,3);f.feed.stop();f.advance(60000);assert.equal(f.sockets.length,1);old.onopen();f.publish('BTC',{ws:old});assert.equal(f.quotes.length,0);assert.equal(f.timers.size,0);
});
test('quote sink rejection does not leak an unhandled rejection or restart the transport',async()=>{
 const f=fixture({quoteReject:true});f.feed.start();f.open();f.publish();f.publish('ETH');await new Promise(r=>setImmediate(r));assert.equal(f.statuses.at(-1),'Live');assert.equal(f.sockets.length,1);f.feed.stop();
});
