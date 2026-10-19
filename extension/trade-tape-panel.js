import {createTapeStore,tapeView} from './trade-tape-data.js';
import {startTapeFeed} from './trade-tape-feed.js';
const prefKey='papertrade.tradeTape.v1';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>'$'+value.toLocaleString('en-US',{notation:Math.abs(value)>=1000?'compact':'standard',maximumFractionDigits:Math.abs(value)>=1000?1:2});
const signed=value=>value===null?'—':(value>=0?'+':'−')+money(Math.abs(value));
export function mountTradeTape(root,{market='BTC',storage=chrome.storage.local,fetcher=fetch,makeFeed=startTapeFeed,isAvailable=()=>true,now=Date.now}={}){
  root.innerHTML=`<style>
  :host{all:initial;display:block;font:12px system-ui;color:#e4edf5;container-type:inline-size}*{box-sizing:border-box}.box{margin:14px 0;padding:14px;background:#121a22;border:1px solid #34414e;border-radius:8px;overflow-anchor:none;font-variant-numeric:tabular-nums}header{display:flex;gap:8px;align-items:center;justify-content:space-between}h3{margin:0;font-size:16px}button,select{font:inherit;color:#d8e4f0;background:#202b37;border:1px solid #435264;border-radius:5px;padding:6px;cursor:pointer}button:disabled{opacity:.45}label{color:#a9bacb}.filters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}select{max-width:100%}.status{height:3em;line-height:1.5;overflow:auto;color:#9caec2;font-size:11px;margin:6px 0}.status[data-live=true]{color:#62d8ab}.summary{height:3em;font-size:11px;line-height:1.5;overflow:auto;color:#a8b9c9;margin:8px 0}.long{color:#69d6ad}.short{color:#ff889d}.muted{color:#99aabd}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px}th{text-align:left;font-weight:500;color:#96a8bd;position:sticky;top:0;background:#121a22;z-index:1;height:30px}td{border-top:1px solid #273340;height:48px;padding:5px 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}td small{display:block;color:#97aabe;font-size:10px;margin-top:3px;overflow:hidden;text-overflow:ellipsis}th:first-child,td:first-child{width:32px}th:nth-child(2){width:100px}th:nth-child(3){width:70px}th:nth-child(4){width:87px}th:nth-child(5){width:46px}th:nth-child(6){width:70px}.rows{height:360px;overflow:auto;scrollbar-gutter:stable;overscroll-behavior:contain}.wallet{display:block;width:100%;padding:0;border:0;background:none;text-align:left;overflow:hidden;text-overflow:ellipsis;color:#c5c5ff}.compact{display:none}#empty{color:#9caec2;padding:18px 2px;font-size:11px}details{margin:8px 0}summary{cursor:pointer;color:#a9bacb}#selected{overflow-wrap:anywhere;color:#b9c9d7;font-size:11px;line-height:1.6;min-height:5em}footer{color:#8296aa;font-size:10px;line-height:1.5;margin-top:10px}
  @container (max-width:600px){.extra{display:none}.compact{display:block}th:nth-child(2){width:94px}th:nth-child(3){width:64px}th:nth-child(7){width:auto}.box{padding:12px}table{font-size:10px}.wallet{font-size:10px}}
  </style><section class="box"><header><h3>Trade tape</h3><label><input id="enabled" type="checkbox" checked> Live feed</label><button id="pause" type="button" aria-pressed="false">Pause</button></header>
  <div class="filters"><label>Market <select id="market"><option value="current">${escape(market)}</option><option value="all">All markets</option></select></label><label>Type <select id="kind"><option value="all">All types</option><option value="open">Opens</option><option value="close">Closes</option><option value="liq">Liquidations</option></select></label><label>Min size <select id="minimum"><option value="0">Any</option><option value="1000">$1K</option><option value="10000">$10K</option><option value="100000">$100K</option><option value="1000000">$1M</option></select></label></div>
  <div id="status" class="status" role="status">Connecting…</div><div id="summary" class="summary"></div>
  <details id="selection" hidden><summary>Selected trade / wallet</summary><div id="selected"></div><button id="copy" type="button">Copy wallet address</button><span id="copyStatus" class="muted"></span></details>
  <div id="rows" class="rows"><table aria-label="Public trade tape"><thead><tr><th>Age</th><th>Side / type</th><th>Size $</th><th class="extra">Price</th><th class="extra">Lev.</th><th class="extra">PnL</th><th>Wallet<span class="compact muted">/ trade PnL</span></th></tr></thead><tbody id="trades"></tbody></table><div id="empty">Waiting for new public trades. No history is backfilled.</div></div>
  <footer>Market-wide public activity, not pending orders. Last-minute totals use these filters and events observed in this tab. Long/short is the position side, including exits. PnL is reported trade PnL; fees may be separate. Click a wallet for its full address. Up to 200 rows shown; recent events stay in memory only.</footer></section>`;
  const $=id=>root.querySelector('#'+id),store=createTapeStore({now}),names=new Map();
  let disposed=false,ready=false,stopFeed=null,state={status:'connecting'},paused=null,pausedAt=0,pausedCount=0,selected=null,rowKey='',savedError='',nameController=null,nameBusy=false,nameRetryAt=0,saving=Promise.resolve();
  const available=()=>{try{return isAvailable();}catch{return false;}};
  const active=()=>!disposed&&ready&&$('enabled').checked&&document.visibilityState==='visible'&&available();
  const filters=()=>({market:$('market').value==='all'?'all':market,kind:$('kind').value,minimum:Number($('minimum').value)});
  const walletName=address=>names.get(address)?.name||address.slice(0,6)+'…'+address.slice(-4);
  function cacheName(address,name,expires){if(names.size>=256&&!names.has(address))names.delete(names.keys().next().value);names.set(address,{name,expires});}
  function selectionText(){if(!selected)return;const r=selected;$('selected').textContent=`${walletName(r.wallet)} · ${r.wallet}\n${r.market} ${r.side} ${r.kind==='liq'?'liquidation':r.kind} · position #${r.positionId}\n${money(r.notional)} notional · ${r.leverage}× · ${r.price===null?'Price unavailable':'$'+r.price.toLocaleString('en-US',{maximumFractionDigits:8})} · Trade PnL ${signed(r.pnl)} · ${new Date(r.at).toLocaleTimeString()}`;$('selected').style.whiteSpace='pre-wrap';}
  function render(){
    if(disposed)return;
    const time=paused?pausedAt:now(),snapshot=paused??store.snapshot(),view=tapeView(snapshot,filters(),time);
    let status=!available()?'Extension updated · refresh Papertrade.':!$('enabled').checked?'Off · public feed disconnected.':document.visibilityState!=='visible'?'Tab hidden · feed paused; missing events will not be backfilled.':state.status==='live'?'Live · receiving public trades':state.status==='retrying'?`${state.message} Retry in ${Math.max(0,Math.ceil((state.retryAt-now())/1000))}s. Connection gap; no backfill.`:'Connecting to public trades…';
    if(paused)status='Display paused · '+pausedCount+' new trades received. '+status;
    if(savedError)status+=' '+savedError;
    $('status').textContent=status;$('status').dataset.live=String(!paused&&active()&&state.status==='live');
    $('pause').textContent=paused?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(Boolean(paused)));
    const a=view.summary;$('summary').innerHTML=`<span>${view.partial||!active()||state.status!=='live'?'Partial last minute':'Last minute'} · observed${paused?' · frozen':''}</span><br><span class="long">Long ${a.long.count} · ${money(a.long.notional)}</span> &nbsp; <span class="short">Short ${a.short.count} · ${money(a.short.notional)}</span>`;
    const rows=view.rows.map(r=>{const age=Math.max(0,Math.floor((time-r.at)/1000)),price=r.price===null?'—':r.price.toLocaleString('en-US',{maximumFractionDigits:8}),pnl=signed(r.pnl),name=walletName(r.wallet),pnlClass=r.pnl===null?'muted':r.pnl>=0?'long':'short';return `<tr data-seq="${r.seq}"><td title="${escape(new Date(r.at).toISOString())}">${age<60?age+'s':Math.floor(age/60)+'m'}</td><td><span class="${r.side}">${r.side==='long'?'L':'S'} ${r.kind==='liq'?'LIQ':r.kind} ${escape(r.market)}</span><small class="compact">${r.price===null?'':'$'}${price}</small></td><td title="$${r.notional.toLocaleString('en-US',{maximumFractionDigits:8})} notional">${money(r.notional)}<small class="compact">${r.leverage}×</small></td><td class="extra">${price}</td><td class="extra">${r.leverage}×</td><td class="extra ${pnlClass}">${pnl}</td><td><button class="wallet" data-wallet="${r.seq}" type="button" title="${escape(name+' · '+r.wallet)}">${escape(name)}</button><small class="compact ${pnlClass}">${pnl}</small></td></tr>`;}).join('');
    if(rows!==rowKey){rowKey=rows;const focused=root.activeElement?.dataset?.wallet,scroll=$('rows').scrollTop;$('trades').innerHTML=rows;$('rows').scrollTop=scroll;if(focused)root.querySelector(`[data-wallet="${focused}"]`)?.focus({preventScroll:true});}
    $('empty').hidden=view.rows.length>0;$('empty').textContent=snapshot.rows.length?'No trades match these filters.':'Waiting for new public trades. No history is backfilled.';
    selectionText();
  }
  function reconcile(){
    if(active()&&!stopFeed){store.gap();stopFeed=makeFeed(next=>{if(!active())return;state=next;if(next.connected||next.status!=='live')store.gap();if(next.trades){const count=store.add(next.trades);if(paused)pausedCount+=count;}render();});}
    else if(!active()&&stopFeed){stopFeed();stopFeed=null;store.gap();nameController?.abort();}
    render();
  }
  function save(){const prefs={enabled:$('enabled').checked,market:$('market').value,kind:$('kind').value,minimum:Number($('minimum').value)};saving=saving.catch(()=>{}).then(()=>storage.set({[prefKey]:prefs})).catch(()=>{if(!disposed){savedError='Preferences could not be saved.';render();}});}
  for(const id of ['enabled','market','kind','minimum'])$(id).onchange=()=>{save();reconcile();};
  $('pause').onclick=()=>{if(paused){paused=null;pausedCount=0;$('rows').scrollTop=0;}else{paused=store.snapshot();pausedAt=now();pausedCount=0;}render();};
  $('trades').onclick=e=>{const button=e.target.closest('[data-wallet]');if(!button)return;selected=(paused??store.snapshot()).rows.find(r=>r.seq===button.dataset.wallet);if(!selected)return;$('selection').hidden=false;$('selection').open=true;$('copyStatus').textContent='';selectionText();};
  $('copy').onclick=async()=>{if(!selected)return;const address=selected.wallet;try{await navigator.clipboard.writeText(address);if(!disposed)$('copyStatus').textContent='Copied.';}catch{if(!disposed)$('copyStatus').textContent='Copy unavailable; select the address above.';}};
  // At most one name request per second, only for visible rows, with bounded cache.
  async function resolveName(){
    if(!active()||nameBusy||now()<nameRetryAt)return;
    const rows=tapeView(paused??store.snapshot(),filters(),now()).rows.slice(0,12),address=rows.map(r=>r.wallet).find(a=>!names.has(a)||names.get(a).expires<=now());
    if(!address)return;nameBusy=true;nameController=new AbortController();
    try{
      const response=await fetcher('/query/leaderboard/name/'+address,{credentials:'omit',cache:'no-store',signal:AbortSignal.any([nameController.signal,AbortSignal.timeout(5000)])});
      if(response.status===429){const header=response.headers.get('Retry-After'),seconds=header?.trim()?Number(header):NaN,date=Date.parse(header);nameRetryAt=now()+Math.min(3600000,Math.max(5000,Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-now():60000));return;}
      if(!response.ok)throw Error('Name unavailable');const data=await response.json();
      if(disposed||!active())return;
      const name=data?.address?.toLowerCase()===address&&typeof data.leaderboardName==='string'?data.leaderboardName.slice(0,60):'';
      cacheName(address,name,now()+600000);render();
    }catch(error){if(!disposed&&error.name!=='AbortError'){cacheName(address,'',now()+60000);nameRetryAt=now()+5000;}}
    finally{nameBusy=false;nameController=null;}
  }
  const visibility=()=>reconcile();document.addEventListener('visibilitychange',visibility);
  const timer=setInterval(()=>{reconcile();void resolveName();},1000);
  void Promise.resolve().then(()=>storage.get(prefKey)).then(data=>{if(disposed)return;const p=data[prefKey];if(p&&typeof p==='object'){$('enabled').checked=p.enabled!==false;if(['current','all'].includes(p.market))$('market').value=p.market;if(['all','open','close','liq'].includes(p.kind))$('kind').value=p.kind;if([0,1000,10000,100000,1000000].includes(p.minimum))$('minimum').value=String(p.minimum);}}).catch(()=>{savedError='Saved preferences unavailable.';}).finally(()=>{if(!disposed){ready=true;reconcile();}});
  return ()=>{if(disposed)return;disposed=true;stopFeed?.();nameController?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visibility);};
}
