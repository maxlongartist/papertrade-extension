import test from 'node:test';import assert from 'node:assert/strict';import {mountOverview} from '../extension/popup-panel.js';
const flush=()=>new Promise(r=>setImmediate(r));
const summary={items:[{kind:'pair',id:'one',market:'BTC',title:'Manual pair',status:'open',positionIds:['1','2'],warning:null}],quotes:[{market:'BTC',ageMs:100}],checkedAt:10000};
function fixture(t,send){
 t.mock.timers.enable({apis:['setInterval','Date']});
 const elements=new Map();const element=()=>({textContent:'',dataset:{},disabled:false,children:[],append(...c){this.children.push(...c);},replaceChildren(...c){this.children=c;}});
 const root={set innerHTML(v){},ownerDocument:{createElement:element},querySelector:s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s);}};
 const calls=[];const dispose=mountOverview(root,m=>{calls.push(m);return send(m);});t.after(dispose);
 return {get:id=>root.querySelector('#'+id),calls,tick:async()=>{t.mock.timers.tick(2000);await flush();},dispose};
}
test('toolbar shows stored records and Manage sends only a saved record reference',async t=>{
 const f=fixture(t,async m=>m.type==='overview'?summary:{ok:true,opened:false});await flush();
 assert.match(f.get('overviewHealth').textContent,/1 tracked item/);
 const card=f.get('overviewItems').children[0];await card.children.at(-1).onclick();
 assert.deepEqual(f.calls.at(-1),{type:'manageItem',kind:'pair',id:'one'});assert.match(f.get('overviewStatus').textContent,/Managing tab opened/);
});
test('failed polling disables stale Manage buttons and successful recovery clears its error',async t=>{
 let fail=false;const f=fixture(t,async()=>fail?{error:'Worker gone'}:summary);await flush();fail=true;await f.tick();
 assert.equal(f.get('overviewItems').children[0].children.at(-1).disabled,true);assert.match(f.get('overviewStatus').textContent,/Worker gone/);
 fail=false;await f.tick();assert.equal(f.get('overviewItems').children[0].children.at(-1).disabled,false);assert.equal(f.get('overviewStatus').textContent,'');
});
test('toolbar polls never overlap and discarded late responses cannot render after disposal',async t=>{
 let release;const f=fixture(t,()=>new Promise(r=>release=r));await f.tick();assert.equal(f.calls.length,1);
 f.dispose();release(summary);await flush();assert.equal(f.get('overviewItems').children.length,0);
});
test('a hung status request expires the displayed snapshot without starting overlapping polls',async t=>{
 let hung=false,release;const f=fixture(t,async()=>hung?new Promise(r=>release=r):summary);await flush();hung=true;
 for(let i=0;i<4;i++)await f.tick();
 assert.equal(f.calls.length,2);assert.equal(f.get('overviewItems').children[0].children.at(-1).disabled,true);assert.match(f.get('overviewQuotes').textContent,/unavailable/);
 release(summary);await flush();assert.equal(f.get('overviewItems').children[0].children.at(-1).disabled,false);
});
