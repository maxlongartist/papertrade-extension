import test from 'node:test';import assert from 'node:assert/strict';
import {chartQuoteView,chartMoveRisk} from '../extension/chart-data.js';
const now=100000,tick=()=>({mid:83000,price:83001,bid:82999,ask:83001,sourceAt:now,receivedAt:now});
test('chart reference uses a verified recent position mark',()=>{assert.deepEqual(chartQuoteView(tick(),now),{status:'current',price:83000});});
test('either aged source or receipt removes the reference at the display freshness boundary',()=>{
 for(const key of ['sourceAt','receivedAt']){const t=tick();t[key]=now-1999;assert.equal(chartQuoteView(t,now).status,'current');t[key]=now-2000;assert.deepEqual(chartQuoteView(t,now),{status:'stale',price:null});}
});
test('missing, malformed and future quote timestamps cannot claim a current reference',()=>{
 for(const mutate of [t=>delete t.sourceAt,t=>t.receivedAt=NaN,t=>t.sourceAt=-1,t=>t.sourceAt=now+1001,t=>t.receivedAt=now+1001]){const t=tick();mutate(t);assert.deepEqual(chartQuoteView(t,now),{status:'unavailable',price:null});}
 assert.deepEqual(chartQuoteView(null,now),{status:'unavailable',price:null});
});
test('invalid position marks are excluded from the draft chart',()=>{
 for(const price of [0,-1,NaN,Infinity])assert.deepEqual(chartQuoteView({...tick(),mid:price,bid:price,ask:price,price},now),{status:'unavailable',price:null});
});
test('draft move risk retains valid absolute price-move estimates',()=>{assert.deepEqual(chartMoveRisk({price:80000,margin:25,leverage:400,stopLoss:79000,takeProfit:81000}),{loss:125,gain:125});});
test('invalid or incomplete sizing never yields NaN or infinite chart risk',()=>{
 const d={price:80000,margin:25,leverage:400,stopLoss:79000,takeProfit:81000};for(const patch of [{price:0},{price:NaN},{margin:undefined},{margin:0},{leverage:Infinity},{leverage:400.5}])assert.deepEqual(chartMoveRisk({...d,...patch}),{loss:null,gain:null});
 assert.deepEqual(chartMoveRisk({...d,price:1,margin:Number.MAX_VALUE,leverage:400,stopLoss:2,takeProfit:3}),{loss:null,gain:null});
});
test('one missing exit level does not suppress the other valid draft estimate',()=>{
 assert.deepEqual(chartMoveRisk({price:80000,margin:25,leverage:400,stopLoss:null,takeProfit:81000}),{loss:null,gain:125});
});
