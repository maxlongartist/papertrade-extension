import test from 'node:test';
import assert from 'node:assert/strict';
import {mountManualPanel} from '../extension/manual-panel.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t, handle) {
 t.mock.timers.enable({apis:['setInterval','setTimeout']});
 const elements=new Map();
 const root={set innerHTML(v){},querySelector:s=>{if(!elements.has(s))elements.set(s,{dataset:{},disabled:['#pairOpen','#pairClose','#pairExport'].includes(s),textContent:'',hidden:false});return elements.get(s);}};
 let ticket={ok:true,ready:true,margin:25,leverage:400};
 const requests=[];
 const dispose=mountManualPanel(root,async m=>{requests.push(m);return handle(m);},{market:'BTC',getTicket:()=>ticket});
 t.after(dispose);
 return {root,get:id=>root.querySelector('#'+id),requests,ticket:v=>ticket=v,tick:async()=>{t.mock.timers.tick(1000);await flush();},dispose};
}
test('panel disables Open until preflight, explains failure, rechecks changed settings and prevents a double click',async t=>{
 let permitted=false,release,checkedTicket={margin:25,leverage:400};
 const f=fixture(t,m=>m.type==='pairState'?{pair:null,history:[]}:m.type==='pairInspect'?{ready:permitted,ticket:checkedTicket,owner:'0x'+'1'.repeat(40),reason:'Insufficient collateral',available:1000,checkedAt:Date.now()}:new Promise(r=>release=r));
 assert.equal(f.get('pairOpen').disabled,true);await flush();
 assert.equal(f.get('pairOpen').disabled,true);assert.match(f.get('pairHealth').textContent,/Insufficient/);
 permitted=true;checkedTicket={margin:20,leverage:300};f.ticket({ok:true,ready:true,margin:20,leverage:300});await f.tick();assert.equal(f.get('pairOpen').disabled,false);
 const first=f.get('pairOpen').onclick();await f.get('pairOpen').onclick();assert.equal(f.requests.filter(m=>m.type==='pairOpen').length,1);assert.equal(f.requests.find(m=>m.type==='pairOpen').expectedOwner,'0x'+'1'.repeat(40));assert.match(f.get('pairWallet').textContent,/Ready wallet 0x1111…1111/);
 release({error:'Native rejected'});await first;assert.match(f.get('pairStatus').textContent,/Native rejected/);
});
test('panel keeps Close available on observation errors, shows leg failure, and hides stale PnL estimates',async t=>{
 const pair={id:'p',market:'BTC',status:'attention',margin:25,leverage:400,createdAt:Date.now()-10000,observedAt:Date.now(),observationError:true,message:'Open Positions first',legs:[{side:'long',entry:'filled',positionId:'42',visible:true,fillPrice:83000,markPrice:83020,error:'Close button unavailable'},{side:'short',entry:'not_sent'}]};
 const f=fixture(t,m=>({pair,history:[pair]}));await flush();
 assert.equal(f.get('pairClose').disabled,false);assert.match(f.get('pairHealth').textContent,/Positions unavailable/);
 assert.match(f.get('pairLongError').textContent,/Close button unavailable/);
 assert.match(f.get('pairMetrics').textContent,/Gross PnL estimate —/);
 assert.equal(f.requests.filter(m=>m.type==='pairInspect').length,0);
});
test('disposed panel ignores a late poll response and starts no preflight',async t=>{
 let release;const f=fixture(t,()=>new Promise(r=>release=r));f.dispose();release({pair:null});await flush();
 assert.equal(f.requests.length,1);
});
test('Export creates a downloadable JSON file containing only the bounded history report',async t=>{
 const p={id:'pair',market:'BTC',owner:'private-owner',targetTabKey:'private-key',status:'closed',createdAt:Date.now()-10000,closedAt:Date.now(),margin:25,leverage:400,legs:[{side:'long',positionId:'7',entry:'filled',closed:true},{side:'short',positionId:'8',entry:'filled',closed:true}]};
 const f=fixture(t,()=>({pair:p,history:[p]}));await flush();
 // The panel uses a real Blob/object URL; inspect the bytes that its anchor downloads.
 let download;
 const rootElement=f.get('pairExport');
 // The harness root is the document owner for the export anchor.
 f.document = {createElement:()=>({click(){download={href:this.href,name:this.download};}})};
 // Install it through the root captured by fixture.
 f.root.ownerDocument=f.document;
 assert.equal(rootElement.disabled,false);rootElement.onclick();
 assert.equal(download.name,'papertrade-pair-history.json');
 const report=await (await fetch(download.href)).json();assert.equal(report.pairs[0].legs[1].positionId,'8');
 assert.doesNotMatch(JSON.stringify(report),/private-owner|private-key/);
 URL.revokeObjectURL(download.href);
});
test('a stalled readiness request never blocks polling an opening pair or enabling Close',async t=>{
 let current=null,release;
 const f=fixture(t,m=>m.type==='pairState'?{pair:current,history:[]}:new Promise(r=>release=r));await flush();
 current={id:'p',market:'BTC',status:'opening',margin:25,leverage:400,createdAt:Date.now(),legs:[{side:'long',entry:'sending'},{side:'short',entry:'not_sent'}],message:'Waiting'};
 await f.tick();assert.equal(f.get('pairClose').disabled,false);assert.equal(f.get('pairOpen').disabled,true);
 assert.equal(f.requests.filter(m=>m.type==='pairState').length,2);
 release({ready:true,available:1000,checkedAt:Date.now()});await flush();assert.equal(f.get('pairOpen').disabled,true);
});
test('orphan recovery button shows saved native IDs and restores tracking without Open or Close',async t=>{
 const recovery={id:'saved',market:'BTC',canRestore:true,reason:'Original tab unavailable. No trade is sent.',legs:[{side:'long',positionId:'1'},{side:'short',positionId:'2'}]};
 let pair={id:'old',market:'BTC',status:'closed',margin:10,leverage:400,createdAt:Date.now()-1000,closedAt:Date.now(),legs:[],message:'Old pair closed'};
 const f=fixture(t,m=>m.type==='pairState'?{pair,history:[]}:m.type==='pairInspect'?{ready:false,reason:'Tracked pair',checkedAt:Date.now(),recovery}:m.type==='pairRestore'?{pair:pair={id:'saved',market:'BTC',status:'attention',margin:25,leverage:400,createdAt:Date.now(),legs:[],message:'Tracking restored. No trades sent.'}}:{error:'Unexpected'});
 await flush();assert.equal(f.get('pairRecovery').hidden,false);assert.equal(f.get('pairRestore').disabled,false);assert.match(f.get('pairRecoveryInfo').textContent,/long #1/);assert.match(f.get('pairStatus').textContent,/awaiting restoration/);
 await f.get('pairRestore').onclick();assert.ok(f.requests.some(m=>m.type==='pairRestore'&&m.id==='saved'));
 assert.ok(!f.requests.some(m=>['pairOpen','pairClose'].includes(m.type)));assert.equal(f.get('pairClose').disabled,false);
});
test('one visible leg warns immediately during opening, keeps Close available, and clears after both fills',async t=>{
 const pair={id:'p',market:'BTC',status:'opening',margin:25,leverage:400,createdAt:Date.now(),observedAt:Date.now(),message:'Waiting for both fills',legs:[{side:'long',entry:'filled',positionId:'1',visible:true,fillPrice:83000,markPrice:83000},{side:'short',entry:'submitted'}]};
 const f=fixture(t,()=>({pair,history:[pair]}));await flush();assert.equal(f.get('pairHealth').dataset.warning,'true');assert.match(f.get('pairHealth').textContent,/Only one leg visible/);assert.equal(f.get('pairClose').disabled,false);assert.match(f.get('pairMetrics').textContent,/Gross PnL estimate .*visible legs only/);assert.match(f.get('pairMetrics').textContent,/Net exposure estimate .*visible legs only/);assert.match(f.get('pairMetrics').textContent,/Pair totals unavailable · 1 leg unconfirmed/);
 Object.assign(pair.legs[1],{entry:'filled',positionId:'2',visible:true,fillPrice:83000,markPrice:83000});pair.status='open';pair.observedAt=Date.now();await f.tick();
 assert.equal(f.get('pairHealth').dataset.warning,'false');assert.doesNotMatch(f.get('pairHealth').textContent,/Only one/);assert.doesNotMatch(f.get('pairMetrics').textContent,/only|totals unavailable|unconfirmed/);assert.ok(f.requests.every(m=>m.type==='pairState'));
});
test('saved IDs awaiting a new position check are labelled unconfirmed while Close remains available',async t=>{
 const pair={id:'p',market:'BTC',status:'attention',margin:25,leverage:400,createdAt:Date.now(),observedAt:null,message:'Tracking resumed',legs:['long','short'].map((side,i)=>({side,entry:'filled',positionId:String(i+1),visible:null,fillPrice:83000}))};
 const f=fixture(t,()=>({pair,history:[pair]}));await flush();assert.match(f.get('pairLong').textContent,/awaiting position check/);assert.match(f.get('pairShort').textContent,/awaiting position check/);assert.equal(f.get('pairClose').disabled,false);assert.match(f.get('pairMetrics').textContent,/Gross PnL estimate —/);
});
test('details show saved entry and Close queue context rather than reinterpreting it as live',async t=>{
 const context={available:true,recordedAt:100000,source:'public-stream',sourceAt:99800,receivedAt:99900,level:'MEDIUM',pending:28,clearSeconds:4};
 const pair={id:'p',market:'BTC',status:'closed',margin:25,leverage:400,createdAt:100000,closedAt:110000,entryQueue:context,closeQueue:{available:false,recordedAt:109000},legs:[]};
 const f=fixture(t,m=>m.type==='pairState'?{pair,history:[pair]}:{ready:false,checkedAt:Date.now()});await flush();assert.match(f.get('pairActivity').textContent,/Queue before entry: MEDIUM.*~4s nominal/);assert.match(f.get('pairActivity').textContent,/Queue at Close request: Unavailable at request/);assert.match(f.get('pairHistory').textContent,/sample 0.2s old at request/);
});
test('saved closed history survives tab polls, exports the selected scope and can return to this tab',async t=>{
 const owner='0x'+'1'.repeat(40),saved={id:'old',owner,market:'BTC',status:'closed',margin:25,leverage:400,createdAt:Date.now()-10000,closedAt:Date.now()-5000,legs:[]};
 const f=fixture(t,m=>m.type==='pairState'?{pair:null,history:[]}:m.type==='pairHistory'?{owner,market:'BTC',checkedAt:Date.now(),history:[saved]}:{ready:false,checkedAt:Date.now()});await flush();
 await f.get('pairSavedHistory').onclick();assert.match(f.get('pairHistoryScope').textContent,/1 saved closed BTC/);assert.match(f.get('pairHistory').textContent,/closed/);assert.equal(f.get('pairExport').disabled,false);await f.tick();assert.match(f.get('pairHistory').textContent,/closed/);
 let download;f.root.ownerDocument={createElement:()=>({click(){download=this.href;}})};f.get('pairExport').onclick();const report=await(await fetch(download)).json();URL.revokeObjectURL(download);assert.equal(report.pairs.length,1);assert.doesNotMatch(JSON.stringify(report),/targetTab|owner/);
 await f.get('pairSavedHistory').onclick();assert.match(f.get('pairHistoryScope').textContent,/this tab/);assert.equal(f.get('pairExport').disabled,true);assert.ok(!f.requests.some(m=>['pairOpen','pairClose','pairRestore'].includes(m.type)));
});
test('history errors preserve current pair controls and a disposed panel ignores late history',async t=>{
 let release,late=false;const p={id:'p',market:'BTC',status:'opening',margin:25,leverage:400,createdAt:Date.now(),legs:[],message:'Waiting'};
 const f=fixture(t,m=>m.type==='pairState'?{pair:p,history:[p]}:m.type==='pairHistory'?late?new Promise(r=>release=r):{error:'Connect wallet before reading history'}:{});await flush();await f.get('pairSavedHistory').onclick();assert.match(f.get('pairHistoryScope').textContent,/Connect wallet/);assert.equal(f.get('pairClose').disabled,false);
 late=true;const request=f.get('pairSavedHistory').onclick();f.dispose();release({owner:'0x'+'1'.repeat(40),market:'BTC',checkedAt:Date.now(),history:[]});await request;assert.equal(f.get('pairHistory').textContent.includes('opening'),true);
});
test('saved history refuses a cross-wallet or active-record response',async t=>{
 const owner='0x'+'1'.repeat(40);let history=[{owner:'0x'+'2'.repeat(40),market:'BTC',status:'closed'}];
 const f=fixture(t,m=>m.type==='pairState'?{pair:null,history:[]}:m.type==='pairHistory'?{owner,market:'BTC',checkedAt:Date.now(),history}:{ready:false,checkedAt:Date.now()});await flush();await f.get('pairSavedHistory').onclick();assert.match(f.get('pairHistoryScope').textContent,/unavailable/);assert.equal(f.get('pairExport').disabled,true);
 history=[{owner,market:'BTC',status:'open'}];await f.get('pairSavedHistory').onclick();assert.match(f.get('pairHistoryScope').textContent,/unavailable/);
});

test('readiness without a verified wallet cannot enable manual Open',async t=>{
 const f=fixture(t,m=>m.type==='pairState'?{pair:null,history:[]}:{ready:true,available:1000,checkedAt:Date.now()});await flush();assert.equal(f.get('pairOpen').disabled,true);assert.equal(f.get('pairWallet').hidden,true);assert.match(f.get('pairHealth').textContent,/Wallet identity unavailable/);await f.get('pairOpen').onclick();assert.equal(f.requests.filter(m=>m.type==='pairOpen').length,0);
});

test('Open carries the displayed sizing even if native settings change before the next render',async t=>{
 let opening;
 const f=fixture(t,m=>m.type==='pairState'?{pair:null,history:[]}:m.type==='pairInspect'?{ready:true,ticket:{margin:25,leverage:400},owner:'0x'+'1'.repeat(40),available:1000,checkedAt:Date.now()}:(opening=m,{error:'Margin or leverage changed since the displayed ticket'}));
 await flush();assert.match(f.get('pairTicket').textContent,/25 per leg.*400/);
 f.ticket({ok:true,ready:true,margin:60,leverage:600});await f.get('pairOpen').onclick();
 assert.deepEqual(opening.expectedTicket,{margin:25,leverage:400});assert.match(f.get('pairStatus').textContent,/Margin or leverage changed/);assert.match(f.get('pairTicket').textContent,/60 per leg.*600/);
});

test('a delayed readiness response for different sizing cannot enable Open',async t=>{
 let release,slow=true;
 const f=fixture(t,m=>m.type==='pairState'?{pair:null,history:[]}:slow?new Promise(r=>release=r):{ready:true,owner:'0x'+'1'.repeat(40),ticket:{margin:25,leverage:400},available:1000,checkedAt:Date.now()});
 await flush();release({ready:true,owner:'0x'+'1'.repeat(40),ticket:{margin:60,leverage:600},available:1000,checkedAt:Date.now()});await flush();
 assert.equal(f.get('pairOpen').disabled,true);assert.match(f.get('pairHealth').textContent,/Ticket changed during readiness/);await f.get('pairOpen').onclick();assert.equal(f.requests.filter(m=>m.type==='pairOpen').length,0);
 slow=false;await f.tick();await f.tick();await f.tick();assert.equal(f.get('pairOpen').disabled,false);assert.match(f.get('pairHealth').textContent,/Ready ·/);
});
test('readiness without checked ticket sizing stays disabled with a reason',async t=>{
 const f=fixture(t,m=>m.type==='pairState'?{pair:null,history:[]}:{ready:true,owner:'0x'+'1'.repeat(40),available:1000,checkedAt:Date.now()});await flush();assert.equal(f.get('pairOpen').disabled,true);assert.match(f.get('pairHealth').textContent,/Ticket changed during readiness/);
});

test('pair-state failures persist across redraws, hide estimates immediately and leave Close available',async t=>{
 const pair={id:'p',owner:'0x'+'1'.repeat(40),market:'BTC',status:'open',margin:25,leverage:400,createdAt:Date.now(),observedAt:Date.now(),message:'Both legs visible',legs:['long','short'].map((side,i)=>({side,entry:'filled',positionId:String(i+1),visible:true,fillPrice:83000,markPrice:83020}))};
 let mode='ok',release;
 const f=fixture(t,m=>m.type==='pairClose'?{pair:{...pair,closeRequested:true,status:'closing',message:'Close requested'}}:mode==='ok'?{pair,history:[pair]}:mode==='fail'?{error:'Worker temporarily unavailable'}:new Promise(r=>release=r));
 await flush();assert.doesNotMatch(f.get('pairMetrics').textContent,/Gross PnL estimate —/);
 mode='fail';await f.tick();assert.match(f.get('pairHealth').textContent,/Worker temporarily unavailable/);assert.match(f.get('pairMetrics').textContent,/Gross PnL estimate —/);assert.equal(f.get('pairClose').disabled,false);
 assert.match(f.get('pairStatus').textContent,/Last known status/);assert.equal(f.get('pairStatus').dataset.warning,'true');
 mode='held';await f.tick();await f.tick();assert.match(f.get('pairHealth').textContent,/Worker temporarily unavailable/);assert.match(f.get('pairMetrics').textContent,/Gross PnL estimate —/);assert.equal(f.requests.filter(m=>m.type==='pairState').length,3,'only one stalled read');
 await f.get('pairClose').onclick();assert.equal(f.requests.filter(m=>m.type==='pairClose').length,1);assert.match(f.get('pairHealth').textContent,/Worker temporarily unavailable/);
 pair.closeRequested=true;pair.status='closing';mode='ok';release({pair,history:[pair]});await flush();await f.tick();assert.doesNotMatch(f.get('pairHealth').textContent,/Worker temporarily unavailable/);assert.equal(pair.observationError,undefined,'display error never alters saved pair');
});
test('a failed state reply after disposal cannot change the detached panel',async t=>{
 let reject;const f=fixture(t,()=>new Promise((_,r)=>reject=r));const before=f.get('pairHealth').textContent;f.dispose();reject(Error('late worker failure'));await flush();assert.equal(f.get('pairHealth').textContent,before);
});

for(const action of ['pairOpen','pairClose','pairRestore']) test('an older status snapshot cannot undo '+action+' acknowledgement',async t=>{
  let hold=false,release;
  const original={id:'p',owner:'0x'+'1'.repeat(40),market:'BTC',status:'open',margin:25,leverage:400,createdAt:Date.now(),observedAt:Date.now(),legs:[],message:'Original pair'};
  const acknowledged={...original,...(action==='pairClose'?{closeRequested:true,status:'closing'}:{}),message:'Acknowledged '+action};
  const f=fixture(t,m=>m.type==='pairState'?hold?new Promise(r=>release=r):{pair:action==='pairClose'?original:null,history:[]}:m.type==='pairInspect'?action==='pairRestore'?{ready:false,checkedAt:Date.now(),recovery:{...original,canRestore:true,reason:'Restore here'}}:{ready:true,owner:original.owner,ticket:{margin:25,leverage:400},available:1000,checkedAt:Date.now()}:{pair:acknowledged});
  await flush();hold=true;await f.tick();assert.equal(typeof release,'function');
  await f.get(action==='pairOpen'?'pairOpen':action==='pairClose'?'pairClose':'pairRestore').onclick();
  assert.match(f.get('pairStatus').textContent,/Acknowledged/);
  release({pair:action==='pairClose'?original:null,history:[]});await flush();
  assert.match(f.get('pairStatus').textContent,/Acknowledged/);assert.equal(f.get('pairOpen').disabled,true);assert.equal(f.get('pairClose').disabled,action==='pairClose');
  f.dispose();
});
test('a status failure from before an action cannot replace its newer acknowledgement with an error',async t=>{
 let hold=false,reject;
 const p={id:'p',owner:'0x'+'1'.repeat(40),market:'BTC',status:'open',margin:25,leverage:400,createdAt:Date.now(),observedAt:Date.now(),legs:[],message:'Open acknowledged'};
 const f=fixture(t,m=>m.type==='pairState'?hold?new Promise((_,r)=>reject=r):{pair:null,history:[]}:m.type==='pairInspect'?{ready:true,owner:p.owner,ticket:{margin:25,leverage:400},available:1000,checkedAt:Date.now()}:{pair:p});
 await flush();hold=true;await f.tick();await f.get('pairOpen').onclick();reject(Error('Obsolete state failure'));await flush();assert.doesNotMatch(f.get('pairHealth').textContent,/Obsolete/);assert.equal(f.get('pairClose').disabled,false);assert.match(f.get('pairStatus').textContent,/Open acknowledged/);
});

test('polls during Open can show a partial fill but cannot roll back its final acknowledgement',async t=>{
 let releaseOpen,releaseState,reads=0;
 const p={id:'p',owner:'0x'+'1'.repeat(40),market:'BTC',status:'opening',margin:25,leverage:400,createdAt:Date.now(),observedAt:Date.now(),legs:[{side:'long',entry:'filled',positionId:'1',visible:true},{side:'short',entry:'sending'}],message:'Partial fill'};
 const f=fixture(t,m=>m.type==='pairInspect'?{ready:true,owner:p.owner,ticket:{margin:25,leverage:400},available:1000,checkedAt:Date.now()}:m.type==='pairOpen'?new Promise(r=>releaseOpen=r):++reads===1?{pair:null,history:[]}:reads===2?{pair:p,history:[p]}:new Promise(r=>releaseState=r));
 await flush();const opening=f.get('pairOpen').onclick();await f.tick();assert.match(f.get('pairStatus').textContent,/Partial fill/);assert.equal(f.get('pairClose').disabled,false);
 await f.tick();releaseOpen({pair:{...p,status:'open',message:'Both filled'}});await opening;releaseState({pair:p,history:[p]});await flush();assert.match(f.get('pairStatus').textContent,/Both filled/);assert.equal(f.get('pairClose').disabled,false);
});

for(const action of ['pairOpen','pairRestore']) for(const lateError of [false,true]) test(action+' reply after a newer Close cannot undo Close or its feedback'+(lateError?' (error)':''),async t=>{
 let releaseAction,live=null,holdState=false;
 const owner='0x'+'1'.repeat(40),partial={id:'p',owner,market:'BTC',status:'opening',margin:25,leverage:400,createdAt:Date.now(),observedAt:Date.now(),legs:[{side:'long',entry:'filled',positionId:'1',visible:true},{side:'short',entry:'not_sent'}],message:'Partial fill'};
 const closed={...partial,closeRequested:true,status:'closing',message:'Close acknowledged'};
 const f=fixture(t,m=>m.type===action?new Promise(r=>releaseAction=r):m.type==='pairClose'?{pair:live=closed}:m.type==='pairState'?holdState?new Promise(()=>{}):{pair:live,history:[]}:action==='pairRestore'?{ready:false,checkedAt:Date.now(),recovery:{...partial,canRestore:true,reason:'Restore here'}}:{ready:true,owner,ticket:{margin:25,leverage:400},available:1000,checkedAt:Date.now()});
 await flush();const pending=f.get(action==='pairOpen'?'pairOpen':'pairRestore').onclick();live=partial;await f.tick();assert.equal(f.get('pairClose').disabled,false);
 await f.get('pairClose').onclick();assert.match(f.get('pairStatus').textContent,/Close acknowledged/);assert.equal(f.get('pairClose').disabled,true);
 holdState=true;await f.tick();releaseAction(lateError?{error:'Old '+action+' error'}:{pair:partial});await pending;
 assert.match(f.get('pairStatus').textContent,/Close acknowledged/);assert.equal(f.get('pairClose').disabled,true);assert.doesNotMatch(f.get('pairStatus').textContent,/Old/);assert.equal(f.requests.filter(m=>m.type==='pairClose').length,1);
});

for(const action of ['pairOpen','pairClose','pairRestore']) test('disposed manual panel ignores late '+action+' replies and direct handler calls',async t=>{
 let releaseAction;
 const p={id:'p',owner:'0x'+'1'.repeat(40),market:'BTC',status:'open',margin:25,leverage:400,createdAt:Date.now(),observedAt:Date.now(),legs:[],message:'Existing pair'};
 const f=fixture(t,m=>m.type===action?new Promise(r=>releaseAction=r):m.type==='pairState'?{pair:action==='pairClose'?p:null,history:[]}:action==='pairRestore'?{ready:false,checkedAt:Date.now(),recovery:{...p,canRestore:true,reason:'Restore here'}}:{ready:true,owner:p.owner,ticket:{margin:25,leverage:400},available:1000,checkedAt:Date.now()});
 await flush();const button=f.get(action==='pairOpen'?'pairOpen':action==='pairClose'?'pairClose':'pairRestore'),pending=button.onclick();const before=f.get('pairStatus').textContent,requests=f.requests.length;f.dispose();releaseAction({pair:{...p,message:'Late action reply'}});await pending;assert.equal(f.get('pairStatus').textContent,before);await button.onclick();assert.equal(f.requests.length,requests);
});

for(const action of ['pairOpen','pairClose','pairRestore']) test('a delayed '+action+' acknowledgement cannot reopen a pair already confirmed closed by polling',async t=>{
 let live=null,releaseAction,holdState=false;
 const p={id:'p',owner:'0x'+'1'.repeat(40),market:'BTC',status:'open',margin:25,leverage:400,createdAt:Date.now()-10000,observedAt:Date.now()-1000,legs:[],message:'Older active acknowledgement'};
 if(action==='pairClose')live=p;
 const f=fixture(t,m=>m.type===action?new Promise(r=>releaseAction=r):m.type==='pairState'?holdState?new Promise(()=>{}):{pair:live,history:[]}:action==='pairRestore'?{ready:false,checkedAt:Date.now(),recovery:{...p,canRestore:true,reason:'Restore here'}}:{ready:true,owner:p.owner,ticket:{margin:25,leverage:400},available:1000,checkedAt:Date.now()});
 await flush();const pending=f.get(action==='pairOpen'?'pairOpen':action==='pairClose'?'pairClose':'pairRestore').onclick();live={...p,status:'closed',closedAt:Date.now(),observedAt:Date.now(),closeRequested:true,message:'Confirmed closed by current observation'};await f.tick();if(action!=='pairRestore')assert.match(f.get('pairStatus').textContent,/Confirmed closed/);
 holdState=true;await f.tick();releaseAction({pair:{...p,closeRequested:action==='pairClose'}});await pending;assert.match(f.get('pairStatus').textContent,/Confirmed closed/);assert.equal(f.get('pairClose').disabled,true);assert.equal(f.get('pairMetrics').hidden,true);
});

test('unreadable startup tracking never claims that either leg was not opened',async t=>{
 const f=fixture(t,()=>({error:'Saved manual pair tracking is unreadable'}));await flush();await f.tick();assert.equal(f.get('pairLong').textContent,'Tracking unavailable');assert.equal(f.get('pairShort').textContent,'Tracking unavailable');assert.match(f.get('pairStatus').textContent,/Pair status unavailable.*native Positions/);assert.equal(f.get('pairOpen').disabled,true);
});
