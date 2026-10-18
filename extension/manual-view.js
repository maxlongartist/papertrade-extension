import {exportQueue} from './congestion-evidence.js';
import {legTiming} from './execution-timing.js';
// Action acknowledgements may arrive after a newer poll of the same pair.
export function pairAfterAcknowledgement(current, next) {
  if(!current||!next||current.id!==next.id)return next;
  if(current.status==='closed'||(current.closeRequested&&!next.closeRequested))return current;
  if(next.status==='closed')return next;
  const older=Number.isFinite(current.observedAt)&&(!Number.isFinite(next.observedAt)||next.observedAt<current.observedAt);
  // Preserve newer observations, while still applying a newly acknowledged Close.
  if(older&&Boolean(current.closeRequested)===Boolean(next.closeRequested))return current;
  return next;
}
// Display-only estimates. They never authorize an order or imply settlement PnL.
export function pairMetrics(pair, now = Date.now()) {
  if (!pair) return null;
  const end = pair.closedAt ?? now;
  const elapsed = Math.max(0, Math.floor((end - pair.createdAt) / 1000));
  const age = Number.isFinite(pair.observedAt) && pair.observedAt <= now + 1000 ? Math.max(0, now - pair.observedAt) : Infinity;
  const fresh = !pair.observationError && age <= 5000 && pair.status !== 'closed';
  const visible = pair.legs.filter(l => l.visible && !l.closed);
  const unresolvedLegs=pair.legs.filter(l=>!l.closed&&l.entry!=='not_sent'&&l.visible!==true).length;
  const measurable = fresh && visible.length > 0 && visible.every(l =>
    Number.isFinite(l.fillPrice) && l.fillPrice > 0 && Number.isFinite(l.markPrice) && l.markPrice > 0);
  const notional = pair.margin * pair.leverage;
  let grossPnl = null, netExposure = null;
  if (measurable) {
    grossPnl = 0; netExposure = 0;
    for (const leg of visible) {
      const sign = leg.side === 'long' ? 1 : -1;
      grossPnl += sign * notional * (leg.markPrice / leg.fillPrice - 1);
      netExposure += sign * notional * leg.markPrice / leg.fillPrice;
    }
  }
  return { elapsed, fresh, age, grossPnl, netExposure, visibleLegs: visible.length, unresolvedLegs };
}
// Display only: this summary never enables or retries a native Close.
export function pairCloseProgress(pair, now=Date.now()) {
  if(!pair||!pair.closeRequested||pair.status==='closed')return null;
  const remaining=pair.legs.filter(l=>!l.closed&&l.entry!=='not_sent');
  const names=legs=>legs.map(l=>l.side==='long'?'Long':'Short').join(' and ');
  const uncertain=remaining.filter(l=>l.close==='uncertain');
  if(uncertain.length)return {label:'Close needs attention',warning:true,message:`${names(uncertain)} Close unconfirmed. Check native Positions and Status; no duplicate Close is sent.`};
  const fresh=!pair.observationError&&Number.isFinite(pair.observedAt)&&pair.observedAt<=now+1000&&now-pair.observedAt<=5000;
  const delayed=remaining.filter(l=>fresh&&l.close==='submitted'&&l.visible===true&&Number.isFinite(l.closeRequestedAt)&&l.closeRequestedAt<=now&&now-l.closeRequestedAt>30000);
  if(delayed.length)return {label:'Close needs attention',warning:true,message:`${names(delayed)} Close submitted over 30s ago; position still visible. Check native Positions and Status. Submitted requests are not repeated.`};
  const submitted=remaining.filter(l=>l.close==='submitted'),sending=remaining.some(l=>l.close==='sending');
  if(sending)return {label:'Closing pair…',warning:false,message:'Sending Close for identified positions; monitoring late fills.'};
  if(submitted.length)return {label:'Close pending',warning:false,message:`${submitted.length} Close request${submitted.length===1?'':'s'} submitted; awaiting complete position observations. Monitoring late fills.`};
  return {label:'Waiting to close',warning:false,message:'Close requested; monitoring identified positions and late fills.'};
}
export function pairHistoryReport(history, now = Date.now()) {
  return {
    schemaVersion: 1, exportedAt: now,
    note: 'Observed timings include page polling and are omitted after observation interruptions. Native page observations; no settlement, realized PnL or PAPER reward verification. Display estimates exclude fees and slippage. Queue context is a nominal network estimate at request time, not a fill-time prediction or proof of delay causation. Wallet and browser identifiers omitted.',
    pairs: history.map(p => ({
      market: p.market, marginPerLeg: p.margin, leverage: p.leverage,
      entryQueue:exportQueue(p.entryQueue),closeQueue:exportQueue(p.closeQueue),
      createdAt: p.createdAt, closedAt: p.closedAt ?? null, status: p.status,
      closeRequested: p.closeRequested === true, restoredAt: p.restoredAt ?? null, observedAt: p.observedAt ?? null,
      legs: p.legs.map(l => ({ side: l.side, positionId: l.positionId ?? null,
        entry: l.entry, entryRequestedAt:l.entryRequestedAt??null, entryClickedAt: l.clickedAt ?? null, entryClickTimeSource:l.clickTimeSource??'legacy acknowledgement', entryAcknowledgedAt:l.entryAcknowledgedAt??null,
        fillObservedAt: l.filledAt ?? null, entryObservationInterrupted:l.entryObservationInterrupted===true, observedEntryPrice: l.fillPrice ?? null,
        close: l.close, closeRequestedAt:l.closeRequestedAt??null, closeClickedAt: l.closeClickedAt ?? null, closeClickTimeSource:l.closeTimeSource??'legacy acknowledgement', closeAcknowledgedAt:l.closeAcknowledgedAt??null, closedObservedAt:l.closedObservedAt??null, closeObservationInterrupted:l.closeObservationInterrupted===true, observedTiming:legTiming(l,now),
        closedInPositions: l.closed === true,
      })),
    })),
  };
}
export function elapsedLabel(seconds) {
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
