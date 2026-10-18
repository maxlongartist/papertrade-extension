import {validOwner} from './account.js';
import {queueLabel} from './congestion-evidence.js';
import {legTiming,timingLabel,recentTimings} from './execution-timing.js';
import { pairAfterAcknowledgement, pairMetrics, pairHistoryReport, elapsedLabel, pairCloseProgress } from './manual-view.js';
export function mountManualPanel(root, send, { market, getTicket }) {
  root.innerHTML = `<style>
:host([hidden]){display:none!important}:host{display:block;color:#e9edf1;font:13px system-ui}*{box-sizing:border-box}.box{margin:14px 0;padding:14px;background:#171d22;border:1px solid #343b42;border-radius:8px}.head{display:flex;justify-content:space-between;gap:8px;font-weight:650}.tag{font-size:10px;color:#a0b6a9}.meta,.note{font-size:11px;line-height:1.5;color:#aebac5;margin:9px 0}.actions{display:flex;gap:8px}button{flex:1;border:1px solid #52616b;background:#d6e6f0;color:#14222b;padding:12px 8px;border-radius:6px;font:600 12px system-ui;cursor:pointer}#pairClose{background:#35272b;border-color:#8d666c;color:#ffd3d3}button:disabled{opacity:.4;cursor:default}.legs{display:flex;gap:8px;margin-top:12px}.leg{flex:1;padding:9px;border-radius:5px;background:#11171c;color:#aebac5;font-size:11px;line-height:1.5;min-width:0;overflow-wrap:anywhere}.leg b{display:block;color:#e9edf1}.error{display:block;color:#ffc38c}.status[data-warning=true]{color:#ffc38c}.status{font-size:12px;line-height:1.5;margin:10px 0 0;color:#c4d9cc}.note{color:#889aa7;margin-bottom:0}.health{font-size:11px;line-height:1.5;color:#a0b6a9;margin-top:9px}.health[data-warning=true]{color:#ffc38c}.metrics{font-size:12px;line-height:1.7;margin-top:9px;white-space:pre-line}details{margin-top:12px;border-top:1px solid #343b42;padding-top:10px}summary{cursor:pointer;color:#aebac5;font-size:11px}#pairHistory{font-size:11px;line-height:1.6;white-space:pre-line;max-height:180px;overflow:auto}#pairRestore{width:100%;padding:9px;margin-top:8px;background:#294238;color:#d9f0de;border-color:#5e8e76}.recovery{border:1px solid #5e8e76;border-radius:6px;padding:10px;margin-top:10px;font-size:11px;line-height:1.5}.recovery p{margin:4px 0}.activity{white-space:pre-line;font-size:11px;line-height:1.7;color:#aebac5;margin:8px 0}#pairExport,#pairSavedHistory{padding:7px;margin-top:7px;background:#222e37;color:#d6e6f0;font-size:11px}[hidden]{display:none!important}
:host{font-variant-numeric:tabular-nums}.box{overflow-anchor:none}.head{flex-wrap:wrap}.actions button{height:4em;line-height:1.3;padding:6px;overflow:auto}.health,.status{height:4.5em;overflow:auto;overflow-wrap:anywhere}#pairTicket,.wallet-slot{height:3em;overflow:auto;overflow-wrap:anywhere}.wallet-slot{font-size:11px;line-height:1.5;margin:9px 0}.wallet-slot .meta{margin:0}.leg{height:7.5em;overflow:auto}#pairTiming{height:3em;overflow:auto}#pairMetrics{height:6.8em;overflow:auto}.tag{white-space:nowrap}</style><section class="box"><div class="head"><span>Manual pair · ${market}</span><span class="tag">ONE CLICK · NO REPEAT</span></div><div class="meta" id="pairTicket">Reading native ticket…</div><div class="wallet-slot"><div class="meta" id="pairWallet" hidden></div></div><div class="actions"><button id="pairOpen" disabled>Open long + short</button><button id="pairClose" disabled>Close pair</button></div><div class="health" id="pairHealth" tabindex="0" role="status">Checking readiness…</div><div id="pairRecovery" class="recovery" hidden><b>Saved pair found</b><p id="pairRecoveryInfo"></p><p id="pairRecoveryReason"></p><button id="pairRestore" disabled>Restore tracking here</button></div><div class="legs"><div class="leg" tabindex="0"><b>Long</b><span id="pairLong">Not opened</span><span class="error" id="pairLongError"></span></div><div class="leg" tabindex="0"><b>Short</b><span id="pairShort">Not opened</span><span class="error" id="pairShortError"></span></div></div><div class="meta" id="pairTiming" hidden></div><div class="metrics" id="pairMetrics" tabindex="0" hidden></div><div id="pairStatus" tabindex="0" class="status" role="status">Choose margin and leverage in Papertrade’s native ticket.</div><details><summary>Pair history & details</summary><div class="activity" id="pairActivity"></div><div class="meta" id="pairRecentTiming"></div><div id="pairHistoryScope" class="meta" role="status"></div><button id="pairSavedHistory" title="Read-only saved closed pairs; sends no trade">Saved closed ${market} history</button><div id="pairHistory">No pairs in this tab yet.</div><button id="pairExport" disabled>Export pair history</button><p class="note">Gross estimates use native entry and mark prices. Excludes fees, funding, slippage and PAPER rewards. Positions checks confirm page visibility, not quote freshness or settlement.</p></details><p class="note">Market orders; two separate fills. Margin is per leg. Keep Positions visible and other trading automation stopped. Close pair also handles late fills. No timer or repetition.</p></section>`;
  const $ = id => root.querySelector('#' + id);
  const setText=(id,value)=>{const element=$(id),text=String(value??'');if(element.textContent!==text)element.textContent=text;};
  let pair = null, recovery = null, restoring = false, history = [], busy = false, closing = false, polling = false, inspecting = false, disposed = false, notice = '', stateError = '', closeNoticeId=null,
    stateGeneration=0, actionGeneration=0, displayedTicket = null, preflight = null, lastInspect = 0, ticketKey = '', historyKey = '', savedHistory = null, historyLoading = false, historyNotice = '';
  const key = t => JSON.stringify([t.ok, t.ready, t.margin, t.leverage]);
  const money = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signed = n => `${n < 0 ? '−' : '+'}$${money(Math.abs(n))}`;
  const legText = l => {
    if(!l)return 'Not opened';const t=legTiming(l),entryWait=t.entryWaitMs==null?'':` · ${timingLabel(t.entryWaitMs)} since request`,closeWait=t.closeWaitMs==null?'':` · ${timingLabel(t.closeWaitMs)} since request`;
    return l.closed?'Closed in Positions':l.close==='submitted'?'Close submitted'+closeWait:l.close==='sending'?'Submitting close…'+closeWait:l.close==='uncertain'?'Close unconfirmed · check native Status'+closeWait:
      l.positionId&&l.visible===false?'Not visible · confirming closure':l.positionId&&l.visible==null?`#${l.positionId} · awaiting position check`:l.positionId?`#${l.positionId} · $${Number(l.fillPrice).toLocaleString()}`:l.entry==='not_sent'?'Not sent':l.entry==='sending'?'Preparing native entry'+entryWait:l.entry==='uncertain'?'Entry unconfirmed'+entryWait:'Entry submitted · waiting for fill'+entryWait;
  };
  function render() {
    const ticket = getTicket(); displayedTicket={margin:ticket.margin,leverage:ticket.leverage};
    const active = pair && pair.status !== 'closed',viewPair=stateError&&pair?{...pair,observationError:true}:pair,closeProgress=pairCloseProgress(viewPair);
    const displayedHistory=savedHistory?.history??history;
    $('pairSavedHistory').disabled=historyLoading;
    $('pairSavedHistory').textContent=historyLoading?'Reading saved history…':savedHistory?'Back to this tab':`Saved closed ${market} history`;
    setText('pairHistoryScope',historyNotice||(savedHistory?`${savedHistory.history.length} saved closed ${market} pairs · ${savedHistory.owner.slice(0,6)}…${savedHistory.owner.slice(-4)} · snapshot ${new Date(savedHistory.checkedAt).toLocaleTimeString()}`:'History list and export: this tab.'));
    const shown = active ? pair : recovery ?? ticket;
    setText('pairTicket',active || recovery || ticket.ok ? `$${shown.margin} per leg · ${shown.leverage}× · $${shown.margin * 2} total margin` : ticket.error);
    const checked = preflight && ticketKey === key(ticket) && Date.now() - preflight.checkedAt < 6000;
    const readyTicket=checked&&preflight.ready&&preflight.ticket?.margin===ticket.margin&&preflight.ticket?.leverage===ticket.leverage;
    const readyOwner=checked&&preflight.ready&&validOwner(preflight.owner),selectedOwner=active?pair.owner:readyOwner?preflight.owner:null;
    $('pairWallet').hidden=!validOwner(selectedOwner);setText('pairWallet',validOwner(selectedOwner)?`${active?'Tracked wallet':'Ready wallet'} ${selectedOwner.slice(0,6)}…${selectedOwner.slice(-4)}`:'');
    $('pairOpen').disabled = busy || restoring || active || Boolean(stateError) || !ticket.ready || !checked || !preflight.ready || !readyOwner || !readyTicket;
    $('pairClose').disabled = closing || !active || pair.market !== market || pair.closeRequested === true;
    $('pairClose').textContent = closeProgress?.label??'Close pair';
    $('pairRecovery').hidden = active || !recovery;
    $('pairRestore').disabled = restoring || active || !recovery?.canRestore;
    $('pairRestore').textContent = restoring ? 'Restoring…' : 'Restore tracking here';
    setText('pairRecoveryInfo',recovery ? recovery.market + ' · ' + recovery.legs.map(l => l.side + (l.positionId ? ' #' + l.positionId : ' · ' + l.entry)).join(' / ') : '');
    setText('pairRecoveryReason',recovery?.reason ?? '');
    const metrics = pairMetrics(viewPair);
    let health, warning = false;
    if (active) {
      warning = !metrics.fresh || pair.status === 'attention';
      health = pair.observationError ? 'Positions unavailable · ' + pair.message :
        Number.isFinite(metrics.age) ? `Positions checked ${elapsedLabel(Math.floor(metrics.age / 1000))} ago${!metrics.fresh ? ' · observation stale; check native Positions' : ''}` : 'Waiting for native Positions…';
      if (metrics.fresh && metrics.visibleLegs === 1) {
        warning = true;
        health = (pair.closeRequested ? 'One leg remains visible. ' : 'Only one leg visible · pair incomplete. ') + health;
      }
    } else {
      warning = checked && (!preflight.ready||!readyOwner||!readyTicket);
      health = checked ? preflight.ready ? readyOwner?readyTicket?`Ready · $${money(preflight.available)} available`:'Ticket changed during readiness check. Checking updated settings…':'Wallet identity unavailable. Reload Papertrade before opening.' : preflight.reason : 'Checking readiness…';
    }
    if(stateError){health='Pair status unavailable · '+stateError;warning=true;}
    if(closeProgress){health=closeProgress.message+' '+health;warning=warning||closeProgress.warning;}
    setText('pairHealth',health); $('pairHealth').dataset.warning = String(warning);
    for (const side of ['long', 'short']) {
      const leg = pair?.legs.find(l => l.side === side), saved = !active && recovery?.legs.find(l=>l.side===side), title = side === 'long' ? 'Long' : 'Short';
      setText('pair' + title,saved ? saved.positionId ? '#' + saved.positionId + ' · restore tracking' : saved.entry : !leg&&stateError?'Tracking unavailable':legText(leg));
      setText('pair' + title + 'Error',leg && !leg.closed ? leg.error ?? '' : '');
    }
    $('pairTiming').hidden = !pair;
    if(pair){const label=(l,k)=>`${l.side==='long'?'L':'S'} ${legTiming(l)[k]==null?'—':timingLabel(legTiming(l)[k])}`;$('pairTiming').textContent='Observed entry: '+pair.legs.map(l=>label(l,'entryMs')).join(' / ')+' · Close absence: '+pair.legs.map(l=>label(l,'closeMs')).join(' / ');}
    const recent=recentTimings(displayedHistory.filter(p=>p.market===market));
    $('pairRecentTiming').textContent = `${market} observed confirmation medians (up to 20 legs): entry ${timingLabel(recent.entry.medianMs)} (${recent.entry.samples} samples); close absence ${timingLabel(recent.close.medianMs)} (${recent.close.samples} samples). Includes page polling; no exact fill or settlement timing. Interrupted/legacy samples excluded.`;
    $('pairMetrics').hidden = !active;
    if (active) $('pairMetrics').textContent = `Elapsed ${elapsedLabel(metrics.elapsed)} · ${metrics.visibleLegs}/2 legs ${metrics.fresh ? 'visible' : 'last seen'}\nGross PnL estimate ${metrics.grossPnl == null ? '—' : signed(metrics.grossPnl)}${metrics.unresolvedLegs?' · visible legs only':metrics.visibleLegs<2?' · open legs only':''}\nNet exposure estimate ${metrics.netExposure == null ? '—' : signed(metrics.netExposure)}${metrics.unresolvedLegs?' · visible legs only':''}${metrics.fresh&&metrics.unresolvedLegs?`\nPair totals unavailable · ${metrics.unresolvedLegs} leg${metrics.unresolvedLegs===1?'':'s'} unconfirmed.`:''}`;
    $('pairStatus').dataset.warning = String(Boolean(notice || stateError || closeProgress?.warning || (active && (pair.status === 'attention' || pair.observationError))));
    let statusText = notice || (recovery && !active ? 'Saved pair awaiting restoration. Restore sends no trade.' : pair ? (pair.market !== market ? 'Return to ' + pair.market + '. ' : '') + pair.message : recovery ? 'Saved pair awaiting restoration. Restore sends no trade.' : 'Choose margin and leverage in Papertrade’s native ticket.');
    if(stateError&&!notice&&!pair) statusText='Pair status unavailable. Check native Positions.';
    if(stateError&&!notice&&pair) statusText='Last known status · '+statusText;
    setText('pairStatus',statusText);
    const nextKey = JSON.stringify(displayedHistory);
    if (nextKey !== historyKey) {
      historyKey = nextKey;
      $('pairHistory').textContent = displayedHistory.length ? displayedHistory.map(p => `${new Date(p.createdAt).toLocaleString()} · ${p.market} · $${p.margin} / leg · ${p.leverage}×\n${p.status} · ${elapsedLabel(pairMetrics(p).elapsed)} · ${p.legs.map(l => l.side + ' ' + (l.positionId ? '#' + l.positionId : l.entry)).join(' / ')}\nQueue before entry: ${queueLabel(p.entryQueue)}\nQueue at Close request: ${queueLabel(p.closeQueue)}`).join('\n\n') : savedHistory?`No saved closed ${market} pairs for this wallet.`:'No pairs in this tab yet.';
    }
    $('pairExport').disabled = !displayedHistory.length;
    $('pairActivity').textContent = pair ? pair.legs.map(l => {
      const clicked = l.clickedAt ? new Date(l.clickedAt).toLocaleTimeString() : 'not recorded';
      const close = l.closeClickedAt ? new Date(l.closeClickedAt).toLocaleTimeString() : 'not recorded';
      return `${l.side}: entry ${l.entry} · click ${clicked}\nclose ${l.close} · click ${close}`;
    }).join('\n') + '\nQueue before entry: ' + queueLabel(pair.entryQueue) + '\nQueue at Close request: ' + queueLabel(pair.closeQueue) + '\nNominal network estimates, not your order’s ETA or proof of delay cause.' + (pair.restoredAt ? '\nTracking restored ' + new Date(pair.restoredAt).toLocaleString() + '. No trades sent by Restore.' : '') : '';
  }
  async function inspect() {
    if (inspecting || disposed) return;
    inspecting = true; lastInspect = Date.now();
    const capturedKey = key(getTicket());
    try {
      const check = await send({ type: 'pairInspect', market });
      if (disposed) return;
      preflight = check.error ? { ready: false, reason: check.error, checkedAt: Date.now() } : check;
      ticketKey = capturedKey;
      recovery = check.recovery ?? null;
    } catch (error) {
      if (disposed) return;
      recovery = null;
      preflight = { ready: false, reason: error.message, checkedAt: Date.now() };
      ticketKey = capturedKey;
    } finally { inspecting = false; if (!disposed) render(); }
  }
  async function poll() {
    if (polling || disposed) return;
    polling = true;const generation=stateGeneration;
    try {
      const r = await send({ type: 'pairState', market });
      if (disposed||generation!==stateGeneration) return;
      if (r.error) throw Error(r.error);
      stateError='';pair = r.pair;if(closeNoticeId&&pair?.id===closeNoticeId&&pair.status==='closed'){notice='';closeNoticeId=null;} history = r.history ?? (pair ? [pair] : []);
      render();
      if ((!pair || pair.status === 'closed') && !busy && !restoring && (!preflight || Date.now() - lastInspect >= 2000 || ticketKey !== key(getTicket()) || (preflight.ready && (preflight.ticket?.margin!==getTicket().margin || preflight.ticket?.leverage!==getTicket().leverage)))) void inspect();
      render();
    } catch (error) {
      if(disposed||generation!==stateGeneration)return;
      stateError=error.message;preflight = null;
      render();
    } finally { polling = false; }
  }
  $('pairOpen').onclick = async () => {
    if (disposed || busy || $('pairOpen').disabled) return;
    const action=++actionGeneration;
    const expectedOwner=preflight.owner,expectedTicket={...displayedTicket};stateGeneration++;notice = '';closeNoticeId=null; busy = true; render();
    try {
      const r = await send({ type: 'pairOpen', market, expectedOwner, expectedTicket });
      if(disposed||action!==actionGeneration)return;
      if (r.error) throw Error(r.error);
      pair = pairAfterAcknowledgement(pair,r.pair);
    } catch (error) { if(!disposed&&action===actionGeneration)notice = error.message; }
    finally { stateGeneration++;busy = false; preflight = null; if(!disposed){render(); void poll();} }
  };
  $('pairClose').onclick = async () => {
    if (disposed || closing || $('pairClose').disabled) return;
    const action=++actionGeneration;
    stateGeneration++;notice = '';closeNoticeId=null;const requestedPairId=pair?.id; closing = true; render();
    try {
      const r = await send({ type: 'pairClose', market, id: pair?.id });
      if(disposed||action!==actionGeneration)return;
      if (r.error) throw Error(r.error);
      pair = pairAfterAcknowledgement(pair,r.pair);
    } catch (error) { if(!disposed&&action===actionGeneration){notice = error.message;closeNoticeId=requestedPairId;} }
    finally { stateGeneration++;closing = false; if(!disposed){render(); void poll();} }
  };
  $('pairRestore').onclick = async () => {
    if (disposed || restoring || $('pairRestore').disabled) return;
    const action=++actionGeneration;
    stateGeneration++;restoring = true; notice = '';closeNoticeId=null; render();
    try {
      const r = await send({ type:'pairRestore', market, id:recovery?.id });
      if(disposed||action!==actionGeneration)return;
      if (r.error) throw Error(r.error);
      pair = pairAfterAcknowledgement(pair,r.pair); recovery = null;
    } catch (error) { if(!disposed&&action===actionGeneration)notice = error.message; }
    finally { stateGeneration++;restoring = false; preflight = null; if(!disposed){render(); void poll();} }
  };
  $('pairSavedHistory').onclick = async () => {
    if(historyLoading||disposed)return;
    historyNotice='';
    if(savedHistory){savedHistory=null;render();return;}
    historyLoading=true;render();
    try{
      const result=await send({type:'pairHistory',market});
      if(disposed)return;
      if(result.error)throw Error(result.error);
      if(!/^0x[0-9a-f]{40}$/.test(result.owner??'')||result.market!==market||!Array.isArray(result.history)||!Number.isFinite(result.checkedAt)||!result.history.every(p=>p.status==='closed'&&p.market===market&&p.owner===result.owner))throw Error('Saved history response unavailable.');
      savedHistory=result;
    }catch(error){if(!disposed)historyNotice=error.message;}
    finally{historyLoading=false;if(!disposed)render();}
  };
  $('pairExport').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(pairHistoryReport(savedHistory?.history??history), null, 2)], { type: 'application/json' }));
    const a = root.ownerDocument.createElement('a'); a.href = url; a.download = 'papertrade-pair-history.json';
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  void poll();
  const timer = setInterval(() => { render(); void poll(); }, 1000);
  return () => { disposed = true; clearInterval(timer); };
}
