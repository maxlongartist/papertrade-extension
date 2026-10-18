import test from 'node:test';import assert from 'node:assert/strict';import {mountCongestion} from '../extension/congestion-panel.js';import {readStatusPressure,validateStatusReading} from '../extension/congestion-native.js';
const flush=()=>new Promise(r=>setImmediate(r));
function root(){const nodes=new Map();return {set innerHTML(v){},querySelector:s=>{if(!nodes.has(s))nodes.set(s,{dataset:{},textContent:''});return nodes.get(s);}};}
test('queue widget shows pressure and estimate, then hides every stale metric without sending trade commands',async t=>{
 t.mock.timers.enable({apis:['setInterval','Date']});let resolve;
 const r=root(),calls=[],data={live:true,level:'HIGH',pending:100,clearSeconds:9,avgTxPerBlock:3.8,neededBlocks:9,sourceAt:Date.now(),receivedAt:Date.now(),trend:'Queue growing'};
 const dispose=mountCongestion(r,m=>{calls.push(m);return calls.length===1?Promise.resolve(data):new Promise(done=>resolve=done);});t.after(dispose);await flush();
 assert.equal(r.querySelector('#queueClear').textContent,'~9s');assert.match(r.querySelector('#queueHint').textContent,/Consider waiting/);
 for(let i=0;i<6;i++){t.mock.timers.tick(1000);await flush();}
 assert.equal(r.querySelector('#queueLevel').textContent,'UNKNOWN');assert.equal(r.querySelector('#queuePending').textContent,'—');assert.equal(calls.length,2);assert.ok(calls.every(m=>m.type==='congestion'));
 dispose();resolve({...data,sourceAt:Date.now(),receivedAt:Date.now()});await flush();assert.equal(r.querySelector('#queueLevel').textContent,'UNKNOWN');
});
test('native Status fallback reads the observed metric row schema and refuses placeholder data',()=>{
 let values=['MEDIUM','28 tx','3.8','~4s'];const rows=()=>values.map((value,i)=>({querySelector:s=>s==='b'?{textContent:value}:i===0?{getAttribute:()=> 'MEDIUM'}:null}));
 const doc={querySelector:()=>({querySelectorAll:rows})};let s=readStatusPressure(doc,10000);assert.equal(s.pending,28);assert.equal(s.clearSeconds,4);assert.equal(s.avgTxPerBlock,3.8);assert.equal(s.neededBlocks,null);assert.equal(validateStatusReading(s,12000).source,'status-page');assert.equal(validateStatusReading(s,15000),null);
 values=['MEDIUM','--','--','--'];assert.equal(readStatusPressure(doc),null);assert.equal(validateStatusReading({...s,level:'SAFE'},10000),null);
});
test('queue widget labels native page public-stream transport',async t=>{
 const r=root(),stamp=Date.now();const dispose=mountCongestion(r,async()=>({live:true,source:'public-stream',transport:'native-page',level:'LOW',pending:0,clearSeconds:0,avgTxPerBlock:3,neededBlocks:0,sourceAt:stamp,receivedAt:stamp,trend:'Collecting trend'}));t.after(dispose);await flush();assert.match(r.querySelector('#queueAge').textContent,/Page feed updated/);
});
