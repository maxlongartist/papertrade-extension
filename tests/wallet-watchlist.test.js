import test from 'node:test';
import assert from 'node:assert/strict';
import {watchlistBackup,parseWatchlistBackup,mergeWatchlistBackup} from '../extension/wallet-watchlist.js';
const address='0x'+'a'.repeat(40),wallet=(patch={})=>({address,name:'Public name',alias:'My label',selected:false,alerts:false,...patch});
test('watchlist backups round-trip names, aliases, disabled watches and muted alerts',()=>{
 const original=[wallet({alias:'<img src=x onerror=alert(1)>',name:'Whale 🐳'})],backup=watchlistBackup(original),restored=parseWatchlistBackup(JSON.stringify(backup));
 assert.equal(backup.kind,'papertrade-wallet-watchlist');assert.equal(backup.version,1);assert.deepEqual(restored,[{...original[0],nameChecked:true}]);assert.deepEqual(original,[wallet({alias:'<img src=x onerror=alert(1)>',name:'Whale 🐳'})]);
 const upper=watchlistBackup([wallet({address:'0x'+'A'.repeat(40)})]);assert.equal(parseWatchlistBackup(JSON.stringify(upper))[0].address,address);
});
test('watchlist import rejects malformed, oversized, duplicate and unrelated files without echoing file contents',()=>{
 const valid=watchlistBackup([wallet()]),secret='DO_NOT_DISPLAY_PRIVATE_DATA';
 const bad=[secret,JSON.stringify({...valid,privateKey:secret}),JSON.stringify({...valid,version:2}),JSON.stringify({...valid,wallets:[{...valid.wallets[0],privateKey:secret}]}),JSON.stringify({...valid,wallets:[wallet(),wallet({address:'0x'+'A'.repeat(40)})]}),JSON.stringify({...valid,wallets:[wallet({name:'x'.repeat(41)})]}),JSON.stringify({...valid,wallets:[wallet({selected:'false'})]}),JSON.stringify({...valid,wallets:[wallet({address:'invalid'})]}),JSON.stringify({...valid,wallets:Array.from({length:11},(_,i)=>wallet({address:'0x'+String(i).padStart(40,'0')}))}),' '.repeat(32769)];
 for(const value of bad)assert.throws(()=>parseWatchlistBackup(value),error=>!error.message.includes(secret)&&/valid Papertrade/.test(error.message));
});
test('watchlist export includes only public wallet fields and never serializes trading or signing records',()=>{
 const data=watchlistBackup([wallet({nameChecked:true,privateKey:'NEVER_EXPORT',owner:'OWN_WALLET',orders:[{id:'armed'}],notes:'PRIVATE_NOTE'})]),text=JSON.stringify(data);
 assert.deepEqual(Object.keys(data),['kind','version','wallets']);assert.deepEqual(Object.keys(data.wallets[0]),['address','name','alias','selected','alerts']);assert.doesNotMatch(text,/NEVER_EXPORT|OWN_WALLET|PRIVATE_NOTE|armed/);
});
test('watchlist import preserves existing choices, adds complete new entries and refuses overflow atomically',()=>{
 const current=[wallet({alias:'Keep this',selected:false,alerts:false})],incoming=parseWatchlistBackup(JSON.stringify(watchlistBackup([wallet({alias:'Do not replace',selected:true,alerts:true}),wallet({address:'0x'+'b'.repeat(40),alias:'New whale',selected:true,alerts:false})]))),before=structuredClone(current),plan=mergeWatchlistBackup(current,incoming);
 assert.equal(plan.added,1);assert.equal(plan.existing,1);assert.deepEqual(plan.wallets[0],current[0]);assert.equal(plan.wallets[1].alias,'New whale');assert.equal(plan.wallets[1].selected,true);assert.equal(plan.wallets[1].alerts,false);assert.deepEqual(current,before);
 const full=Array.from({length:10},(_,i)=>wallet({address:'0x'+String(i).padStart(40,'0')})),saved=structuredClone(full);assert.throws(()=>mergeWatchlistBackup(full,incoming),/Not enough free slots/);assert.deepEqual(full,saved);
});
