import {createPrivateStorage,profileEncryptionKey} from './private-storage.js';
import {setupAccepted,setupVersion,setupRequired} from './setup.js';
import {createEntryCoordinator} from './entry-coordinator.js';
import {createTabBindings} from './tab-bindings.js';
import {buildVersion} from './version.js';
import {validateStatusReading} from './congestion-native.js';
import {pressureView,parsePressure} from './congestion.js';
import {createPressureFeed} from './congestion.js';
import { overview, manageRecord, activeWatches } from './overview.js';
import {createMarketFeed} from './market-feed.js';
import { createEngine } from './engine.js';
import { createManualPairs } from './manual-pair.js';
import { validateManualTicket } from './manual-limits.js';
const privateStorage=createPrivateStorage({storage:chrome.storage.local,crypto,getKey:profileEncryptionKey({indexedDB,crypto})});
const entryOperations=createEntryCoordinator();
const pressureFeed=createPressureFeed();let statusReading=null,statusSourceTab=null,pageReading=null,pageSourceTab=null,pageSamples=[];
const tabSessions=createTabBindings({
 load:async()=>chrome.storage.session?(await chrome.storage.session.get('tabBindings')).tabBindings??{}:{},
 save:async value=>{if(chrome.storage.session)await chrome.storage.session.set({tabBindings:value});},
});
const bindingsReady=tabSessions.ready;
const sourceBinding=tabId=>tabSessions.bind(tabId);
function matchesMarket(tab,market){
  try{const url=new URL(tab.url);return url.origin==='https://exchange.papertrade.xyz'&&new RegExp('^/trade/'+market.toLowerCase()+'(?:/|$)').test(url.pathname);}catch{return false;}
}
async function pageMessage(order, type) {
  let target;
  if(Number.isInteger(order.targetTabId)){
    await bindingsReady;
    if(!tabSessions.matches(order))throw Error('Original tab binding expired. Re-arm this watch from the intended Papertrade tab.');
    try{target=await chrome.tabs.get(order.targetTabId);}catch{throw Error('Original Papertrade tab is closed. Reattach exits from the intended tab.');}
    if(!matchesMarket(target,order.market))throw Error('Original Papertrade tab changed market. Return to the bound market or re-arm there.');
  }else{
    const candidates=(await chrome.tabs.query({url:`https://exchange.papertrade.xyz/trade/${order.market.toLowerCase()}*`})).filter(tab=>!tab.url||matchesMarket(tab,order.market));
    if(candidates.length!==1)throw Error('Legacy watch has no original tab binding. Re-arm it from the intended Papertrade tab.');target=candidates[0];
  }
  let timer;
  try {
    return await Promise.race([
      chrome.tabs.sendMessage(target.id, { type, order }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error(['execute','close'].includes(type)?`Native ${type==='execute'?'entry':'Close'} acknowledgement timed out. Outcome unknown. Check native Positions and Status; no automatic repeat.`:'Extension cannot reach the page. Reload Papertrade after updating the extension.')), 4500); })
    ]);
  } finally { clearTimeout(timer); }
}
const manualPairs=createManualPairs({
 queue:()=>{const reading=pressureView(pageReading,Date.now());if(reading.live)return reading;const direct=pressureFeed.peek();return direct.live?direct:pressureView(statusReading,Date.now());},
 load:async()=>{const stored=await privateStorage.get('manualPairsV1');return Object.hasOwn(stored,'manualPairsV1')?stored.manualPairsV1:[];},
 save:async pairs=>privateStorage.set({manualPairsV1:pairs}),
 snapshot:order=>pageMessage(order,'pairSnapshot'),
 identify:order=>pageMessage(order,'pairIdentity'),
 execute:order=>pageMessage(order,'execute'),
 close:order=>pageMessage(order,'close'),
 originAvailable:async order=>{
   await bindingsReady;
   if(!tabSessions.matches(order))return false;
   // A failed inventory read is not proof that the original tab closed.
   return (await chrome.tabs.query({})).some(tab=>tab.id===order.targetTabId);
 },
 validate:async snapshot=>validateManualTicket(snapshot,(await engine.request({type:'state'})).venue),
});
const engine = createEngine({
  load: async () => {
    const stored = await privateStorage.get(['limitOrdersV3', 'orders']);
    // Retire old SL/pair workflows on upgrade rather than silently continuing them.
    if (stored.orders?.length) await privateStorage.set({ orders: stored.orders.map(o => ({ ...o, automatic: false, status: 'cancelled', upgradeNote: 'Replaced by limit-entry-only version.' })) });
    const orders=stored.limitOrdersV3;
    if(!Array.isArray(orders))return orders;
    await bindingsReady;
    const upgraded=orders.map(o=>Number.isInteger(o.targetTabId)&&['watching','awaiting_fill','exits_armed','close_submitted'].includes(o.status)&&!tabSessions.matches(o)?{...o,status:'attention',message:'Browser tab session changed. Re-arm this watch from the intended Papertrade tab.'}:o.status==='watching' && o.entryTolerance==null?{...o,status:'cancelled',message:'Recreate this entry with the new price tolerance. Existing TP / SL watches are retained.'}:o);
    if(upgraded.some((o,i)=>o!==orders[i]))await privateStorage.set({limitOrdersV3:upgraded});
    return upgraded;
  },
  save: async orders => {
    await privateStorage.set({ limitOrdersV3: orders });
    void Promise.resolve(chrome.action.setBadgeText({ text: orders.some(o => ['attention', 'failed'].includes(o.status)) ? '!' : String(orders.filter(o => o.status === 'watching').length || '') })).catch(()=>{});
  },
  probe: order => pageMessage(order, 'probe'),
  execute: order => entryOperations.run('limit',async()=>{await manualPairs.ready;if(manualPairs.blocksEntries())throw Error('Manual pair active. Cancel this entry watch or finish the manual pair first.');return pageMessage(order, 'execute');}),
  positions: order => pageMessage(order, 'positions'),
  close: order => pageMessage(order, 'close')
});
async function refresh() {
  try {
    const response = await fetch('https://exchange.papertrade.xyz/state/trading', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw Error();
    const value = await response.json();
    if (value.schemaVersion !== 1 || !Array.isArray(value.instruments)) throw Error();
    engine.setVenue({ ...value, receivedAt: Date.now() });
  } catch { engine.setVenue(null); }
}
const marketFeed=createMarketFeed({onQuote:tick=>engine.quote(tick),onStatus:value=>engine.setFeed(value)});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const ownPopup = !sender.tab && sender.id === chrome.runtime.id;
  const ownSite = sender.tab && sender.id === chrome.runtime.id && /^https:\/\/exchange\.papertrade\.xyz\//.test(sender.url ?? '');
  if (!ownPopup && !ownSite) { respond({ error: 'Origin refused.' }); return false; }
  const dispatch=async()=>{
    if(message.type==='setupState'){const stored=await chrome.storage.local.get('setupAcknowledgementV1');return {accepted:setupAccepted(stored.setupAcknowledgementV1)};}
    if(message.type==='setupAccept'){
      if(message.version!==setupVersion)throw Error('Refresh the page to review the current notice.');
      const acknowledgement={version:setupVersion,acceptedAt:Date.now()};
      await chrome.storage.local.set({setupAcknowledgementV1:acknowledgement});return {ok:true,acknowledgement};
    }
    if(['create','pairOpen'].includes(message.type)){
      const stored=await chrome.storage.local.get('setupAcknowledgementV1');
      if(!setupAccepted(stored.setupAcknowledgementV1))throw Error(setupRequired);
    }
    if(message.type==='pagePressure'){
      if(!ownSite)throw Error('Public queue relays require the native Papertrade page.');
      if(!message.publication){if(pageSourceTab===sender.tab.id){pageReading=null;pageSamples=[];}return {ok:true};}
      const next=parsePressure(message.publication);
      if(pageReading&&next.sourceAt<=pageReading.sourceAt)return {ok:true};
      if(!pressureView(pageReading,Date.now()).live)pageSamples=[];
      pageSamples.push(next);pageSamples=pageSamples.filter(s=>next.sourceAt-s.sourceAt<=15000);
      const baseline=pageSamples.find(s=>next.sourceAt-s.sourceAt>=5000),change=baseline?next.backlogBlocks-baseline.backlogBlocks:null;
      pageReading={...next,transport:'native-page',trend:change==null?'Collecting trend':change>=1?'Queue growing':change<=-1?'Queue easing':'Queue broadly steady'};
      pageSourceTab=sender.tab.id;pressureFeed.stop();return {ok:true};
    }
    if(message.type==='statusPressure'){
      if(!ownSite)throw Error('Status readings require the native Papertrade page.');
      if(!message.reading){if(statusSourceTab===sender.tab.id)statusReading=null;return {ok:true};}
      const valid=validateStatusReading(message.reading);if(!valid)throw Error('Invalid native Status reading.');
      statusReading=valid;statusSourceTab=sender.tab.id;return {ok:true};
    }
    if(message.type==='congestion'){
      const relayed=pressureView(pageReading,Date.now(),null,pageReading?.trend);if(relayed.live)return relayed;
      const live=pressureFeed.get();if(live.live)return live;
      const fallback=pressureView(statusReading,Date.now(),null,'Native Status reading');
      return fallback.live?fallback:{...live,reason:'Queue feed unavailable. Keep a Papertrade trading tab visible, or open native Status.'};
    }
    if(['overview','manageItem'].includes(message.type)){
      if(!ownPopup)throw Error('Use the extension toolbar for this control.');
      const [pairs,state]=await Promise.all([manualPairs.records(),engine.request({type:'state'})]);
      await bindingsReady;
      if(message.type==='overview')return {extensionVersion:buildVersion,...overview({pairs,orders:state.orders,ticks:state.ticks,feed:state.feed,tabs:await chrome.tabs.query({}),bindings:tabSessions.snapshot()})};
      const records=message.kind==='pair'?pairs:message.kind==='watch'?activeWatches(state.orders):[];
      const record=records.find(r=>r.id===message.id);
      if(!record)throw Error('This item is no longer active. Refresh the overview.');
      return manageRecord(record,{tabs:chrome.tabs,windows:chrome.windows,bindings:tabSessions.snapshot()});
    }
    if(ownSite){const binding=await sourceBinding(sender.tab.id);message={...message,...binding};if(message.type==='create')message.order={...message.order,...binding};if(message.type==='check')message.order={...message.order,...binding};}
    if(['pairOpen','pairClose','pairState','pairInspect','pairRestore','pairHistory','pairTick'].includes(message.type)){
      if(!ownSite)throw Error('Use manual pair controls on the Papertrade page.');
      if(message.type==='pairTick'){await manualPairs.pulse();return {ok:true};}
      const requestPair=async()=>{
        if(['pairOpen','pairInspect'].includes(message.type)){
          if(message.type==='pairInspect')entryOperations.assertPairReady();
          const state=await engine.request({type:'state'});
          if(state.orders.some(o=>['watching','submitting','awaiting_fill','submitted'].includes(o.status)))throw Error('Cancel or reconcile pending extension entry watches before opening a manual pair.');
        }
        return manualPairs.request(message);
      };
      return message.type==='pairOpen'?entryOperations.run('pair',requestPair):requestPair();
    }
    if(message.type==='create')return entryOperations.run('limit',async()=>{await manualPairs.ready;if(manualPairs.blocksEntries())throw Error('Finish the manual pair before arming another entry.');return engine.request(message);});
    if(message.type==='positionsChanged')void manualPairs.pulse().catch(()=>{});
    return engine.request(message);
  };
  dispatch().then(respond,error=>respond({error:error.message}));return true;
});
chrome.alarms.create('refresh', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => { marketFeed.start(); void refresh(); void engine.pulse();void manualPairs.pulse().catch(()=>{});marketFeed.ping(); });
marketFeed.start(); void refresh();
