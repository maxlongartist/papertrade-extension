import {mountMonitor} from './monitor.js';
import {mountSetup,setupRequired} from './setup.js';
import {createPageInstance,duplicateEntryMessage} from './page-instance.js';
import {createPageMessenger} from './page-connection.js';
import {startPagePressureRelay} from './congestion-relay.js';
import {readStatusPressure} from './congestion-native.js';
import {mountCongestion} from './congestion-panel.js';
import {readAccount,verifyAccount} from './account.js';
import {mountPositionControls} from './experience.js';
import { executeNative, probeNative, readTicket, readPositions, closeNative, assertFullPositions } from './native.js';
import { mountPanel } from './panel.js';
import { mountManualPanel } from './manual-panel.js';
import { manualSnapshot } from './manual-native.js';
const pageInstance=createPageInstance(document,chrome.runtime.id);
const send=createPageMessenger(()=>chrome.runtime);
const uiSend=message=>{if(['state','pairState','pairInspect','create'].includes(message.type)&&!pageInstance.canEnter())return Promise.reject(Error(duplicateEntryMessage));return send(message);};
const publicQueueRelay=startPagePressureRelay(send,{isActive:()=>document.visibilityState==='visible'&&/^\/trade\/[a-z][a-z0-9]{0,15}(\/|$)/.test(location.pathname)});
document.addEventListener('visibilitychange',publicQueueRelay.tick);
window.addEventListener('pagehide',()=>{document.removeEventListener('visibilitychange',publicQueueRelay.tick);publicQueueRelay.dispose();},{once:true});
let setupReady=false,setupLoaded=false,setupHost,disposeSetup,monitorHost,disposeMonitor;
let queueHost,disposeQueue,host, pairHost, disposePair, dispose, disposePositions, route, positionsRoot, positionsObserver, positionTimer,conflictNotice;
function syncRoute() {
  const match = /^\/trade\/([a-z][a-z0-9]{0,15})(\/|$)/.exec(location.pathname), panel = document.querySelector('#panelScroll');
  if (!match || !panel) { if (host) host.hidden = true; if(pairHost)pairHost.hidden=true;if(queueHost)queueHost.hidden=true;if(monitorHost)monitorHost.hidden=true; return; }
  if(!document.getElementById('paperpilot-layout')){
    const layout=document.createElement('style');layout.id='paperpilot-layout';
    // Native inline widths from the user's resize handle still take precedence.
    layout.textContent='@media (min-width:761px){#page-trade .panel-col:has(#panelScroll){width:clamp(340px,25vw,420px)}}';
    document.head.append(layout);
  }
  const market = match[1].toUpperCase();
  if(pageInstance.claimed&&!setupReady){
    if(!setupLoaded)return;
    if(!setupHost||!setupHost.isConnected){disposeSetup?.();setupHost=document.createElement('div');setupHost.id='paperpilot-setup';panel.prepend(setupHost);disposeSetup=mountSetup(setupHost.attachShadow({mode:'closed'}),send,()=>{setupReady=true;disposeSetup?.();setupHost.remove();syncRoute();});}
    return;
  }
  if(!pageInstance.canEnter()){
    if(!conflictNotice){conflictNotice=document.createElement('div');conflictNotice.setAttribute('data-paperpilot-conflict','');conflictNotice.setAttribute('role','status');conflictNotice.style.cssText='margin:12px 0;padding:12px;border:1px solid #925c58;border-radius:7px;background:#352226;color:#ffc0b7;font:12px/1.5 system-ui';conflictNotice.textContent=duplicateEntryMessage;}
    if(!conflictNotice.isConnected)panel.prepend(conflictNotice);conflictNotice.hidden=false;
    if(!pageInstance.claimed){route=market;return;}
  }else if(conflictNotice)conflictNotice.hidden=true;
  if (!host || !host.isConnected || route !== market) {
    disposeMonitor?.();monitorHost?.remove();disposeQueue?.();queueHost?.remove();dispose?.();disposePositions?.();disposePair?.();pairHost?.remove(); host?.remove(); host = document.createElement('div'); host.id = 'paperpilot-extension';
    monitorHost=document.createElement('div');monitorHost.id='paperpilot-monitor';
    disposeMonitor=mountMonitor(monitorHost.attachShadow({mode:'closed'}),uiSend,()=>{let positionsReady=false,accountReady=false;try{assertFullPositions(document,{allowPending:true});positionsReady=true;}catch{}try{readAccount(document,market);accountReady=true;}catch{}return {market,positionsReady,accountReady,visible:document.visibilityState==='visible'};});
    queueHost=document.createElement('div');queueHost.id='paperpilot-network-queue';panel.append(queueHost);disposeQueue=mountCongestion(queueHost.attachShadow({mode:'closed'}),uiSend,{market});
    pairHost=document.createElement('div');pairHost.id='paperpilot-manual-pair';panel.append(pairHost);
    disposePair=mountManualPanel(pairHost.attachShadow({mode:'closed'}),uiSend,{market,getTicket:()=>readTicket(document)});
    panel.append(host,monitorHost); route = market;
    if(['BTC','ETH'].includes(market)) {
      dispose = mountPanel(host.attachShadow({ mode: 'closed' }), uiSend, { market, getTicket: () => readTicket(document) });
      disposePositions=mountPositionControls(document,uiSend,()=>dispose,{market});
    }
  }
  monitorHost.hidden=false;
  host.hidden = !['BTC','ETH'].includes(market);
  pairHost.hidden=false;queueHost.hidden=false;
  const nextRoot=document.querySelector('#postable');
  if(nextRoot!==positionsRoot){positionsObserver?.disconnect();clearTimeout(positionTimer);positionsRoot=nextRoot;
    if(nextRoot){positionsObserver=new MutationObserver(changes=>{
      if(changes.every(c=>c.target.nodeType===1&&c.target.closest?.('[data-paperpilot-position]')))return;
      if(positionTimer)return;positionTimer=setTimeout(()=>{positionTimer=null;void send({type:'positionsChanged',market:route}).catch(()=>{});},25);
    });positionsObserver.observe(nextRoot,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label','aria-setsize']});}
  }
}
void send({type:'setupState'}).then(result=>{setupLoaded=true;if(result.accepted===true){setupReady=true;disposeSetup?.();setupHost?.remove();}syncRoute();}).catch(()=>{setupLoaded=true;syncRoute();});
syncRoute(); setInterval(()=>{syncRoute();if(document.querySelector('#tradeStatusPanel'))void send({type:'statusPressure',reading:readStatusPressure(document)}).catch(()=>{});if(route&&(!pageInstance.claimed||(pairHost&&!pairHost.hidden)))void send({type:'pairTick',market:route}).catch(()=>{});}, 1000);
if(!pageInstance.ignoreNativeMessages())chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !['probe', 'execute', 'positions', 'close','pairSnapshot','pairIdentity'].includes(message.type)) return false;
  if(['probe','execute'].includes(message.type)&&!setupReady){respond({error:setupRequired,clicked:false});return false;}
  if(message.type==='probe'){try{pageInstance.assertEntry();}catch(error){respond({error:error.message});return false;}}
  if(message.type==='pairIdentity'){try{respond({ok:true,owner:readAccount(document,message.order.market),market:message.order.market});}catch(error){respond({error:error.message});}return false;}
  if(message.type==='pairSnapshot'){try{respond(manualSnapshot(document,message.order.market));}catch(error){respond({error:error.message});}return false;}
  if (message.type === 'positions') { try{const owner=message.order.owner?verifyAccount(document,message.order):readAccount(document,message.order.market);assertFullPositions(document,{allowPending:true});respond({ok:true,owner,positions:readPositions(document)});}catch(error){respond({error:error.message});}return false; }
  if (message.type === 'close') { closeNative(document,message.order).then(respond,error=>respond({error:error.message,clicked:false}));return true; }
  if (message.type === 'probe') { try { respond(probeNative(document, message.order)); } catch (error) { respond({ error: error.message }); } return false; }
  executeNative(document, message.order,{assertEntry:pageInstance.assertEntry}).then(respond, error => respond({ error: error.message,clicked:false })); return true;
});
