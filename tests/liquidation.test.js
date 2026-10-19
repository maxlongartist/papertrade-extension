import test from 'node:test';import assert from 'node:assert/strict';
import {liquidationLevel} from '../extension/liquidation.js';
import {readPositions} from '../extension/native.js';
const now=100000,draft={mode:'entry',side:'long',price:82000,leverage:1000};
function venue(){return {schemaVersion:1,receivedAt:now,instruments:[[0,'BTC',0,'10',true,false,false,false,false,null,null,null,'1','1',1000,'1','476041580087574','1','1','0','0','0','0']]};}
test('native buffered formula and integer rounding match BTC long/short at 1000x',()=>{
 assert.deepEqual(liquidationLevel(draft,venue(),'BTC',now),{price:81956.9,estimated:true});
 assert.deepEqual(liquidationLevel({...draft,side:'short'},venue(),'BTC',now),{price:82043,estimated:true});
 assert.equal(liquidationLevel({...draft,leverage:300},venue(),'BTC',now).price,81765.6);
});
test('decimal entry conversion avoids binary rounding and supports ETH tick scale',()=>{
 const v=venue();v.instruments[0][1]='ETH';v.instruments[0][3]='100';v.instruments[0][16]='500000000000000';
 assert.equal(liquidationLevel({...draft,price:2400.01},v,'ETH',now).price,2398.8);
 assert.equal(liquidationLevel({...draft,price:2400.019},v,'ETH',now).price,2398.8);
 assert.equal(liquidationLevel({...draft,price:1e-7},v,'ETH',now).price,null);
});
test('missing, malformed, stale, duplicate or wrong-market metadata never invent liquidation',()=>{
 const bad=[null,{}, {...venue(),receivedAt:now-60000},{...venue(),receivedAt:now+1001},{...venue(),schemaVersion:2}];
 for(const patch of [{3:'0'},{3:'x'},{16:'-1'},{16:'1000000000000000000'},{14:999},{1:'ETH'}]){const v=venue();Object.assign(v.instruments[0],patch);bad.push(v);}
 const duplicate=venue();duplicate.instruments.push([...duplicate.instruments[0]]);bad.push(duplicate);
 const changed=venue();changed.instruments[0].push('new field');bad.push(changed);
 for(const v of bad)assert.equal(liquidationLevel(draft,v,'BTC',now).price,null);
 for(const patch of [{side:'x'},{price:0},{price:NaN},{price:Infinity},{price:1e25},{leverage:0},{leverage:1000.5},{leverage:Infinity}])assert.equal(liquidationLevel({...draft,...patch},venue(),'BTC',now).price,null);
});
test('existing positions use native reported bust price even when current estimate differs',()=>{
 assert.deepEqual(liquidationLevel({...draft,mode:'position',liquidationPrice:81940},null,'BTC',now),{price:81940,estimated:false});
 assert.equal(liquidationLevel({...draft,mode:'position'},venue(),'BTC',now).price,null);
});
test('native position reader reads only the named bust cell and omits missing or malformed values',()=>{
 for(const text of ['$81,940.50','--','',undefined]){
  const cells=['','', '82,000','82,010','','','99,999','','20'].map(textContent=>({textContent}));
  const row={getAttribute:()=> 'BTC long position 123',querySelectorAll:()=>cells,querySelector:s=>s==='.pt-sub'?{textContent:'1000× long'}:text===undefined?null:{textContent:text}};
  const [p]=readPositions({querySelectorAll:()=>[row]});assert.equal(p.liquidationPrice,text==='$81,940.50'?81940.5:undefined);assert.equal(p.entryPrice,82000);
 }
});
