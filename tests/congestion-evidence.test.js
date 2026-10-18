import test from 'node:test';import assert from 'node:assert/strict';
import {captureQueue,exportQueue,queueLabel} from '../extension/congestion-evidence.js';
const reading=()=>({live:true,source:'public-stream',sourceAt:99800,receivedAt:99900,level:'MEDIUM',pending:28,clearSeconds:4,owner:'secret-wallet',raw:{key:'secret-key'}});
test('queue context freezes public fields and historical export preserves request-time freshness',()=>{
 const source=reading(),saved=captureQueue(()=>source,100000);source.pending=999;
 assert.equal(saved.pending,28);assert.equal(saved.sourceAgeMs,200);assert.equal(saved.recordedAt,100000);assert.equal(exportQueue(saved).pending,28);assert.match(queueLabel(saved),/MEDIUM.*~4s nominal.*0.2s old at request/);
 assert.doesNotMatch(JSON.stringify(saved),/secret|owner|raw/);assert.equal(queueLabel(null),'Not recorded');
});
test('missing, stale, future or malformed readings become unavailable without retaining metrics',()=>{
 const options=[null,{...reading(),live:false},{...reading(),sourceAt:95000},{...reading(),receivedAt:95000},{...reading(),sourceAt:101001},{...reading(),level:'SAFE'},{...reading(),pending:-1},{...reading(),clearSeconds:Infinity},{...reading(),source:'unverified'}];
 for(const r of options){const saved=captureQueue(()=>r,100000);assert.deepEqual(saved,{available:false,recordedAt:100000});assert.equal(queueLabel(saved),'Unavailable at request');}
 assert.deepEqual(captureQueue(()=>{throw Error('secret');},100000),{available:false,recordedAt:100000});
});
test('an accidental asynchronous provider never blocks capture or leaks a rejected promise',async()=>{
 assert.deepEqual(captureQueue(()=>Promise.reject(Error('secret')),100000),{available:false,recordedAt:100000});await new Promise(r=>setImmediate(r));
});
