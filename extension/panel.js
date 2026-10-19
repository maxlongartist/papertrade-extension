import {orderProgress} from './execution-progress.js';
import {validOwner} from './account.js';
import {canCancelEntry} from './order-actions.js';
import {entryExpiry} from './entry-expiry.js';
import {syncOrderCards} from './order-cards.js';
import {positionHealth} from './position-health.js';
import {exportExecutionHistory} from './history.js';
import {mountLevelChart} from './chart.js';
import {exitLevels,positionMarkPrice,hit,entryBlockReason} from './core.js';
export function mountPanel(root, send, { market = 'BTC', getTicket } = {}) {
  root.innerHTML = `<style>
    :host{all:initial;display:block;color:#e9edf1;font:13px system-ui}
    *{box-sizing:border-box}.box{margin:14px 0;padding:14px;border:1px solid #343b42;border-radius:8px;background:#171d22;font:13px system-ui;color:#e9edf1}
    .line{display:flex;align-items:center;justify-content:space-between;gap:8px}.title{font-weight:650}.live{font-size:11px;color:#94b3a2}.sides{display:flex;gap:6px;margin:12px 0}
    button,input{font:inherit;border-radius:5px}button{cursor:pointer;border:1px solid #414a52;background:#222a31;color:#dfe7ed;padding:9px 12px}button:disabled{opacity:.45;cursor:default}.sides button{flex:1}.sides button[aria-pressed=true]{background:#d6e6f0;color:#14222b;border-color:#d6e6f0}
    label{display:block;color:#aeb9c3;font-size:12px}input{display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #414a52;background:#11171c;color:#eef4f8;font-size:17px;font-variant-numeric:tabular-nums}
    .exitgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.exitgrid input{font-size:14px;padding:8px}
    .meta{color:#a3b0bc;font-size:11px;margin:9px 0;line-height:1.5}#submit{width:100%;background:#d6e6f0;color:#14222b;font-weight:650;border-color:#d6e6f0;margin-top:8px}#notice{font-size:12px;color:#ebbd89;line-height:1.5;margin-top:10px}#notice:empty{display:none}
    .order{border-top:1px solid #343b42;margin-top:12px;padding-top:10px}.order b{font-size:12px}.order small{display:block;color:#aebac5;margin-top:5px;line-height:1.4}.cancel{display:block;width:100%;margin-top:9px;padding:10px 12px;font-size:12px;font-weight:650;color:#ffc0b7;background:#352226;border-color:#925c58}.order-heading{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.edit{padding:4px 8px;font-size:11px}.orders-title{font-size:12px;margin:12px 0 0}.empty{color:#91a3b3;font-size:11px;margin:8px 0}.order-note{font-size:11px;color:#b4bec7;margin-top:6px}.state{font-size:11px;color:#a5ccaf}.err{color:#f1b68f}.footer{font-size:10px;color:#8696a3;line-height:1.5;margin-top:12px}details{margin-top:12px}summary{cursor:pointer;color:#8fa6b8;font-size:11px}pre{white-space:pre-wrap;font:10px system-ui}
  :host{font-variant-numeric:tabular-nums}.box{overflow-anchor:none}.line{display:block}.title{display:block}.live{display:block;height:3em;line-height:1.5;overflow:auto;overflow-wrap:anywhere;margin-top:4px}#notice{margin:0;overflow-wrap:anywhere}.connection-slot{height:4.5em;font-size:11px;line-height:1.5;overflow:auto;margin:9px 0}.connection-slot .meta{margin:0}#ticket{height:3em;overflow:auto}.order-heading{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:1.8em 2.8em;gap:0 8px}.order-heading [data-order-part=title]{grid-column:1;grid-row:1;overflow:auto}.order-heading [data-order-part=state]{grid-column:1;grid-row:2;height:100%;overflow:auto}.order-heading [data-order-part=edit]{grid-column:2;grid-row:1 / span 2}.order [data-order-part=description]{height:7em;overflow:auto;overflow-wrap:anywhere}.order [data-order-part=health]{height:4.5em;line-height:1.5;overflow:auto}.order [data-order-part=health][hidden]{display:block!important;visibility:hidden}.risk{height:4.5em;line-height:1.5;overflow:auto}.quote-status{height:2.8em;overflow:auto}:host{container-type:inline-size}@container (min-width:440px){.live,#ticket{height:1.5em}.connection-slot,.risk{height:3em}}</style><section class="box">
    <div class="line"><span class="title">Limit entry · ${market}</span><span class="live" id="live">Connecting…</span></div>
    <div class="connection-slot" tabindex="0"><div id="connectionError" class="meta err" role="status" hidden></div><div id="notice" role="status"></div></div>
    <h3 id="activeOrdersTitle" class="orders-title">Active orders</h3><div id="orders"></div><form id="form"><div class="sides"><button type="button" id="long" aria-pressed="true">Long</button><button type="button" id="short" aria-pressed="false">Short</button></div><div class="meta" id="entryEditHint" hidden></div>
      <label>Limit price · USD<input id="price" type="number" step="any" min="0.01" placeholder="Enter price" required></label>
      <label style="margin-top:10px">Entry behavior<select id="entryMode" style="display:block;width:100%;margin:6px 0"><option value="limit">Limit price or better</option><option value="near">Near target only (± tolerance)</option></select></label><label style="margin-top:10px">Entry tolerance · USD<input id="tolerance" type="number" step="0.01" min="0.01" value="2" required></label><div class="meta">Limit mode allows better prices; tolerance caps worse pre-click prices. Entry pauses if an exit level is already crossed. Final fill can exceed tolerance.</div><details><summary>TP / SL · optional</summary><div class="exitgrid"><label>Stop loss price<input id="sl" type="number" step="any" min="0.01" placeholder="Optional"></label><label>Take profit price<input id="tp" type="number" step="any" min="0.01" placeholder="Optional"></label></div><label>Trigger exits early · USD<input id="lead" type="number" step="0.01" min="0" value="2"></label><div class="meta">New or saved exits follow the position mark and trigger early; final close may still be later.</div></details><div class="meta" id="ticket">Reading native ticket…</div><button id="submit" type="submit">Set long trigger</button><button id="cancelEdit" type="button" style="width:100%;margin-top:6px" hidden>Cancel edit</button><div id="entryError" class="meta err" role="alert" hidden></div>
    </form><details><summary>SL / TP for an existing position</summary><button id="loadPositions" type="button">Load open positions</button><button id="closePositionEditor" type="button" title="Closes the form without removing SL / TP protection." style="margin-left:6px" hidden>Close editor</button><div id="positionError" class="meta err" role="alert" hidden></div><form id="existingForm" hidden><label>Native position<select id="existingPosition" style="width:100%;margin:8px 0"></select></label><div id="positionWallet" class="meta"></div><div class="exitgrid"><label>Existing position stop loss<input id="existingSL" type="number" min="0.01" step="any"></label><label>Existing position take profit<input id="existingTP" type="number" min="0.01" step="any"></label></div><label>Existing position early exit · USD<input id="existingLead" type="number" min="0" step="0.01" value="2" required></label><div class="meta">SL/TP follows the position mark. May immediately close if a threshold is already crossed. No new trade is opened.</div><button type="submit" id="protect">Arm SL / TP on selected position</button></form></details><details open><summary>Chart levels & risk</summary><div id="levelChart"></div></details>
    <div class="footer">Executes automatically at market when the price is reached; fill price may be worse. Keep this tab open and wallet authorized. Entry watches expire after 24 hours; editing keeps the original deadline. TP / SL activates after a matching fill appears; keep native Positions visible.</div>
    <details><summary>Execution history</summary><div id="history"></div><button id="exportHistory" type="button">Export history</button></details><details><summary>Connection & execution details</summary><pre id="diagnostics"></pre><button id="check" type="button">Check connection</button></details>
  </section>`;
  const $ = id => root.querySelector('#' + id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let side = 'long', busy = false, disposed = false, snapshot, renderKey = '', historyRenderKey=null, editingEntry=null, editingEntryTerms=null, newEntryDraft=null, editingEntryRevision=0, entryGeneration=0, entrySaving=false, editingExits=null, editingExitsRevision=0, chartMode='entry', selectedPosition=null,positionGeneration=0,positionLoading=false,positionSaving=false,connected=false;let refreshDraftChart=()=>{};
  const entryDraftFields=['price','entryMode','tolerance','sl','tp','lead'];
  function clearEntryError(){$('entryError').hidden=true;$('entryError').textContent='';}
  function renderEntryTicket(native=getTicket()){
    const saved=editingEntry&&editingEntryTerms;
    $('ticket').textContent=saved?`Saved order: $${saved.margin} margin · ${saved.leverage}× leverage (fixed while editing).`:native.ok?`Uses native ticket: $${native.margin} margin · ${native.leverage}× leverage`:native.error;
  }
  function syncEntryControls(){
    $('submit').disabled=entrySaving||!connected;
    $('cancelEdit').hidden=!editingEntry;$('cancelEdit').disabled=entrySaving;
    for(const id of ['long','short'])$(id).disabled=Boolean(editingEntry);
    $('entryEditHint').hidden=!editingEntry;$('entryEditHint').textContent=editingEntry?`Editing saved ${side} entry; direction is fixed. Use Cancel edit to start another order.`:'';
    if(!editingEntry){newEntryDraft=null;editingEntryTerms=null;}renderEntryTicket();
  }
  function rememberNewEntryDraft(){
    if(!editingEntry)newEntryDraft={side,values:Object.fromEntries(entryDraftFields.map(id=>[id,$(id).value])),exitsOpen:$('sl').closest('details').open};
  }
  function choose(value) {
    entryGeneration++;clearEntryError();
    side = value; $('long').setAttribute('aria-pressed', String(side === 'long')); $('short').setAttribute('aria-pressed', String(side === 'short'));
    $('submit').textContent = `Set ${side} trigger`;syncEntryControls();refreshDraftChart();
  }
  $('long').onclick = () => {if(editingEntry)return;chartMode='entry';choose('long');}; $('short').onclick = () => {if(editingEntry)return;chartMode='entry';choose('short');};
  $('cancelEdit').onclick=()=>{
    if(entrySaving||!editingEntry)return;
    const previous=newEntryDraft;editingEntry=null;editingEntryRevision=0;chartMode='entry';choose(previous?.side??side);
    if(previous){for(const id of entryDraftFields)$(id).value=previous.values[id];$('sl').closest('details').open=previous.exitsOpen;}
    $('notice').textContent='Edit discarded. Your new-entry draft is restored. No request sent.';refreshDraftChart();$('price').focus();
  };
  $('form').addEventListener('input',()=>{entryGeneration++;clearEntryError();refreshDraftChart();});
  $('form').addEventListener('change',()=>{entryGeneration++;clearEntryError();refreshDraftChart();});
  $('form').onsubmit = async event => {
    event.preventDefault();
    if(disposed)return;
    if(!connected){$('notice').textContent=connectionBlockedMessage;return;}
    if(entrySaving){$('notice').textContent='An entry request is already in progress. Current draft retained.';return;}
    const generation=entryGeneration,editId=editingEntry,requestRevision=editingEntryRevision,requestSide=side;
    clearEntryError();entrySaving=true;syncEntryControls();$('submit').disabled=true;$('notice').textContent='Checking native ticket…';
    try{
      const ticket=getTicket();if(!ticket.ok)throw Error(ticket.error);
      const terms=editId?editingEntryTerms:ticket;if(!terms)throw Error('Reopen Edit to load the saved order size.');
      const draft={market,side:requestSide,price:Number($('price').value),entryMode:$('entryMode').value,entryTolerance:Number($('tolerance').value),margin:terms.margin,leverage:terms.leverage,exitLead:Number($('lead').value),stopLoss:$('sl').value?Number($('sl').value):null,takeProfit:$('tp').value?Number($('tp').value):null};
      const result=await send(editId?{type:'editWatch',id:editId,expectedRevision:requestRevision,...draft}:{type:'create',order:draft});
      if(disposed)return;if(result.error)throw Error(result.error);
      if(editId&&editingEntry===editId&&editingEntryRevision===requestRevision)editingEntryRevision=result.order.editRevision??0;
      if(generation===entryGeneration&&editingEntry===editId){editingEntry=null;choose(requestSide);$('notice').textContent=result.order.status==='watching'?'Order watching. It will submit automatically.':result.order.message;}
      else $('notice').textContent='Earlier request: '+(result.order.message??result.order.status)+'. Current draft retained.';
      await poll();
    }catch(error){if(!disposed){if(error.code==='PAPERTRADE_REFRESH_REQUIRED')setConnection(error);$('notice').textContent=(generation===entryGeneration?'':'Earlier request: ')+error.message+(generation===entryGeneration?'':' Current draft retained.');if(generation===entryGeneration&&editingEntry===editId){$('entryError').textContent='Previous request: '+error.message;$('entryError').hidden=false;}}}
    finally{entrySaving=false;if(!disposed)syncEntryControls();}
  };
  function clearPositionError(){$('positionError').textContent='';$('positionError').hidden=true;}
  function showPositionError(message){$('positionError').textContent=message;$('positionError').hidden=false;}
  $('existingForm').addEventListener('input',()=>{clearPositionError();refreshDraftChart();});$('existingForm').addEventListener('change',()=>{clearPositionError();refreshDraftChart();});
  function syncPositionControls(){
    $('closePositionEditor').hidden=!positionLoading&&!selectedPosition;$('closePositionEditor').disabled=positionSaving;
    $('protect').disabled=!connected||positionLoading||positionSaving||!selectedPosition;
    $('existingPosition').disabled=positionSaving;$('loadPositions').disabled=positionSaving;
    for(const id of ['existingSL','existingTP','existingLead'])$(id).disabled=positionLoading||positionSaving;
  }
  const connectionBlockedMessage='Connection unavailable. Your draft is retained; wait for a successful status check or refresh Papertrade.';
  function setConnection(error=null){
    connected=error===null;
    const message=error?(error.code==='PAPERTRADE_REFRESH_REQUIRED'?error.message:`${error.message} Reload this page after updating the extension.`):'';
    if($('connectionError').textContent!==message)$('connectionError').textContent=message;
    $('connectionError').hidden=connected;
    const title=connected?'Active orders':'Active orders · last known';if($('activeOrdersTitle').textContent!==title)$('activeOrdersTitle').textContent=title;
    if(connected&&$('notice').textContent===connectionBlockedMessage)$('notice').textContent='Connection restored. Your draft is retained.';
    syncEntryControls();syncPositionControls();refreshDraftChart();
  }
  async function loadPositionEditor(wantedId=null,scroll=false){
    if(disposed)return;
    if(positionSaving){$('notice').textContent='Wait for the current SL / TP save to finish.';return;}
    clearPositionError();$('positionWallet').textContent='';
    const generation=++positionGeneration;positionLoading=true;selectedPosition=null;editingExits=null;$('existingForm').closest('details').open=true;
    if(wantedId!==null)$('existingPosition').value=String(wantedId);
    $('existingSL').value='';$('existingTP').value='';$('existingLead').value=2;
    $('protect').textContent='Reading position…';$('notice').textContent='Reading selected native position…';syncPositionControls();
    try{
      const [result,state]=await Promise.all([send({type:'listPositions',market}),send({type:'state'})]);
      if(disposed||generation!==positionGeneration)return;
      if(result.error||state.error)throw Error(result.error??state.error);
      if(!validOwner(result.owner)||!Array.isArray(result.positions)||!Array.isArray(state.orders))throw Error('Position editor data unavailable. Reload Papertrade.');
      setConnection();
      const positions=result.positions,target=wantedId!==null?positions.find(p=>String(p.positionId)===String(wantedId)):positions[0];
      if(!target)throw Error(wantedId!==null?'Selected native position is no longer available. Load positions and choose again.':'No open native positions found. Keep Positions visible.');
      const watch=state.orders.find(o=>o.owner===result.owner&&o.positionId===target.positionId&&o.market===market&&o.status==='exits_armed');
      $('existingPosition').innerHTML=positions.map(p=>`<option value="${escape(p.positionId)}">${escape(p.market)} ${escape(p.side)} #${escape(p.positionId)} · $${p.margin} · ${p.leverage}× · entry $${p.entryPrice}</option>`).join('');
      $('existingPosition').value=target.positionId;selectedPosition={...target,owner:result.owner};$('positionWallet').textContent=`Wallet ${result.owner.slice(0,6)}…${result.owner.slice(-4)} · selected position`;editingExits=watch?.id??null;editingExitsRevision=watch?.editRevision??0;chartMode='position';
      $('existingSL').value=watch?.stopLoss??'';$('existingTP').value=watch?.takeProfit??'';$('existingLead').value=watch?.exitLead??2;
      $('protect').textContent=watch?'Save SL / TP changes':'Arm SL / TP on selected position';$('existingForm').hidden=false;$('existingForm').closest('details').open=true;
      $('notice').textContent=`Editing native position #${target.positionId}. Changes apply only when saved.`;
      refreshDraftChart();if(scroll)$('existingForm').scrollIntoView({block:'nearest'});return target;
    }catch(error){if(!disposed&&generation===positionGeneration){if(error.code==='PAPERTRADE_REFRESH_REQUIRED')setConnection(error);$('existingForm').hidden=true;$('notice').textContent=error.message;showPositionError('Position read: '+error.message);}}
    finally{if(!disposed&&generation===positionGeneration){positionLoading=false;syncPositionControls();}}
  }
  $('loadPositions').onclick=()=>loadPositionEditor(selectedPosition?.positionId??null);
  $('closePositionEditor').onclick=()=>{
    if(positionSaving)return;
    clearPositionError();$('positionWallet').textContent='';positionGeneration++;positionLoading=false;selectedPosition=null;editingExits=null;editingExitsRevision=0;chartMode='entry';
    $('existingSL').value='';$('existingTP').value='';$('existingLead').value=2;$('existingForm').hidden=true;
    const section=$('existingForm').closest('details');section.open=false;syncPositionControls();section.querySelector('summary')?.focus();
    $('notice').textContent='Position editor closed. No protection changes sent.';refreshDraftChart();
  };
  $('existingForm').onsubmit=async event=>{
    event.preventDefault();
    if(disposed)return;
    if(!connected){$('notice').textContent=connectionBlockedMessage;return;}
    if(positionLoading||positionSaving||!selectedPosition||$('existingPosition').value!==String(selectedPosition.positionId)){$('notice').textContent='Wait for the selected native position to finish loading.';return;}
    const request={type:editingExits?'editWatch':'protectPosition',id:editingExits,expectedRevision:editingExitsRevision,expectedOwner:selectedPosition.owner,market,positionId:selectedPosition.positionId,stopLoss:$('existingSL').value?Number($('existingSL').value):null,takeProfit:$('existingTP').value?Number($('existingTP').value):null,exitLead:Number($('existingLead').value)};
    const saveGeneration=positionGeneration,savePositionId=selectedPosition.positionId;clearPositionError();positionSaving=true;syncPositionControls();
    try{const result=await send(request);if(disposed)return;if(result.error)throw Error(result.error);$('notice').textContent=result.order.message;
      if(result.order.status==='exits_armed'){editingExits=result.order.id;editingExitsRevision=result.order.editRevision??0;$('protect').textContent='Save SL / TP changes';}else{selectedPosition=null;$('existingForm').hidden=true;}
      await poll();
    }catch(error){if(!disposed){if(error.code==='PAPERTRADE_REFRESH_REQUIRED')setConnection(error);$('notice').textContent=error.message;if(saveGeneration===positionGeneration&&selectedPosition?.positionId===savePositionId)showPositionError('Previous protection request: '+error.message);}}finally{positionSaving=false;if(!disposed)syncPositionControls();}
  };
  $('orders').onclick = async event => {
    const button = event.target.closest('button[data-id]'); if (!button) return;
    try {
      if(button.dataset.action==='edit') {const order=snapshot.orders.find(o=>o.id===button.dataset.id);if(order.status==='exits_armed'){await openPosition({market:order.market,side:order.side,positionId:order.positionId,entryPrice:order.price,margin:order.margin,leverage:order.leverage});}else{rememberNewEntryDraft();chartMode='entry';editingEntry=order.id;editingEntryRevision=order.editRevision??0;editingEntryTerms={margin:order.margin,leverage:order.leverage};choose(order.side);$('price').value=order.price;$('tolerance').value=order.entryTolerance??2;$('entryMode').value=order.entryMode??'near';$('sl').value=order.stopLoss??'';$('tp').value=order.takeProfit??'';$('lead').value=order.exitLead??0;$('submit').textContent='Save entry changes';refreshDraftChart();$('form').scrollIntoView({block:'nearest'});}return;}
      if(button.dataset.action==='recover') {
        const result=await send({type:'positionsForOrder',id:button.dataset.id});if(result.error)throw Error(result.error);
        if(!result.positions.length)throw Error('No matching native position found. Open native Positions and verify margin/leverage.');
        const target=button.closest('.order');target.querySelector('.recovery')?.remove();
        const box=document.createElement('div');box.className='recovery';
        box.innerHTML=`<label>Attach to native position<select style="width:100%;margin:8px 0" id="attach-${escape(button.dataset.id)}">${result.positions.map(p=>`<option value="${escape(p.positionId)}">${escape(p.market)} ${escape(p.side)} #${escape(p.positionId)} · entry $${p.entryPrice}</option>`).join('')}</select></label><small>Before-entry position IDs: ${escape(result.beforePositionIds.join(', ')||'none')}. Matching positions now: ${result.positions.length}.</small><small>Arming may immediately submit Close if price has already crossed TP or SL. No new entry is opened.</small><button class="cancel" data-action="attachExits" data-id="${escape(button.dataset.id)}">Arm exits on selected position</button>`;target.append(box);return;
      }
      const positionId=button.dataset.action==='attachExits'?root.querySelector('#attach-'+button.dataset.id)?.value:undefined;
      const result = await send({positionId, type:button.dataset.action??'cancel', id:button.dataset.id }); if (result.error) throw Error(result.error);if(button.dataset.action==='cancel'||button.dataset.action==='cancelExits'){if(editingEntry===button.dataset.id){editingEntry=null;choose(side);}if(editingExits===button.dataset.id){editingExits=null;$('existingForm').hidden=true;}$('notice').textContent=result.message??'Cancelled.';} await poll(); }
    catch (error) { $('notice').textContent = error.message; }
  };
  $('check').onclick = async () => {
    try { const result = await send({ type:'check', order:{market} }); if (result.error) throw Error(result.error); $('notice').textContent = 'Native ticket is ready. This check does not submit an order.'; }
    catch (error) { $('notice').textContent = error.message; }
  };
  async function poll() {
    if (busy || disposed) return; busy = true;
    try {
      const nextSnapshot=await send({type:'state'});if(disposed)return;if(nextSnapshot.error)throw Error(nextSnapshot.error);snapshot=nextSnapshot;
      const tick = snapshot.ticks[market], ticket = getTicket(), fresh = tick && Date.now()-tick.sourceAt<750 && Date.now()-tick.receivedAt<750;
      $('live').textContent = fresh ? `Chart $${(tick.price??tick.mid??(tick.bid+tick.ask)/2).toLocaleString('en-US',{maximumFractionDigits:2})} · Mark $${positionMarkPrice(tick).toLocaleString('en-US',{maximumFractionDigits:2})}` : 'Waiting for live price';
      renderEntryTicket(ticket);
      $('diagnostics').textContent = `Version ${globalThis.chrome?.runtime?.getManifest?.().version??'development fixture'}\nFeed: ${snapshot.feed}\nQuote: ${tick?new Date(tick.sourceAt).toLocaleTimeString():'none'} · ${tick?Date.now()-tick.sourceAt:'—'} ms old
Price: HL size-weighted BBO\nNative action: ${ticket.action??ticket.error}\nWallet/order ready: ${ticket.ready?'yes':'no'}\nVenue limits: ${snapshot.venue?'loaded':'unavailable'}`;
      const historyHTML=snapshot.orders.filter(o=>o.market===market).map(o=>`<div class="order"><b>${escape(o.side)} · ${escape(o.status)}</b><small>Target $${o.price} · trigger ${o.entryTriggerPrice??o.triggeredExitPrice??'—'} · native fill ${o.fillPrice??'unverified'} · deviation ${o.entryDeviation??'—'}<br>Entry click ${o.entryClickedAt?new Date(o.entryClickedAt).toLocaleTimeString():'unrecorded'} · entry acknowledgement ${o.submittedAt?new Date(o.submittedAt).toLocaleTimeString():'—'} · close acknowledgement ${o.closeSubmittedAt?new Date(o.closeSubmittedAt).toLocaleTimeString():'—'}<br>${o.exitExecutionCheck?`${o.exitExecutionCheck.clickedAt!=null?'Close dispatch':'Close price check'} ${o.exitExecutionCheck.triggerToClickMs??o.exitExecutionCheck.triggerToCheckMs??'—'} ms · quote age ${o.exitExecutionCheck.sourceToClickMs??o.exitExecutionCheck.sourceToCheckMs??'—'} ms · ${o.exitExecutionCheck.priceBasis??'chart/legacy'} check $${o.exitExecutionCheck.checkedPrice??o.exitExecutionCheck.nativePrice??'unavailable'} · header $${o.exitExecutionCheck.nativePrice??'unavailable'}<br>`:''}Exit settlement price / PnL: unverified</small></div>`).join('');
      if(historyHTML!==historyRenderKey){$('history').innerHTML=historyHTML;historyRenderKey=historyHTML;}
      const viewNow=Date.now(),list = snapshot.orders.filter(o=>o.market===market), key = JSON.stringify({fresh,orders:list.map(order=>{const {lastObservedAt,lastObservedPositions,bindingDiagnostic,positionCheckedAt,...visible}=order;return {...visible,positionHealth:positionHealth(order)?.text,entryExpiry:entryExpiry(order,viewNow)?.text};})});
      const pending=list[0];if(pending?.status==='watching'&&tick)$('notice').textContent=entryBlockReason(pending,tick)??'Limit reached. Checking native ticket…';
      if (key !== renderKey) {
        renderKey = key;
        if (list[0] && ['failed','attention','submitted','awaiting_fill','exits_armed','close_submitted','closed','filled','cancelled','exits_disabled'].includes(list[0].status)) $('notice').textContent = list[0].message;
        if(list[0]?.status==='exits_armed'){const health=positionHealth(list[0]);if(!fresh)$('notice').textContent='Live quote unavailable. Exit watch is waiting; protection cannot execute on stale prices.';else if(health?.warning)$('notice').textContent=health.text;}
        const active=list.filter(o=>['watching','submitting','submitted','awaiting_fill','exits_armed','closing','close_submitted','attention'].includes(o.status));
        syncOrderCards($('orders'),active.length?active.map(order=>{const health=positionHealth(order),expiry=entryExpiry(order,viewNow);return `<article class="order" data-order-id="${escape(order.id)}" data-recovery-allowed="${['attention','awaiting_fill'].includes(order.status)&&(order.stopLoss!=null||order.takeProfit!=null)}"><div class="order-heading"><b data-order-part="title">${order.kind==='position_exits'?`Exits · ${escape(order.side)} #${escape(order.positionId)}`:`${order.side==='long'?'Long ≤':'Short ≥'} $${Number(order.price).toLocaleString()}`}</b><span data-order-part="state" class="state ${order.status==='attention'||health?.warning?'err':''}">${escape(({watching:'Watching',submitting:'Submitting entry',submitted:'Entry submitted',awaiting_fill:'Waiting for fill',exits_armed:fresh?(health?.warning?'Watch retained · check position':'TP / SL armed'):'Disconnected — exits waiting',closing:'Submitting close',close_submitted:'Close pending'})[order.status]??order.status)}</span><span data-order-part="edit">${['watching','exits_armed'].includes(order.status)?`<button class="edit" data-action="edit" data-id="${escape(order.id)}">Edit</button>`:''}</span></div><small data-order-part="description" tabindex="0">$${order.margin} margin · ${order.leverage}×${order.entryTolerance!=null?' · '+(order.entryMode==='limit'?'Limit or better; worse allowance $':'Near target ±$')+order.entryTolerance:''}${order.stopLoss!=null?' · SL $'+order.stopLoss+' → $'+exitLevels(order).stopLoss:''}${order.takeProfit!=null?' · TP $'+order.takeProfit+' → $'+exitLevels(order).takeProfit:''}${order.exitLead!=null?' · Early $'+order.exitLead:''}${order.stopLoss!=null||order.takeProfit!=null?' · Basis: '+(order.exitPriceMode==='mark'?'position mark':'chart/legacy'):''} · ${escape(order.message)}${expiry?`<br><span data-entry-expiry data-expires-at="${expiry.deadline??''}" class="${expiry.warning?'err':''}" title="${escape(expiry.deadline==null?'Deadline unavailable':`Entry deadline ${new Date(expiry.deadline).toLocaleString()}. Editing keeps this deadline.`)}">${escape(expiry.text)}</span>`:''}<br>Wallet ${escape(/^0x[0-9a-f]{40}$/.test(order.owner??'')?order.owner.slice(0,6)+'…'+order.owner.slice(-4):'unbound · re-arm required')}<br>Progress: ${escape(orderProgress(order))}</small><div data-order-part="health" tabindex="0" class="order-note ${health?.warning?'err':''}" role="status" ${!health?'hidden':''}>${health?escape(health.text):''}</div><div data-order-part="actions">${canCancelEntry(order)?`<button class="cancel" data-action="cancel" data-id="${escape(order.id)}">${order.status==='watching'?'Cancel order':'Cancel disabled entry'}</button>`:['awaiting_fill','exits_armed'].includes(order.status)?`<button class="cancel" data-action="cancelExits" data-id="${escape(order.id)}">Remove SL / TP</button><div class="order-note">Stops extension exits only. The position stays open; a submitted entry cannot be recalled.</div>`:['submitting','submitted','closing','close_submitted'].includes(order.status)?'<div class="order-note">Already submitting or submitted. Cannot cancel the venue action here; check native Positions / Status.</div>':''}${['attention','awaiting_fill'].includes(order.status)&&(order.stopLoss!=null||order.takeProfit!=null)?`<button class="edit" data-action="recover" data-id="${escape(order.id)}">Attach exits to existing position</button>`:''}</div></article>`;}).join(''):'<p class="empty">No active orders. Completed and cancelled orders are in Execution history.</p>');

      }
    setConnection();
    } catch (error) { if(disposed)return;$('live').textContent='Disconnected';setConnection(error); }
    finally { busy = false; }
  }
  async function openPosition(position){return loadPositionEditor(position.positionId,true);}
  $('existingPosition').onchange=()=>loadPositionEditor($('existingPosition').value);
  $('form').addEventListener('focusin',()=>{chartMode='entry';});$('existingForm').addEventListener('focusin',()=>{chartMode='position';});
  $('exportHistory').onclick=()=>{const blob=new Blob([JSON.stringify(exportExecutionHistory(snapshot?.orders??[]),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='papertrade-execution-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const getDraft=()=>{const existing=chartMode==='position',ticket=editingEntryTerms??getTicket();return {mode:chartMode,side:existing?selectedPosition?.side:side,price:existing?selectedPosition?.entryPrice:Number($('price').value),margin:existing?selectedPosition?.margin:ticket.margin,leverage:existing?selectedPosition?.leverage:ticket.leverage,stopLoss:Number($(existing?'existingSL':'sl').value)||null,takeProfit:Number($(existing?'existingTP':'tp').value)||null};};
  const setDraft=(field,value,interaction={})=>{if(disposed||!['price','stopLoss','takeProfit'].includes(field)||!Number.isFinite(value)||value<=0||entrySaving||positionSaving)return;if(chartMode==='position'&&(field==='price'||positionLoading||positionSaving))return;if(chartMode==='entry'){entryGeneration++;if(!interaction.dragging)clearEntryError();}else if(!interaction.dragging)clearPositionError();const id=field==='price'?'price':field==='stopLoss'?(chartMode==='position'?'existingSL':'sl'):(chartMode==='position'?'existingTP':'tp');$(id).value=value;};
  const disposeChart=mountLevelChart($('levelChart'),{getTick:()=>connected?snapshot?.ticks[market]:null,getDraft,setDraft});
  refreshDraftChart=disposeChart.refresh;syncEntryControls();syncPositionControls();
  const interval = setInterval(()=>void poll(),1000); void poll();
  const dispose=()=>{disposed=true;positionGeneration++;entryGeneration++;clearInterval(interval);disposeChart();};dispose.openPosition=openPosition;dispose.getDraft=getDraft;dispose.setDraft=(...args)=>{setDraft(...args);if(!args[2]?.dragging)refreshDraftChart();};return dispose;
}
