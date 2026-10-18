import {readAccount} from './account.js';
import {positionHealth} from './position-health.js';
import {readPositions} from './native.js';
export function mountPositionControls(document,send,getPanel,{market}) {
  let stopped=false,busy=false;
  async function update(){if(stopped||busy)return;busy=true;
    try {const state=await send({type:'state'});if(state.error)throw Error(state.error);const owner=readAccount(document,market),tick=state.ticks[market],live=tick&&Date.now()-tick.sourceAt<=750&&Date.now()-tick.receivedAt<=750;
      for(const p of readPositions(document).filter(p=>p.market===market)) {
        const row=document.querySelector(`[aria-label="${p.market} ${p.side} position ${p.positionId}"]`);if(!row)continue;
        let host=row.querySelector('[data-paperpilot-position]');if(!host){host=document.createElement('div');host.dataset.paperpilotPosition=p.positionId;host.style.gridColumn='1 / -1';row.append(host);const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<style>:host{display:block;font:12px system-ui}.bar{display:flex;gap:12px;align-items:center;margin:5px 0;padding:6px 10px;background:#18232b;color:#b7c6cf;border-radius:5px}button{cursor:pointer;background:#d6e6f0;border:0;border-radius:4px;padding:5px 9px;color:#14222b}.status{flex:1}</style><div class="bar"><span class="status"></span><button type="button">Add SL / TP</button></div>';shadow.querySelector('button').onclick=()=>getPanel()?.openPosition(p);}
        const watch=state.orders.find(o=>o.owner===owner&&o.market===p.market&&o.positionId===p.positionId&&['exits_armed','closing','close_submitted','attention'].includes(o.status));const shadow=host.shadowRoot;
        let status=!watch?'Unprotected':watch.status==='exits_armed'?'Armed':watch.status==='closing'?'Submitting close':watch.status==='close_submitted'?'Close pending — still open':'Needs attention';
        if(watch?.status==='exits_armed'){const health=positionHealth(watch);if(health?.warning)status=health.text;}
        if(watch?.status==='close_submitted'&&Date.now()-(watch.closeSubmittedAt??Date.now())>30000)status='Needs attention — close pending, position still open';
        if(watch?.status==='exits_armed'&&(!live||document.querySelector('#postable .trade-account-status')))status='Disconnected / data delayed — protection unavailable';
        if(watch?.status==='exits_armed'&&row.querySelector('.pt-close-btn')?.disabled)status='Needs attention — native Close unavailable';
        shadow.querySelector('.status').textContent=status;shadow.querySelector('button').textContent=watch?.status==='exits_armed'?'Edit SL / TP':'Add SL / TP';
      }
    } catch {for(const h of document.querySelectorAll('[data-paperpilot-position]'))h.shadowRoot.querySelector('.status').textContent='Disconnected — check extension';}finally{busy=false;}
  }
  const timer=setInterval(update,1000);void update();return()=>{stopped=true;clearInterval(timer);for(const h of document.querySelectorAll('[data-paperpilot-position]'))h.remove();};
}
